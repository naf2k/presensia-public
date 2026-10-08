"use client";

import type * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Field, SelectInput, Switch, TextInput } from "../ui/form";
import { Icon } from "../ui/icon";
import { toast } from "../ui/toast";
import { useInstitutions, useSaveParticipant } from "../../lib/queries";
import { friendlyError } from "../../lib/errors";
import type { ParticipantType } from "@presensia/types";

export interface ParticipantFormValues {
  fullName: string;
  studentNumber: string;
  category: string;
  institution: string;
  major: string;
  email: string;
  phone: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  password: string;
}

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function validateParticipant(
  values: ParticipantFormValues,
): Partial<Record<keyof ParticipantFormValues, string>> {
  const errors: Partial<Record<keyof ParticipantFormValues, string>> = {};
  if (values.fullName.trim().length < 2 || values.fullName.trim().length > 100)
    errors.fullName = "Nama lengkap 2–100 karakter.";
  if (values.studentNumber.trim().length < 2 || values.studentNumber.trim().length > 50)
    errors.studentNumber = "NIS/NIM 2–50 karakter.";
  if (!values.category) errors.category = "Kategori wajib dipilih.";
  if (!values.institution) errors.institution = "Institusi wajib dipilih.";
  if (values.major.trim().length < 2 || values.major.trim().length > 100)
    errors.major = "Jurusan 2–100 karakter.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Email tidak valid.";
  if (!values.startDate) errors.startDate = "Tanggal mulai wajib diisi.";
  if (!values.endDate) errors.endDate = "Tanggal selesai wajib diisi.";
  if (values.startDate && values.endDate && values.endDate < values.startDate)
    errors.endDate = "Tanggal selesai harus >= tanggal mulai.";
  if (values.password && !PASSWORD_PATTERN.test(values.password))
    errors.password = "Min 8 karakter, huruf besar, kecil, dan angka.";
  return errors;
}

