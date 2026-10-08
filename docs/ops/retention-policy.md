# Kebijakan Retensi Data Presensia

Disahkan: Fase 4 (2026-09-24). Peninjauan ulang tiap perubahan kebutuhan Diskominfo.

## Prinsip

- Bukti yang sudah direferensikan catatan resmi **tidak pernah dihapus otomatis**.
- Penghapusan hanya menyentuh berkas yatim (tidak direferensikan) atau atas permintaan resmi.
- Setiap penghapusan administratif tercatat di audit log.

## Aturan

| Data                                                       | Aturan                                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Foto check-in/out yang direferensikan `attendance_records` | Disimpan permanen selama record ada; penghapusan peserta diblokir di policy Storage.                      |
| Lampiran izin yang direferensikan `leave_requests`         | Sama seperti foto absensi.                                                                                |
| Upload yatim (gagal submit / respons hilang)               | Masa tenggang 24 jam, lalu dapat dibersihkan lewat Pengaturan → Pemeliharaan atau edge `cleanup-orphans`. |
| Avatar peserta                                             | Mengikuti akun; avatar lama boleh dibersihkan saat diganti.                                               |
| `attendance_records`, `journals`, `leave_requests` | Permanen (sumber laporan dan audit). |
| `journal_revisions` | Append-only; mengikuti `journals` (ikutilah penghapusan jurnal atas permintaan resmi). |
| `audit_logs`                                               | Append-only; tidak ada penghapusan berkala.                                                               |
| `operation_log`                                            | Boleh dipangkas setelah 90 hari (hanya untuk retry, bukan bukti).                                         |
| Sesi Auth                                                  | Mengikuti expiry Supabase; revoke saat rotasi kredensial atau nonaktivasi akun.                           |

## Penghapusan atas permintaan

Permintaan resmi (mis. data pribadi) dieksekusi via SQL/edge oleh admin dengan alasan tertulis di audit log. Tidak ada endpoint publik untuk menghapus bukti.
