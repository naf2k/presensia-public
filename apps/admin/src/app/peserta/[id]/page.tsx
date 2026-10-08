"use client";

import type * as React from "react";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "../../../components/layout/admin-shell";
import { AttendanceBadge, LeaveStatusBadge, LeaveTypeBadge } from "../../../components/ui/badges";
import { Icon } from "../../../components/ui/icon";
import { ErrorState, TableSkeleton } from "../../../components/ui/states";
import { useParticipant } from "../../../lib/queries";
import { formatTimestamp } from "../../../lib/format";

export default function PesertaDetailPage() {
  const params = useParams<{ id: string }>();
  const detail = useParticipant(params.id);

  const p = detail.data?.participant;

  return (
    <AdminShell
      withNotif={false}
      title="Detail peserta"
      subtitle={p ? `Peserta / ${p.name}` : "Peserta / Detail"}
    >
      <div className="page-stack">
        {detail.isPending ? (
          <section className="surface rise">
            <TableSkeleton rows={6} columns={4} />
          </section>
        ) : detail.isError || !p ? (
          <section className="surface rise">
            <ErrorState
              message="Tidak dapat memuat detail peserta."
              onRetry={() => detail.refetch()}
            />
          </section>
        ) : (
          <>
            <section className="page-heading rise">
              <div>
                <Link className="text-link" href="/peserta">
                  <Icon name="chevronLeft" />
                  Kembali ke peserta
                </Link>
              </div>
            </section>

            <section className="surface rise" style={{ "--i": 1 } as React.CSSProperties}>
              <div className="profile-hero">
                <div className="profile-avatar" aria-hidden="true">
                  {p.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="profile-copy-lg">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <h2>{p.name}</h2>
                    <span className={`badge ${p.isActive ? "badge-success" : "badge-neutral"}`}>
                      {p.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <p>
                    {p.category} · {p.major}
                  </p>
                  <div className="profile-meta">
                    <span>
                      <Icon name="gedung" />
                      {p.institution}
                    </span>
                    <span>
                      <Icon name="kalender" />
                      {(() => {
                        const start = new Date(`${p.periodStart}T12:00:00+07:00`);
                        const end = new Date(`${p.periodEnd}T12:00:00+07:00`);
                        const startPart = new Intl.DateTimeFormat("id-ID", {
                          day: "2-digit",
                          month: "long",
                          timeZone: "Asia/Jakarta",
                        }).format(start);
                        const endPart = new Intl.DateTimeFormat("id-ID", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          timeZone: "Asia/Jakarta",
                        }).format(end);
                        return `${startPart}–${endPart}`;
                      })()}
                    </span>
                    <span>{p.category === "SMK PKL" ? `NIS ${p.studentNumber}` : `NIM ${p.studentNumber}`}</span>
                  </div>
                </div>
                <div className="profile-actions">
                  <Link className="btn-ui btn-secondary-ui" href={`/peserta/${p.id}/edit`}>
                    <Icon name="edit" />
                    Edit data
                  </Link>
                </div>
              </div>
              <div className="stat-row">
                <div className="stat-cell">
                  <strong>{detail.data.stats.total}</strong>
                  <span>Hari kerja</span>
                </div>
                <div className="stat-cell">
                  <strong>{detail.data.stats.hadir}</strong>
                  <span>Hadir</span>
                </div>
                <div className="stat-cell">
                  <strong>{detail.data.stats.terlambat}</strong>
                  <span>Terlambat</span>
                </div>
                <div className="stat-cell">
                  <strong>{detail.data.stats.izin}</strong>
                  <span>Izin</span>
                </div>
                <div className="stat-cell">
                  <strong>{detail.data.stats.sakit}</strong>
                  <span>Sakit</span>
                </div>
                <div className="stat-cell">
                  <strong>{detail.data.stats.tidakHadir}</strong>
                  <span>Tidak hadir</span>
                </div>
                <div className="stat-cell">
                  <strong>{detail.data.stats.attendanceRate}%</strong>
                  <span>Kehadiran</span>
                </div>
              </div>
            </section>

            <nav className="tabs" aria-label="Data peserta" style={{ marginTop: 18 }}>
              <a className="tab is-active" href="#kehadiran">
                Kehadiran <span className="tab-count">{detail.data.history.length}</span>
              </a>
              <a className="tab" href="#jurnal">
                Jurnal <span className="tab-count">{detail.data.journals.length}</span>
              </a>
              <a className="tab" href="#izin">
                Izin / Sakit <span className="tab-count">{detail.data.leaves.length}</span>
              </a>
            </nav>

            <section className="surface" id="kehadiran">
              <div className="surface-header">
                <div>
                  <h3>Riwayat kehadiran</h3>
                  <p>Terbaru lebih dahulu</p>
                </div>
                <Link className="btn-ui btn-secondary-ui" href="/kehadiran">
                  Semua kehadiran
                </Link>
              </div>
              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Masuk</th>
                      <th>Pulang</th>
                      <th>Status</th>
                      <th>Telat</th>
                      <th>Jurnal</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.data?.history ?? []).map((h) => (
                      <tr key={h.id}>
                        <td>
                          <span className="table-primary">{h.dateLabel}</span>
                        </td>
                        <td>{h.checkIn ?? "—"}</td>
                        <td>{h.checkOut ?? "—"}</td>
                        <td>
                          <AttendanceBadge status={h.status} />
                          {h.corrected ? (
                            <span className="corrected-mark">
                              <Icon name="edit" />
                              Dikoreksi
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {h.lateMinutes > 0
                            ? `${h.lateMinutes} menit`
                            : h.lateMinutes === 0 && h.checkIn
                              ? "0 menit"
                              : "—"}
                        </td>
                        <td>
                          <span className={`badge ${h.journalState === "Terisi" ? "badge-success" : "badge-neutral"}`}>{h.journalState}</span>
                        </td>
                        <td>
                          <Link className="text-link" href={`/kehadiran/${h.id}`}>
                            Detail
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="surface" id="jurnal">
              <div className="surface-header">
                <div>
                  <h3>Jurnal terbaru</h3>
                  <p>Catatan kegiatan yang ditulis {p.name.split(" ")[0]}.</p>
                </div>
                <Link className="text-link" href="/jurnal">
                  Lihat semua
                </Link>
              </div>
              <div className="surface-body">
                {detail.data.latestJournal ? (
                  <>
                    <p className="journal-content">{detail.data.latestJournal.content}</p>
                    <p className="table-secondary">
                      {detail.data.latestJournal.dateLabel} · diperbarui {detail.data.latestJournal.timeLabel}
                    </p>
                  </>
                ) : (
                  <p className="table-secondary">Belum ada jurnal selama periode ini.</p>
                )}
              </div>
            </section>

            <section className="surface" id="izin">
              <div className="surface-header">
                <div>
                  <h3>Pengajuan izin &amp; sakit</h3>
                  <p>Riwayat pengajuan selama periode magang.</p>
                </div>
                <Link className="text-link" href="/izin-sakit">
                  Kelola pengajuan
                </Link>
              </div>
              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tipe</th>
                      <th>Tanggal</th>
                      <th>Alasan</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.data?.leaves ?? []).map((l) => (
                      <tr key={l.id}>
                        <td>
                          <LeaveTypeBadge type={l.type} />
                        </td>
                        <td>{l.dateLabel}</td>
                        <td>{l.reasonShort}</td>
                        <td>
                          <LeaveStatusBadge status={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <footer className="page-footer">
          <span>ID peserta: {params.id}</span>
          <span>{p ? `Terakhir diperbarui ${formatTimestamp(p.updatedAt)} WIB` : ""}</span>
        </footer>
      </div>
    </AdminShell>
  );
}
