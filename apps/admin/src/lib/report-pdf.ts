import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import type { ReportRow } from "./export";
import { HEADER, rowToArray, triggerDownload } from "./export";

/** Warna teks kolom Status di PDF (RGB). */
export const STATUS_COLORS: Record<string, [number, number, number]> = {
  Hadir: [62, 93, 71],
  Terlambat: [153, 48, 43],
  Izin: [85, 102, 78],
  Sakit: [123, 76, 14],
  "Tidak hadir": [109, 105, 99],
};

const BRAND = {
  primary: [184, 92, 66] as [number, number, number],
  deep: [148, 70, 49] as [number, number, number],
  ink: [37, 36, 33] as [number, number, number],
  muted: [109, 105, 99] as [number, number, number],
  line: [222, 216, 207] as [number, number, number],
  zebra: [250, 248, 245] as [number, number, number],
};

const FONT_BASE =
  "https://raw.githubusercontent.com/Tokotype/PlusJakartaSans/master/fonts/ttf";

export interface ReportSummary {
  total: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  tidakHadir: number;
}

export interface ReportMeta {
  periode: string;
  institusi: string;
  peserta: string;
  status: string;
  pesertaCount: number;
  dicetak: string;
}

export interface BuildPdfInput {
  rows: ReportRow[];
  summary: ReportSummary;
  meta: ReportMeta;
}

export function buildPdfHead(): string[] {
  return [...HEADER];
}

export function buildPdfBody(rows: ReportRow[]): string[][] {
  return rows.map(rowToArray);
}

/** Baris info kop (kiri/kanan) — seam murni agar isi kop bisa di-test literal. */
export function buildInfoLines(meta: ReportMeta): { left: string[]; right: string[] } {
  return {
    left: [
      `Periode: ${meta.periode}`,
      `Institusi: ${meta.institusi}`,
      `Peserta: ${meta.peserta}`,
    ],
    right: [
      `Status: ${meta.status}`,
      `Peserta tercakup: ${meta.pesertaCount}`,
      `Dicetak: ${meta.dicetak}`,
    ],
  };
}

export function reportFilename(stamp: string): string {
  return `presensia-${stamp}.pdf`;
}

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch gagal ${res.status}: ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// Base64 font di-cache per sesi; gagal fetch = fallback Helvetica.
let fontCache: Promise<{ reg: string; bold: string } | null> | null = null;

async function ensureReportFont(doc: jsPDF): Promise<string> {
  if (!fontCache) {
    fontCache = (async () => {
      try {
        const [reg, bold] = await Promise.all([
          fetchBase64(`${FONT_BASE}/PlusJakartaSans-Regular.ttf`),
          fetchBase64(`${FONT_BASE}/PlusJakartaSans-Bold.ttf`),
        ]);
        return { reg, bold };
      } catch {
        return null;
      }
    })();
  }
  const cached = await fontCache;
  if (!cached) return "helvetica";
  doc.addFileToVFS("PlusJakartaSans-Regular.ttf", cached.reg);
  doc.addFileToVFS("PlusJakartaSans-Bold.ttf", cached.bold);
  doc.addFont("PlusJakartaSans-Regular.ttf", "PlusJakartaSans", "normal");
  doc.addFont("PlusJakartaSans-Bold.ttf", "PlusJakartaSans", "bold");
  return "PlusJakartaSans";
}

// Logo di-raster dari /logo.svg saat export (pola yang sama dengan unduh QR).
// Gagal = kop tetap dibuat tanpa logo. Di luar browser selalu null.
let logoCache: Promise<string | null> | null = null;

async function fetchLogoPng(): Promise<string | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  if (!logoCache) {
    logoCache = (async () => {
      try {
        const res = await fetch("/logo.svg");
        if (!res.ok) return null;
        const url = URL.createObjectURL(
          new Blob([await res.text()], { type: "image/svg+xml;charset=utf-8" }),
        );
        try {
          return await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const size = 192;
              const canvas = document.createElement("canvas");
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                reject(new Error("canvas tanpa context"));
                return;
              }
              ctx.drawImage(img, 0, 0, size, size);
              resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = () => reject(new Error("logo gagal dimuat"));
            img.src = url;
          });
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch {
        return null;
      }
    })();
  }
  return logoCache;
}

