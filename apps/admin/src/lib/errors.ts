const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Sesi telah berakhir. Silakan masuk kembali.",
  FORBIDDEN: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
  ADMIN_REQUIRED: "Akun ini tidak memiliki akses administrator.",
  ACCOUNT_INACTIVE: "Akun administrator sedang nonaktif. Hubungi pengelola sistem.",
  INVALID_CREDENTIALS: "Email atau kata sandi tidak sesuai.",
  NETWORK_ERROR: "Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.",
  LOCATION_DENIED: "Izin lokasi ditolak. Aktifkan akses lokasi untuk melanjutkan.",
  LOCATION_OUTSIDE_RADIUS: "Lokasi berada di luar radius presensi yang diizinkan.",
  ALREADY_CHECKED_IN: "Presensi masuk hari ini sudah tercatat.",
  INTERNSHIP_INACTIVE: "Periode PKL atau magang peserta sedang tidak aktif.",
  UPLOAD_FAILED: "File gagal diunggah. Periksa format, ukuran, dan koneksi internet.",
  FILE_TOO_LARGE: "Ukuran file melebihi batas yang diizinkan.",
  INVALID_FILE_TYPE: "Format file tidak didukung.",
  PARTICIPANT_NOT_FOUND: "Data peserta tidak ditemukan.",
  EMAIL_ALREADY_REGISTERED: "Email ini sudah terdaftar sebagai peserta.",
  INVALID_PASSWORD:
    "Kata sandi minimal 8 karakter dan memuat huruf besar, huruf kecil, serta angka.",
  INVALID_ROW_COUNT: "File harus berisi 1–100 baris data.",
  DUPLICATE_EMAIL_IN_FILE: "Ada email ganda dalam file.",
  STUDENT_NUMBER_TAKEN: "NIS/NIM sudah terdaftar di institusi ini.",
  INVALID_STUDENT_NUMBER: "NIS 2–50 karakter.",
  INVALID_FULL_NAME: "Nama lengkap 2–100 karakter.",
  INVALID_MAJOR: "Jurusan 2–100 karakter.",
  INVALID_EMAIL: "Format email tidak valid.",
  INVALID_INSTITUTION: "Institusi tidak dikenal.",
  INVALID_DATES: "Tanggal tidak valid atau selesai sebelum mulai.",
  INVALID_PARTICIPANT_TYPE: "Kategori tidak dikenal.",
  CREATE_FAILED: "Baris gagal dibuat. Coba lagi.",
  AUTH_USER_CREATION_FAILED: "Akun login gagal dibuat. Coba lagi.",
  RATE_LIMITED: "Terlalu banyak permintaan berurutan. Tunggu ±1 menit lalu ulangi baris yang gagal.",
  INSTITUTION_NOT_FOUND: "Data institusi tidak ditemukan.",
  INSTITUTION_DUPLICATE: "Institusi dengan nama dan tipe ini sudah terdaftar.",
  ATTENDANCE_NOT_FOUND: "Catatan kehadiran tidak ditemukan.",
  LEAVE_REQUEST_NOT_FOUND: "Pengajuan tidak ditemukan.",
  LEAVE_ALREADY_REVIEWED: "Pengajuan ini sudah ditinjau oleh admin lain.",
  ATTENDANCE_ALREADY_EXISTS: "Kehadiran pada tanggal tersebut sudah tercatat.",
  REASON_REQUIRED: "Alasan perubahan wajib diisi minimal 5 karakter.",
  CORRECTION_REASON_REQUIRED: "Alasan koreksi wajib diisi minimal 5 karakter.",
  INVALID_WORK_DAYS: "Pilih minimal satu hari kerja tanpa duplikasi.",
  INTERNAL_ERROR: "Layanan sedang mengalami kendala. Silakan coba lagi.",
  BACKEND_FAILURE: "Layanan sedang mengalami kendala. Silakan coba lagi.",
};

export class AdminApiError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? MESSAGES[code] ?? MESSAGES.BACKEND_FAILURE);
  }
}

export function friendlyError(error: unknown): string {
  if (error instanceof AdminApiError) return MESSAGES[error.code] ?? error.message;
  if (
    error instanceof TypeError ||
    (error instanceof Error && /network|fetch|offline/i.test(error.message))
  ) {
    return MESSAGES.NETWORK_ERROR!;
  }
  return MESSAGES.BACKEND_FAILURE!;
}

export function normalizeError(error: unknown, fallbackCode = "BACKEND_FAILURE"): AdminApiError {
  if (error instanceof AdminApiError) return error;
  if (
    error instanceof TypeError ||
    (error instanceof Error && /network|fetch|offline/i.test(error.message))
  ) {
    return new AdminApiError("NETWORK_ERROR");
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (MESSAGES[code]) return new AdminApiError(code);
  }
  return new AdminApiError(fallbackCode);
}