export function ParticipantForm({
  initial,
  submitLabel,
  cancelHref,
  participantId,
  showNotice,
  updatedLabel,
}: {
  initial: ParticipantFormValues;
  submitLabel: string;
  cancelHref: string;
  participantId?: string;
  showNotice?: ReactNode;
  updatedLabel?: string;
}) {
  const isEdit = participantId !== undefined;
  const router = useRouter();
  const save = useSaveParticipant();
  const institutions = useInstitutions();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ParticipantFormValues, string>>>({});
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const set = (key: keyof ParticipantFormValues, value: string | boolean) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateParticipant(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Periksa kembali isian formulir yang ditandai.");
      return;
    }
    if (isEdit && initial.isActive !== values.isActive && reason.trim().length < 5) {
      toast.error("Alasan perubahan status minimal 5 karakter.");
      return;
    }
    save.mutate(
      {
        id: participantId,
        fullName: values.fullName.trim(),
        email: values.email,
        phone: values.phone,
        institutionId: values.institution,
        participantType: (values.category === "SMK PKL"
          ? "SMK_PKL"
          : "UNIVERSITY_INTERN") as ParticipantType,
        studentNumber: values.studentNumber,
        major: values.major,
        startDate: values.startDate,
        endDate: values.endDate,
        isActive: values.isActive,
        reason,
        avatar: photo,
        password: participantId ? undefined : values.password.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          if (!participantId && result.password) {
            setCreated({ email: values.email.trim(), password: result.password });
            return;
          }
          toast.success("Perubahan peserta tersimpan.");
          router.push(`/peserta/${participantId}`);
        },
        onError: (error) => toast.error(friendlyError(error)),
      },
    );
  };

  if (created && !participantId) {
    return (
      <section className="form-shell surface">
        <div className="surface-header">
          <div>
            <h3>Akun peserta berhasil dibuat</h3>
            <p>
              Salin kredensial di bawah untuk dibagikan ke peserta. Halaman ini satu-satunya tempat
              password tampil.
            </p>
          </div>
        </div>
        <div className="surface-body">
          <div className="detail-list">
            <div className="detail-row">
              <dt>Email</dt>
              <dd style={{ fontFamily: "ui-monospace, monospace" }}>{created.email}</dd>
            </div>
            <div className="detail-row">
              <dt>Kata sandi</dt>
              <dd style={{ fontFamily: "ui-monospace, monospace" }}>{created.password}</dd>
            </div>
          </div>
          <div className="form-footer">
            <button
              className="btn-ui btn-secondary-ui"
              type="button"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(`Email: ${created.email}\nKata sandi: ${created.password}`)
                  .then(
                    () => toast.success("Kredensial tersalin."),
                    () => toast.error("Gagal menyalin."),
                  )
              }
            >
              <Icon name="unduh" />
              Salin kredensial
            </button>
            <Link className="btn-ui btn-primary-ui" href="/peserta">
              Selesai
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form className="form-shell surface" onSubmit={onSubmit} noValidate>
      {showNotice}
      <div className="form-section">
        <div className="form-section-head">
          <h3>Identitas peserta</h3>
          <p>
            {isEdit
              ? (updatedLabel ?? "Perubahan penting dicatat pada audit log beserta alasan.")
              : "Data utama yang digunakan untuk akun dan pelaporan."}
          </p>
        </div>
        <div className="form-grid">
          <Field label="Nama lengkap" required htmlFor="fullName" error={errors.fullName}>
            <TextInput
              id="fullName"
              placeholder={isEdit ? undefined : "Contoh: Nadia Safitri"}
              value={values.fullName}
              aria-invalid={!!errors.fullName}
              onChange={(e) => set("fullName", e.target.value)}
            />
          </Field>
          <Field
            label="NIS / NIM"
            required
            htmlFor="studentNumber"
            hint="Harus unik pada institusi yang sama."
            error={errors.studentNumber}
          >
            <TextInput
              id="studentNumber"
              placeholder={isEdit ? undefined : "Nomor induk peserta"}
              value={values.studentNumber}
              aria-invalid={!!errors.studentNumber}
              onChange={(e) => set("studentNumber", e.target.value)}
            />
          </Field>
          <Field label="Kategori peserta" required htmlFor="category" error={errors.category}>
            <SelectInput
              id="category"
              value={values.category}
              aria-invalid={!!errors.category}
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="">Pilih kategori</option>
              <option value="SMK PKL">SMK PKL</option>
              <option value="Mahasiswa Magang">Mahasiswa Magang</option>
            </SelectInput>
          </Field>
          <Field label="Institusi" required htmlFor="institution" error={errors.institution}>
            <SelectInput
              id="institution"
              value={values.institution}
              aria-invalid={!!errors.institution}
              onChange={(e) => set("institution", e.target.value)}
            >
              <option value="">
                {institutions.isPending ? "Memuat institusi..." : "Cari atau pilih institusi"}
              </option>
              {(institutions.data ?? [])
                .filter(
                  (item) =>
                    !values.category ||
                    item.type === (values.category === "SMK PKL" ? "SMK" : "UNIVERSITY"),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </SelectInput>
          </Field>
          <Field label="Jurusan / Program studi" required htmlFor="major" full error={errors.major}>
            <TextInput
              id="major"
              placeholder={isEdit ? undefined : "Contoh: Sistem Informasi"}
              value={values.major}
              aria-invalid={!!errors.major}
              onChange={(e) => set("major", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-head">
          <h3>Kontak dan akun</h3>
          {isEdit ? null : <p>Email menjadi identitas login peserta di aplikasi mobile.</p>}
        </div>
        <div className="form-grid">
          <Field label="Email" required htmlFor="email" error={errors.email}>
            <TextInput
              id="email"
              type="email"
              placeholder={isEdit ? undefined : "nama@email.com"}
              value={values.email}
              aria-invalid={!!errors.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Nomor HP" htmlFor="phone">
            <TextInput
              id="phone"
              type="tel"
              placeholder={isEdit ? undefined : "08xxxxxxxxxx"}
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          {isEdit ? null : (
            <Field
              label="Kata sandi awal"
              htmlFor="password"
              hint="Kosongkan untuk dibuat otomatis dan ditampilkan sekali."
              error={errors.password}
            >
              <TextInput
                id="password"
                type="text"
                autoComplete="new-password"
                placeholder="Min 8: besar, kecil, angka"
                value={values.password}
                aria-invalid={!!errors.password}
                onChange={(e) => set("password", e.target.value)}
              />
            </Field>
          )}
          {isEdit ? (
            <div className="field-group full">
              <details>
                <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 800 }}>
                  Foto profil (opsional — ubah hanya jika perlu)
                </summary>
                <div style={{ marginTop: 8 }}>
                  <label className="upload-box" htmlFor="photo">
                    <span>
                      <Icon name="unggah" />
                      <strong>{photoName ?? "Pilih foto atau letakkan file di sini"}</strong>
                      <span>JPG, PNG, atau WEBP. Maksimal 2 MB.</span>
                    </span>
                  </label>
                  <input
                    id="photo"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                        toast.error("Format foto harus JPG, PNG, atau WEBP.");
                        e.target.value = "";
                        return;
                      }
                      if (file && file.size > 2 * 1024 * 1024) {
                        toast.error("Ukuran foto maksimal 2 MB.");
                        e.target.value = "";
                        return;
                      }
                      setPhoto(file);
                      setPhotoName(file?.name ?? null);
                    }}
                  />
                </div>
              </details>
            </div>
          ) : (
            <Field label="Foto profil" full htmlFor="photo">
              <label className="upload-box" htmlFor="photo">
                <span>
                  <Icon name="unggah" />
                  <strong>{photoName ?? "Pilih foto atau letakkan file di sini"}</strong>
                  <span>JPG, PNG, atau WEBP. Maksimal 2 MB.</span>
                </span>
              </label>
              <input
                id="photo"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                    toast.error("Format foto harus JPG, PNG, atau WEBP.");
                    e.target.value = "";
                    return;
                  }
                  if (file && file.size > 2 * 1024 * 1024) {
                    toast.error("Ukuran foto maksimal 2 MB.");
                    e.target.value = "";
                    return;
                  }
                  setPhoto(file);
                  setPhotoName(file?.name ?? null);
                }}
              />
            </Field>
          )}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-head">
          <h3>{isEdit ? "Periode dan status" : "Periode PKL / Magang"}</h3>
          {isEdit ? null : <p>Peserta hanya dapat melakukan presensi selama periode aktif.</p>}
        </div>
        <div className="form-grid">
          <Field label="Tanggal mulai" required htmlFor="startDate" error={errors.startDate}>
            <TextInput
              id="startDate"
              type="date"
              value={values.startDate}
              aria-invalid={!!errors.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </Field>
          <Field label="Tanggal selesai" required htmlFor="endDate" error={errors.endDate}>
            <TextInput
              id="endDate"
              type="date"
              value={values.endDate}
              aria-invalid={!!errors.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </Field>
          <div className="field-group full">
            <Switch
              label={participantId ? "Status akun aktif" : "Aktifkan akun setelah dibuat"}
              description={
                participantId
                  ? "Matikan hanya jika periode selesai atau akses peserta perlu dihentikan."
                  : "Peserta langsung dapat login dengan kredensial yang ditampilkan."
              }
              checked={values.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              aria-label={participantId ? "Status akun aktif" : "Akun aktif"}
            />
          </div>
          {isEdit && initial.isActive !== values.isActive ? (
            <Field label="Alasan perubahan status" required htmlFor="status-reason" full>
              <TextInput
                id="status-reason"
                value={reason}
                minLength={5}
                maxLength={500}
                placeholder="Jelaskan alasan aktivasi atau penonaktifan..."
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          ) : null}
        </div>
      </div>

      <div className="form-footer">
        <Link className="btn-ui btn-secondary-ui" href={cancelHref}>
          {participantId ? "Batalkan perubahan" : "Batal"}
        </Link>
        <button className="btn-ui btn-primary-ui" type="submit" disabled={save.isPending}>
          <Icon name={participantId ? "simpan" : "cek"} />
          {save.isPending ? "Menyimpan..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "20px 22px 0" }}>{children}</div>;
}
