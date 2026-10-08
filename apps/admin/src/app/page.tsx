"use client";

import type * as React from "react";

import Link from "next/link";
import { useState } from "react";
import { AdminShell } from "../components/layout/admin-shell";
import { InstitutionCell, PersonCell, PhotoEvidence } from "../components/attendance/evidence";
import { StatusBadge } from "../components/ui/badges";
import { Icon } from "../components/ui/icon";
import { Pagination } from "../components/ui/pagination";
import { ErrorState, TableSkeleton } from "../components/ui/states";
import { useCloseDay, useCreateAttendance, useDashboard } from "../lib/queries";
import { useServerClock } from "../lib/use-server-clock";
import { formatLongDate, formatTime } from "../lib/format";
import { useAdminAuth } from "../lib/auth";

type Chip = "all" | "HADIR" | "TERLAMBAT" | "BELUM";

export default function DashboardPage() {
  const [chip, setChip] = useState<Chip>("all");
  const dashboard = useDashboard();
  const auth = useAdminAuth();
  const serverClock = useServerClock(dashboard.data?.serverNow, dashboard.dataUpdatedAt);
  const createAttendance = useCreateAttendance();
  const closeDay = useCloseDay();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [closeMessage, setCloseMessage] = useState("");
  const [confirmingClose, setConfirmingClose] = useState(false);
  const yesterday = dashboard.data
    ? new Date(`${dashboard.data.date}T12:00:00+07:00`).getTime() - 86_400_000
    : null;
  const yesterdayKey =
    yesterday === null
      ? null
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(yesterday));
  const closeDayTarget = (target: string) => {
    setCloseMessage("");
    setConfirmingClose(false);
    closeDay.mutate(target, {
      onSuccess: (result) =>
        setCloseMessage(`Hari ${result.date} ditutup: ${result.created} tidak hadir.`),
      onError: () => setCloseMessage("Penutupan hari gagal. Coba lagi."),
    });
  };
  const summary = dashboard.data?.summary;
  const chips: Array<{ id: Chip; label: string; count: number }> = [
    { id: "all", label: "Semua", count: summary?.active ?? 0 },
    { id: "HADIR", label: "Hadir", count: summary?.hadir ?? 0 },
    { id: "TERLAMBAT", label: "Terlambat", count: summary?.terlambat ?? 0 },
    { id: "BELUM", label: "Belum hadir", count: summary?.belumHadir ?? 0 },
  ];

  const rows = (dashboard.data?.rows ?? []).filter((r) => {
    if (chip === "all") return true;
    if (chip === "BELUM") return r.status === "BELUM_HADIR";
    return r.status === chip;
  });

  // Card dibatasi 5 baris per halaman agar tingginya sejajar panel "Perlu perhatian".
  const ATT_PAGE_SIZE = 5;
  const [attPage, setAttPage] = useState(1);
  const attPageCount = Math.max(1, Math.ceil(rows.length / ATT_PAGE_SIZE));
  const attSafePage = Math.min(attPage, attPageCount);
  const attRows = rows.slice((attSafePage - 1) * ATT_PAGE_SIZE, attSafePage * ATT_PAGE_SIZE);
  const attFrom = rows.length === 0 ? 0 : (attSafePage - 1) * ATT_PAGE_SIZE + 1;
  const attTo = Math.min(attSafePage * ATT_PAGE_SIZE, rows.length);

  return (
    <AdminShell
      title="Dashboard"
      subtitle={
        dashboard.data ? formatLongDate(dashboard.data.date) : "Memuat tanggal operasional..."
      }
      withSearch
      profileChevron
    >
      <div className="page-content">
        <section className="welcome rise">
          <div>
            <h2>Selamat datang, {auth.profile?.fullName.split(" ")[0]}.</h2>
            <p>
              {summary
                ? dashboard.data?.isWorkDay
                  ? `${summary.belumHadir} peserta belum melakukan presensi pada hari operasional ini.`
                  : "Hari ini bukan hari kerja. Tidak ada jadwal presensi."
                : "Menyiapkan ringkasan aktivitas presensi."}
            </p>
          </div>
          <div className="server-time" aria-label="Waktu server">
            <span>Waktu server</span>
            <strong>
              {formatTime(serverClock.toISOString())} <small>WIB</small>
            </strong>
          </div>
        </section>

        <section
          className="summary-strip rise"
          aria-label="Ringkasan kehadiran"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <article className="metric metric-main">
            <span className="metric-icon">
              <Icon name="peserta" />
            </span>
            <div>
              <strong>{summary?.active ?? "-"}</strong>
              <span>Peserta aktif</span>
            </div>
            <small>{summary?.endingSoon ?? 0} periode berakhir pekan ini</small>
          </article>
          <article className="metric">
            <span className="metric-symbol success">
              <Icon name="cek" />
            </span>
            <div>
              <strong>{summary?.hadir ?? "-"}</strong>
              <span>Hadir</span>
            </div>
            <small>
              {summary?.active ? Math.round((summary.hadir / summary.active) * 100) : 0}% peserta
            </small>
          </article>
          <article className="metric">
            <span className="metric-symbol warning">
              <Icon name="kehadiran" />
            </span>
            <div>
              <strong>{summary?.terlambat ?? "-"}</strong>
              <span>Terlambat</span>
            </div>
            <small>Rata-rata {summary?.averageLate ?? 0} menit</small>
          </article>
          <article className="metric">
            <span className="metric-symbol neutral">
              <Icon name="diagram" />
            </span>
            <div>
              <strong>{summary?.izinSakit ?? "-"}</strong>
              <span>Izin / Sakit</span>
            </div>
            <small>{summary?.pendingLeaves ?? 0} menunggu tinjauan</small>
          </article>
          <article className="metric">
            <span className="metric-symbol muted-symbol">
              <Icon name="info" />
            </span>
            <div>
              <strong>{summary?.belumHadir ?? "-"}</strong>
              <span>Belum hadir</span>
            </div>
            <small>Perlu ditindaklanjuti</small>
          </article>
        </section>

        <div className="dashboard-grid">
          <section className="attendance-panel rise" style={{ "--i": 2 } as React.CSSProperties}>
            <div className="section-heading">
              <div>
                <h2>Kehadiran hari ini</h2>
                <p>Data diperbarui otomatis dari presensi peserta.</p>
              </div>
              <Link className="text-link" href="/kehadiran">
                Lihat semua <Icon name="chevronRight" />
              </Link>
            </div>
            <div className="table-tools" aria-label="Filter kehadiran">
              {chips.map((c) => (
                <button
                  key={c.id}
                  className={`filter-chip${chip === c.id ? " is-active" : ""}`}
                  type="button"
                  aria-pressed={chip === c.id}
                  onClick={() => {
                    setChip(c.id);
                    setAttPage(1);
                  }}
                >
                  {c.label} <span>{c.count}</span>
                </button>
              ))}
              <Link className="filter-button" href="/kehadiran">
                <Icon name="filter" />
                Filter
              </Link>
            </div>

            <div className="attendance-table-wrap">
              {dashboard.isPending ? (
                <TableSkeleton rows={5} columns={6} />
              ) : dashboard.isError ? (
                <ErrorState
                  message="Tidak dapat memuat kehadiran hari ini."
                  onRetry={() => dashboard.refetch()}
                />
              ) : rows.length === 0 ? (
                <p style={{ padding: "22px", color: "var(--muted)", fontSize: 12 }}>
                  Tidak ada peserta pada filter ini.
                </p>
              ) : (
                <table className="attendance-table">
                  <thead>
                    <tr>
                      <th>Peserta</th>
                      <th>Institusi</th>
                      <th>Masuk</th>
                      <th>Pulang</th>
                      <th>Status</th>
                      <th>Bukti</th>
                      <th aria-label="Aksi" />
                    </tr>
                  </thead>
                  <tbody>
                    {attRows.map((r) => {
                      const p = r.participant;
                      return (
                        <tr key={r.id}>
                          <td>
                            <PersonCell participant={p} href={`/peserta/${p.id}`} />
                          </td>
                          <td>
                            <InstitutionCell participant={p} />
                          </td>
                          <td className={r.checkIn ? "time-cell" : "time-cell muted-cell"}>
                            {r.checkIn ?? "—"}
                          </td>
                          <td className="time-cell muted-cell">{r.checkOut ?? "—"}</td>
                          <td>
                            <StatusBadge status={r.status} lateMinutes={r.lateMinutes} />
                          </td>
                          <td>
                            {r.checkIn ? (
                              <PhotoEvidence
                                participant={p}
                                tone={r.photoTone}
                                path={r.checkInPhotoPath}
                              />
                            ) : (
                              <span className="no-evidence">Tidak ada</span>
                            )}
                          </td>
                          <td>
                            {r.recordId ? (
                              <Link
                                className="more-button"
                                href={`/kehadiran/${r.recordId}`}
                                aria-label={`Aksi untuk ${p.name}`}
                              >
                                <Icon name="lainnya" />
                              </Link>
                            ) : r.status === "BELUM_HADIR" ? (
                              confirmingId === r.participantId ? (
                                <button
                                  type="button"
                                  className="text-link"
                                  disabled={createAttendance.isPending}
                                  onClick={() => {
                                    setConfirmingId(null);
                                    createAttendance.mutate({
                                      participantId: r.participantId,
                                      date: r.attendanceDate,
                                      status: "TIDAK_HADIR",
                                      reason: "Ditandai tidak hadir oleh admin dari dashboard.",
                                    });
                                  }}
                                >
                                  Konfirmasi?
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="text-link"
                                  onClick={() => setConfirmingId(r.participantId)}
                                >
                                  Tandai absen
                                </button>
                              )
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <Pagination
              from={attFrom}
              to={attTo}
              total={rows.length}
              unit="peserta"
              page={attSafePage}
              pageCount={attPageCount}
              onPage={setAttPage}
            />
          </section>

          <aside
            className="attention-panel rise"
            style={{ "--i": 3 } as React.CSSProperties}
            aria-labelledby="attention-title"
          >
            <div className="attention-head">
              <div>
                <span className="attention-icon">
                  <Icon name="peringatan" />
                </span>
                <div>
                  <h2 id="attention-title">Perlu perhatian</h2>
                  <p>Ringkasan operasional terkini</p>
                </div>
              </div>
              <span className="attention-count">
                {(summary?.belumHadir ?? 0) + (summary?.pendingLeaves ?? 0)}
              </span>
            </div>
            <div className="attention-list">
              <Link className="attention-item" href="/kehadiran">
                <span className="attention-type type-warning">
                  <Icon name="peringatan" />
                </span>
                <span>
                  <strong>{summary?.belumHadir ?? 0} peserta belum hadir</strong>
                  <small>Belum memiliki catatan presensi hari ini</small>
                </span>
                <Icon name="chevronRight" className="chevron" />
              </Link>
              <Link className="attention-item" href="/izin-sakit">
                <span className="attention-type type-danger">
                  <Icon name="daftar" />
                </span>
                <span>
                  <strong>{summary?.pendingLeaves ?? 0} pengajuan menunggu</strong>
                  <small>Izin &amp; sakit belum ditinjau</small>
                </span>
                <Icon name="chevronRight" className="chevron" />
              </Link>
              <Link className="attention-item" href="/peserta">
                <span className="attention-type type-sage">
                  <Icon name="kalender" />
                </span>
                <span>
                  <strong>{summary?.endingSoon ?? 0} periode segera selesai</strong>
                  <small>Berakhir dalam 7 hari ke depan</small>
                </span>
                <Icon name="chevronRight" className="chevron" />
              </Link>
              <Link className="attention-item" href="/kehadiran?status=TERLAMBAT">
                <span className="attention-type type-neutral">
                  <Icon name="tambah" />
                </span>
                <span>
                  <strong>{summary?.terlambat ?? 0} peserta terlambat hari ini</strong>
                  <small>Rata-rata {summary?.averageLate ?? 0} menit</small>
                </span>
                <Icon name="chevronRight" className="chevron" />
              </Link>
            </div>
            <Link className="attention-link" href="/kehadiran">
              Buka pusat perhatian <Icon name="chevronRight" />
            </Link>
            <div className="operational-card">
              <div className="operational-top">
                <span className="operational-icon">
                  <Icon name="lokasi" />
                </span>
                <span>
                  <strong>Presensi operasional</strong>
                  <small>
                    {dashboard.data
                      ? `${dashboard.data.settings.location_name} · radius ${dashboard.data.settings.radius_meters} m`
                      : "Memuat konfigurasi..."}
                  </small>
                </span>
                <span className="live-indicator">
                  <i aria-hidden="true" />
                  Aktif
                </span>
              </div>
              <div className="schedule-line">
                <span>
                  Jam masuk
                  <strong>
                    {String(dashboard.data?.settings.check_in_time ?? "-").slice(0, 5)}
                  </strong>
                </span>
                <span>
                  Toleransi
                  <strong>{dashboard.data?.settings.late_tolerance_minutes ?? 0} menit</strong>
                </span>
                <span>
                  Jam pulang
                  <strong>
                    {String(dashboard.data?.settings.check_out_time ?? "-").slice(0, 5)}
                  </strong>
                </span>
              </div>
              <div className="schedule-line close-day-line">
                {confirmingClose && yesterdayKey ? (
                  <>
                    <span className="table-secondary">
                      Tutup {formatLongDate(yesterdayKey)}? Peserta tanpa presensi/izin
                      menjadi Tidak Hadir.
                    </span>
                    <span className="close-day-actions">
                      <button
                        type="button"
                        className="btn-ui btn-primary-ui btn-compact"
                        disabled={closeDay.isPending}
                        onClick={() => closeDayTarget(yesterdayKey)}
                      >
                        {closeDay.isPending ? "Menutup hari..." : "Ya, tutup hari"}
                      </button>
                      <button
                        type="button"
                        className="btn-ui btn-secondary-ui btn-compact"
                        disabled={closeDay.isPending}
                        onClick={() => setConfirmingClose(false)}
                      >
                        Batal
                      </button>
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-ui btn-secondary-ui btn-compact"
                    disabled={closeDay.isPending || yesterdayKey === null}
                    onClick={() => setConfirmingClose(true)}
                  >
                    {closeDay.isPending ? "Menutup hari..." : "Tutup hari kemarin"}
                  </button>
                )}
                {closeMessage ? <small>{closeMessage}</small> : null}
              </div>
            </div>
          </aside>
        </div>
        <footer className="page-footer">
          <span>Presensia v1.0 · Waktu ditampilkan dalam WIB</span>
          <span>Data tersinkron otomatis</span>
        </footer>
      </div>
    </AdminShell>
  );
}
