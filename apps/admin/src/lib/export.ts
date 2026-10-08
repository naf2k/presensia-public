"use client";

/** Unduhan laporan admin dari data backend (XLSX via lib xlsx, PRD FR-017). */
import * as XLSX from "xlsx";

export interface ReportRow {
  nama: string;
  idNumber: string;
  institusi: string;
  jurusan: string;
  tanggal: string;
  masuk: string;
  pulang: string;
  status: string;
  telat: string;
  keterangan: string;
}

export const HEADER = [
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
];

export function rowToArray(r: ReportRow): string[] {
  return [
    r.nama,
    r.idNumber,
    r.institusi,
    r.jurusan,
    r.tanggal,
    r.masuk,
    r.pulang,
    r.status,
    r.telat,
    r.keterangan,
  ];
}

function toAoA(rows: ReportRow[]): string[][] {
  return [HEADER, ...rows.map(rowToArray)];
}

export function downloadXlsx(rows: ReportRow[], filename: string) {
  const sheet = XLSX.utils.aoa_to_sheet(toAoA(rows));
  sheet["!cols"] = HEADER.map(() => ({ wch: 22 }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Laporan");
  const out = XLSX.write(book, { type: "array", bookType: "xlsx" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
