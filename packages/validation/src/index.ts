/**
 * @presensia/validation — skema Zod bersama (PRD §20 spesifikasi form).
 * Dipakai lintas apps/admin & apps/mobile via React Hook Form.
 * Tidak ada request/network di sini.
 */
import { z } from "zod";
import { FORM_LIMITS } from "@presensia/constants";

/** PRD FR-001/FR-002 — login participant & admin. */
export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** PRD §20.2 — jurnal harian opsional, maks 500 karakter default. */
export const journalSchema = z.object({
  content: z
    .string()
    .max(FORM_LIMITS.journal.max, `Jurnal maksimal ${FORM_LIMITS.journal.max} karakter`)
    .optional()
    .default(""),
});

export type JournalInput = z.infer<typeof journalSchema>;

/** PRD §20.3 — pengajuan izin/sakit. */
export const leaveRequestSchema = z
  .object({
    type: z.enum(["IZIN", "SAKIT"]),
    startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
    endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
    reason: z
      .string()
      .min(FORM_LIMITS.leaveReason.min, `Alasan minimal ${FORM_LIMITS.leaveReason.min} karakter`)
      .max(FORM_LIMITS.leaveReason.max, `Alasan maksimal ${FORM_LIMITS.leaveReason.max} karakter`),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "Tanggal selesai harus >= tanggal mulai",
    path: ["endDate"],
  });

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

/** PRD §20.1 — form peserta (validasi client; unique dicek di backend tahap lanjut). */
export const participantSchema = z
  .object({
    fullName: z.string().min(FORM_LIMITS.fullName.min).max(FORM_LIMITS.fullName.max),
    studentNumber: z.string().min(FORM_LIMITS.studentNumber.min).max(FORM_LIMITS.studentNumber.max),
    participantType: z.enum(["SMK_PKL", "UNIVERSITY_INTERN"]),
    institutionId: z.string().uuid("Institusi wajib dipilih"),
    major: z.string().min(FORM_LIMITS.major.min).max(FORM_LIMITS.major.max),
    email: z.string().email("Email tidak valid"),
    phone: z.string().max(30).optional().default(""),
    startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
    endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "Tanggal selesai harus >= tanggal mulai",
    path: ["endDate"],
  });

export type ParticipantInput = z.infer<typeof participantSchema>;

/** PRD §20.4 — koreksi presensi admin (alasan wajib; eksekusi di tahap backend). */
export const correctionSchema = z.object({
  status: z.enum(["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "TIDAK_HADIR"]).optional(),
  checkInAt: z.string().optional(),
  checkOutAt: z.string().optional(),
  reason: z.string().min(1, "Alasan koreksi wajib diisi"),
});

export type CorrectionInput = z.infer<typeof correctionSchema>;

export const checkInSchema = z.object({
  photoPath: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

export const checkOutSchema = z.object({
  journalContent: z.string().max(FORM_LIMITS.journal.max).optional(),
  photoPath: z.string().min(1).max(500).optional(),
});

export type CheckOutInput = z.infer<typeof checkOutSchema>;
