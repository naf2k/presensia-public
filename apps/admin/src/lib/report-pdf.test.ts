import { describe, expect, it } from "vitest";

import type { ReportRow } from "./export";
import {
  STATUS_COLORS,
  buildInfoLines,
  buildPdfBody,
  buildPdfDocument,
  buildPdfHead,
  reportFilename,
  type BuildPdfInput,
} from "./report-pdf";

const SAMPLE_ROW: ReportRow = {
  nama: "Nadia Safitri",
  idNumber: "2024001",
  institusi: "SMK Telkom",
  jurusan: "SIJA",
  tanggal: "5 Sep 2026",
  masuk: "07:25",
  pulang: "16:05",
  status: "Hadir",
  telat: "0 menit",
  keterangan: "—",
};

describe("report-pdf builders", () => {
  it("buildPdfHead mengembalikan 10 judul kolom Bahasa Indonesia", () => {
    expect(buildPdfHead()).toEqual([
      "Nama",
      "NIS / NIM",
      "Institusi",
      "Jurusan",
      "Tanggal",
      "Masuk",
      "Pulang",
      "Status",
      "Telat",
      "Keterangan",
    ]);
  });

  it("buildPdfBody memetakan baris sesuai urutan kolom", () => {
    expect(buildPdfBody([SAMPLE_ROW])).toEqual([
      ["Nadia Safitri", "2024001", "SMK Telkom", "SIJA", "5 Sep 2026", "07:25", "16:05", "Hadir", "0 menit", "—"],
    ]);
  });

  it("STATUS_COLORS mencakup semua status", () => {
    for (const status of ["Hadir", "Terlambat", "Izin", "Sakit", "Tidak hadir"]) {
      expect(STATUS_COLORS[status]).toBeDefined();
    }
  });

  it("reportFilename mengikuti pola presensia-<stamp>.pdf", () => {
    expect(reportFilename("2026-09-01_sd_2026-09-30")).toBe(
      "presensia-2026-09-01_sd_2026-09-30.pdf",
    );
  });

  it("buildInfoLines menyusun baris kop kiri/kanan dari meta", () => {
    expect(
      buildInfoLines({
        periode: "1–30 September 2026",
        institusi: "SMK Telkom",
        peserta: "Semua peserta",
        status: "Hadir",
        pesertaCount: 3,
        dicetak: "29 Sep 2026, 11.50",
      }),
    ).toEqual({
      left: ["Periode: 1–30 September 2026", "Institusi: SMK Telkom", "Peserta: Semua peserta"],
      right: ["Status: Hadir", "Peserta tercakup: 3", "Dicetak: 29 Sep 2026, 11.50"],
    });
  });
});

function sampleInput(rowCount: number): BuildPdfInput {
  const rows: ReportRow[] = Array.from({ length: rowCount }, (_, i) => ({
    ...SAMPLE_ROW,
    nama: `Peserta ${i + 1}`,
    idNumber: `2024${String(i + 1).padStart(3, "0")}`,
  }));
  return {
    rows,
    summary: { total: rowCount, hadir: rowCount, terlambat: 0, izin: 0, sakit: 0, tidakHadir: 0 },
    meta: {
      periode: "1–30 September 2026",
      institusi: "Semua institusi",
      peserta: "Semua peserta",
      status: "Semua status",
      pesertaCount: rowCount,
      dicetak: "29 Sep 2026, 11.50",
    },
  };
}

describe("buildPdfDocument", () => {
  it("menghasilkan dokumen PDF valid satu halaman untuk data kecil", async () => {
    const doc = await buildPdfDocument(sampleInput(2));
    const bytes = new Uint8Array(await doc.output("arraybuffer"));
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    expect(doc.getNumberOfPages()).toBe(1);
  }, 30000);

  it("memecah menjadi beberapa halaman untuk data besar", async () => {
    const doc = await buildPdfDocument(sampleInput(60));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  }, 30000);
});