export async function buildPdfDocument(input: BuildPdfInput): Promise<jsPDF> {
  const { rows, summary, meta } = input;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const font = await ensureReportFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // Kop: logo + nama instansi.
  const logo = await fetchLogoPng();
  if (logo) {
    doc.addImage(logo, "PNG", margin, y, 16, 16);
  }
  const textX = margin + (logo ? 21 : 0);
  doc.setFont(font, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.ink);
  doc.text("PRESENSIA", textX, y + 6);
  doc.setFont(font, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.muted);
  doc.text("Dinas Komunikasi dan Informatika Provinsi Banten", textX, y + 11.5);
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.8);
  doc.line(margin, y + 15.5, pageWidth - margin, y + 15.5);
  y += 22;

  // Judul + blok info filter.
  doc.setFont(font, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BRAND.ink);
  doc.text("Laporan Kehadiran Peserta PKL / Magang", margin, y);
  y += 6.5;
  doc.setFont(font, "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const info = buildInfoLines(meta);
  const midX = pageWidth / 2;
  for (const [i, line] of info.left.entries()) {
    doc.text(line, margin, y + i * 4.5, { maxWidth: midX - margin - 4 });
  }
  for (const [i, line] of info.right.entries()) {
    doc.text(line, midX, y + i * 4.5, { maxWidth: pageWidth - margin - midX });
  }
  y += 3 * 4.5 + 3;

  // Kotak ringkasan.
  const items: Array<{ label: string; value: number; fill: [number, number, number] }> = [
    { label: "Total catatan", value: summary.total, fill: [240, 236, 230] },
    { label: "Hadir", value: summary.hadir, fill: [227, 236, 229] },
    { label: "Terlambat", value: summary.terlambat, fill: [248, 226, 223] },
    { label: "Izin", value: summary.izin, fill: [229, 235, 225] },
    { label: "Sakit", value: summary.sakit, fill: [248, 232, 207] },
    { label: "Tidak hadir", value: summary.tidakHadir, fill: [232, 230, 226] },
  ];
  const gap = 3;
  const boxW = (pageWidth - margin * 2 - gap * (items.length - 1)) / items.length;
  const boxH = 16;
  for (const [i, item] of items.entries()) {
    const x = margin + i * (boxW + gap);
    doc.setFillColor(...item.fill);
    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, "FD");
    doc.setFont(font, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.ink);
    doc.text(item.value.toLocaleString("id-ID"), x + 3, y + 7);
    doc.setFont(font, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND.muted);
    doc.text(item.label, x + 3, y + 12);
  }
  y += boxH + 5;

  // Tabel data.
  autoTable(doc, {
    startY: y,
    head: [buildPdfHead()],
    body: buildPdfBody(rows),
    theme: "grid",
    styles: {
      font,
      fontSize: 8,
      cellPadding: 2,
      textColor: BRAND.ink,
      lineColor: BRAND.line,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: BRAND.deep,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: BRAND.zebra },
    columnStyles: {
      5: { halign: "center" },
      6: { halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 7) {
        data.cell.styles.textColor =
          STATUS_COLORS[String(data.cell.raw ?? "")] ?? BRAND.ink;
      }
    },
    margin: { left: margin, right: margin },
  });

  // Kaki halaman di semua halaman (total halaman baru final setelah tabel).
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `Zona waktu Asia/Jakarta · Dicetak ${meta.dicetak}`,
      margin,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      `Halaman ${i} dari ${pages}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
  }

  return doc;
}

export async function downloadPdf(
  input: BuildPdfInput & { filename: string },
): Promise<void> {
  const { filename, ...rest } = input;
  const doc = await buildPdfDocument(rest);
  triggerDownload(doc.output("blob"), filename);
}
