"use client";

import type * as React from "react";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { AttendanceStatus } from "@presensia/types";
import { AdminShell } from "../../../components/layout/admin-shell";
import { AttendanceBadge } from "../../../components/ui/badges";
import { Field, SelectInput, TextArea, TextInput } from "../../../components/ui/form";
import { Icon } from "../../../components/ui/icon";
import { Notice } from "../../../components/ui/notice";
import { ErrorState, TableSkeleton } from "../../../components/ui/states";
import { toast } from "../../../components/ui/toast";
import { initialsOf } from "../../../components/ui/avatar";
import { useAttendanceDetail, useSaveCorrection, useSignedUrl } from "../../../lib/queries";
import { formatLongDate, formatTime, localDateTime, timeInputValue } from "../../../lib/format";
import { friendlyError } from "../../../lib/errors";

export default function KehadiranDetailPage() {
  const params = useParams<{ id: string }>();
  const detail = useAttendanceDetail(params.id);
  const save = useSaveCorrection();

  const row = detail.data?.row;
  const participant = detail.data?.participant;

  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  const [copiedCoord, setCopiedCoord] = useState(false);
  const photo = useSignedUrl("attendance-photos", row?.checkInPhotoPath ?? null);
  const checkoutPhoto = useSignedUrl("attendance-photos", row?.checkOutPhotoPath ?? null);

  const durationLabel =
    !row?.checkOutAt || row.workDurationMinutes === null
      ? (row?.checkOutAt ? "—" : "Belum check-out")
      : `${Math.floor(row.workDurationMinutes / 60)} jam ${row.workDurationMinutes % 60} menit`;

  const copyCoord = async () => {
    if (row?.latitude === null || row?.longitude === null || !row) return;
    try {
      await navigator.clipboard.writeText(`${row.latitude}, ${row.longitude}`);
      setCopiedCoord(true);
      window.setTimeout(() => setCopiedCoord(false), 2000);
    } catch {
      /* clipboard tidak tersedia — biarkan tanpa umpan balik */
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!row) return;
    const value = reason.trim();
    if (value.length < 5 || value.length > 500) {
      setReasonError("Alasan koreksi 5–500 karakter dan wajib diisi.");
      toast.error("Alasan koreksi wajib diisi (5–500 karakter).");
      return;
    }
    setReasonError(undefined);
    save.mutate(
      {
        id: params.id,
        status: status ?? (row.status === "BELUM_HADIR" ? "TIDAK_HADIR" : row.status),
        checkInAt: timeInputValue(checkIn ?? row.checkIn)
          ? localDateTime(row.attendanceDate, timeInputValue(checkIn ?? row.checkIn))
          : undefined,
        checkOutAt: timeInputValue(checkOut ?? row.checkOut)
          ? localDateTime(row.attendanceDate, timeInputValue(checkOut ?? row.checkOut))
          : undefined,
        reason: value,
      },
      {
        onSuccess: () => {
          toast.success("Koreksi tersimpan dan tercatat di audit log.");
          setReason("");
        },
        onError: (error) => toast.error(friendlyError(error)),
      },
    );
  };

  return (
      <AdminShell
        title="Detail kehadiran"
        subtitle={row ? formatLongDate(row.attendanceDate) : "Detail kehadiran"}
        withNotif={false}
      >
      <div className="page-stack">
        {detail.isPending ? (
          <section className="surface rise">
            <TableSkeleton rows={6} columns={3} />
          </section>
        ) : detail.isError || !row || !participant ? (
          <section className="surface rise">
            <ErrorState
              message="Tidak dapat memuat detail kehadiran."
              onRetry={() => detail.refetch()}
            />
          </section>
        ) : (
          <>
            <Link className="text-link att-back" href="/kehadiran">
              <Icon name="chevronLeft" />
              Kembali ke daftar kehadiran
            </Link>
            <section className="att-hero rise" aria-label="Ringkasan kehadiran">
              <div className="att-hero-top">
                <span className="att-avatar" aria-hidden="true">
                  {initialsOf(participant.name)}
                </span>
                <div className="att-identity">
                  <h2>{participant.name}</h2>
                  <p>
                    {participant.institution} · {formatLongDate(row.attendanceDate)}
                  </p>
                </div>
                <div className="att-hero-side">
                  <AttendanceBadge status={row.status} />
                  <a className="btn-ui btn-secondary-ui" href="#koreksi">
                    <Icon name="edit" />
                    Koreksi presensi
                  </a>
                </div>
              </div>
              <div className="att-stats">
                <div className="att-stat">
                  <span>Masuk</span>
                  <strong>{formatTime(row.checkInAt) ?? "—"}</strong>
                </div>
                <div className="att-stat">
                  <span>Pulang</span>
                  <strong>{formatTime(row.checkOutAt) ?? "—"}</strong>
                </div>
                <div className="att-stat">
                  <span>Telat</span>
                  <strong>{row.lateMinutes} menit</strong>
                </div>
                <div className="att-stat">
                  <span>Durasi</span>
                  <strong>{durationLabel}</strong>
                </div>
              </div>
            </section>

            <div className="att-evidence">
              <div>
                    {row.checkInPhotoPath && photo.isPending ? (
                      <TableSkeleton rows={3} columns={1} />
                    ) : row.checkInPhotoPath && photo.isError ? (
                      <ErrorState
                        message="Bukti check-in tidak dapat dibuka."
                        onRetry={() => photo.refetch()}
                      />
                    ) : photo.data ? (
                      <div
                        className="photo-stage has-photo"
                        role="img"
                        aria-label={`Bukti selfie ${participant.name}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.data} alt={`Bukti selfie ${participant.name}`} />
                        <div className="photo-meta">
                          <span>Diambil {formatTime(row.checkInAt, true) ?? "-"}</span>
                          <span>
                            Akurasi GPS{" "}
                            {row.accuracyMeters === null ? "-" : `${row.accuracyMeters} m`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="photo-stage"
                        role="img"
                        aria-label={`Placeholder bukti selfie ${participant.name}`}
                        data-initials={participant.name
                          .trim()
                          .split(/\s+/)
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      >
                        <div className="photo-meta">
                          <span>Diambil {formatTime(row.checkInAt, true) ?? "-"}</span>
                          <span>
                            Akurasi GPS{" "}
                            {row.accuracyMeters === null ? "-" : `${row.accuracyMeters} m`}
                          </span>
                        </div>
                      </div>
                    )}
                {row.checkOutPhotoPath && checkoutPhoto.isPending ? (
                  <TableSkeleton rows={3} columns={1} />
                ) : row.checkOutPhotoPath && checkoutPhoto.isError ? (
                  <ErrorState
                    message="Bukti check-out tidak dapat dibuka."
                    onRetry={() => checkoutPhoto.refetch()}
                  />
                ) : checkoutPhoto.data ? (
                  <div
                    className="photo-stage has-photo att-checkout-photo"
                    role="img"
                    aria-label={`Bukti pulang ${participant.name}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={checkoutPhoto.data} alt={`Bukti pulang ${participant.name}`} />
                    <div className="photo-meta">
                      <span>Diambil {formatTime(row.checkOutAt, true) ?? "-"}</span>
                    </div>
                  </div>
                ) : row.checkOutPhotoPath ? null : (
                  <div className="pending-box">
                    <Icon name="kamera" />
                    <div>
                      <strong>Menunggu foto pulang</strong>
                      <span>Peserta belum check-out.</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="att-side">
              <section className="surface rise" style={{ "--i": 1 } as React.CSSProperties}>
                <div className="surface-header">
                  <div>
                    <h3>File bukti</h3>
                    <p>Keterangan teknis foto presensi.</p>
                  </div>
                  {row.distanceMeters !== null ? (
                    <span className="badge badge-success">Lokasi valid</span>
                  ) : null}
                </div>
                <div className="surface-body">
                  <div className="fact-list">
                    <div className="fact-row">
                      <span className="fact-medal" aria-hidden="true">
                        <Icon name="kamera" />
                      </span>
                      <span className="fact-text">
                        <span>Diambil</span>
                        <strong>{formatTime(row.checkInAt, true) ?? "-"}</strong>
                      </span>
                    </div>
                    <div className="fact-row">
                      <span className="fact-medal" aria-hidden="true">
                        <Icon name="lokasi" />
                      </span>
                      <span className="fact-text">
                        <span>Akurasi GPS</span>
                        <strong>
                          {row.accuracyMeters === null ? "-" : `${row.accuracyMeters} m`}
                        </strong>
                      </span>
                    </div>
                    <div className="fact-row">
                      <span className="fact-medal" aria-hidden="true">
                        <Icon name="cek" />
                      </span>
                      <span className="fact-text">
                        <span>Validasi lokasi</span>
                        <strong>
                          {row.distanceMeters === null
                            ? "Belum ada data"
                            : `Valid · ${Math.round(row.distanceMeters)} m dari titik`}
                        </strong>
                      </span>
                    </div>
                    <div className="fact-row">
                      <span className="fact-medal" aria-hidden="true">
                        <Icon name="info" />
                      </span>
                      <span className="fact-text">
                        <span>Koordinat</span>
                        <strong>
                          {row.latitude === null || row.longitude === null
                            ? "-"
                            : `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`}
                        </strong>
                      </span>
                      {row.latitude !== null && row.longitude !== null ? (
                        <button
                          type="button"
                          className="btn-ui btn-quiet-ui btn-compact fact-copy"
                          onClick={() => void copyCoord()}
                        >
                          {copiedCoord ? "Tersalin!" : "Salin"}
                        </button>
                      ) : null}
                    </div>
                    {row.autoAbsence ? (
                      <div className="fact-row">
                        <span className="fact-medal" aria-hidden="true">
                          <Icon name="riwayat" />
                        </span>
                        <span className="fact-text">
                          <span>Sumber</span>
                          <strong>Dibuat otomatis (penutupan hari)</strong>
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

                <section className="rise" style={{ "--i": 2 } as React.CSSProperties} aria-label="Jurnal peserta">
                  {row.journal ? (
                    <div className="journal-feature">
                      <span>
                        Jurnal peserta · {formatLongDate(row.attendanceDate)}
                      </span>
                      <p>{row.journal.content}</p>
                    </div>
                  ) : (
                    <div className="pending-box">
                      <Icon name="jurnal" />
                      <div>
                        <strong>Belum ada jurnal hari ini.</strong>
                        <span>Dapat diisi peserta sebelum check-out.</span>
                      </div>
                    </div>
                  )}
                </section>

                <p className="att-history">
                  <Icon name="riwayat" />
                  {detail.data.audit.length
                    ? `${detail.data.audit.length} koreksi tercatat · `
                    : "Belum pernah dikoreksi · "}
                  <Link className="text-link" href="/audit-log">
                    Lihat audit log
                  </Link>
                </p>
              </div>
            </div>

            <section className="surface" id="koreksi">
              <div className="surface-header">
                <div>
                  <h3>Koreksi presensi</h3>
                  <p>Gunakan hanya untuk menangani kesalahan operasional.</p>
                </div>
                <span className="badge badge-primary">Tercatat di audit log</span>
              </div>
              <form onSubmit={onSubmit} noValidate>
                <div className="surface-body">
                  <Notice tone="warning" title="Alasan koreksi wajib">
                    Nilai sebelum dan sesudah akan disimpan secara permanen pada audit log.
                  </Notice>
                  <div style={{ height: 16 }} aria-hidden="true" />
                  <div className="form-grid">
                    <Field label="Status" htmlFor="status-koreksi">
                      <SelectInput
                        id="status-koreksi"
                        value={
                          status ?? (row.status === "BELUM_HADIR" ? "TIDAK_HADIR" : row.status)
                        }
                        onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                      >
                        <option value="HADIR">Hadir</option>
                        <option value="TERLAMBAT">Terlambat</option>
                        <option value="IZIN">Izin</option>
                        <option value="SAKIT">Sakit</option>
                        <option value="TIDAK_HADIR">Tidak hadir</option>
                      </SelectInput>
                    </Field>
                    <Field label="Jam masuk" htmlFor="masuk-koreksi">
                      <TextInput
                        id="masuk-koreksi"
                        type="time"
                        value={checkIn ?? timeInputValue(row.checkIn)}
                        onChange={(e) => setCheckIn(e.target.value)}
                      />
                    </Field>
                    <Field label="Jam pulang" htmlFor="pulang-koreksi">
                      <TextInput
                        id="pulang-koreksi"
                        type="time"
                        value={checkOut ?? timeInputValue(row.checkOut)}
                        onChange={(e) => setCheckOut(e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Alasan koreksi"
                      required
                      htmlFor="alasan-koreksi"
                      full
                      error={reasonError}
                    >
                      <TextArea
                        id="alasan-koreksi"
                        minLength={5}
                        maxLength={500}
                        placeholder="Jelaskan alasan dan sumber verifikasi perubahan..."
                        value={reason}
                        aria-invalid={!!reasonError}
                        onChange={(e) => {
                          setReason(e.target.value);
                          setReasonError(undefined);
                        }}
                      />
                    </Field>
                  </div>
                </div>
                <div className="form-footer">
                  <button
                    className="btn-ui btn-secondary-ui"
                    type="reset"
                    onClick={() => setReason("")}
                  >
                    Batalkan
                  </button>
                  <button className="btn-ui btn-primary-ui" type="submit" disabled={save.isPending}>
                    {save.isPending ? "Menyimpan..." : "Simpan koreksi"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}

        <footer className="page-footer">
          <span>Foto hanya dapat diakses admin berwenang</span>
          <span>Waktu dalam WIB</span>
        </footer>
      </div>
    </AdminShell>
  );
}
