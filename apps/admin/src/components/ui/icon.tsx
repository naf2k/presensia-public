import type * as React from "react";

// Ikon SVG persis prototype/admin (stroke 1.8 via admin.css).
// Mempertahankan API IconName agar tidak mengubah pemakaian.
const PATHS: Record<string, React.ReactNode> = {
  dashboard: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  peserta: (
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6M23 11h-6" />
  ),
  kehadiran: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  jurnal: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" />
      <path d="M8 7h8M8 11h6" />
    </>
  ),
  izin: <path d="M20 12v8H4V4h8M16 2h6v6M11 13 22 2" />,
  laporan: <path d="M4 19V9M10 19V5M16 19v-7M22 19V2M2 19h22" />,
  pengaturan: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1.03-1.56V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.56 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
  keluar: <path d="M10 17l5-5-5-5M15 12H3M15 3h6v18h-6" />,
  lokasi: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cari: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  notif: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  chevronDown: <path d="m8 10 4 4 4-4" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  lihat: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  lainnya: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  edit: (
    <>
      <path d="m4 16-1 5 5-1L19 9l-4-4Z" />
      <path d="m13 7 4 4" />
    </>
  ),
  tambah: <path d="M12 5v14M5 12h14" />,
  unduh: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  tutup: <path d="M6 6l12 12M18 6 6 18" />,
  cek: <path d="m5 12 4 4L19 6" />,
  peringatan: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.75 3h16.1a2 2 0 0 0 1.75-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  kalender: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v15H3V6a2 2 0 0 1 2-2Z" />,
  kamera: <path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h5Z" />,
  lampiran: <path d="M8 12h8M8 8h8M8 16h5" />,
  lanjut: <path d="M5 12h14M13 6l6 6-6 6" />,
  riwayat: <path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" />,
  pengguna: <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />,
  simpan: <path d="M5 4h14v16H5zM8 4v6h8V4M8 16h8" />,
  gedung: <path d="M3 21h18M5 21V5h14v16M9 9h2M13 9h2M9 13h2M13 13h2" />,
  kunci: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  unggah: <path d="M12 16V4M7 9l5-5 5 5M4 15v5h16v-5" />,
  daftar: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  diagram: <path d="M12 21a9 9 0 1 0 0-18 7 7 0 0 1 0 18Z" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  ...props
}: { name: IconName } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      {PATHS[name]}
    </svg>
  );
}
