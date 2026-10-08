"use client";

import type * as React from "react";

import Link from "next/link";
import { Fragment, useState } from "react";
import { AdminShell } from "../../components/layout/admin-shell";
import { Icon, type IconName } from "../../components/ui/icon";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/states";
import { Pagination } from "../../components/ui/pagination";
import { Avatar } from "../../components/ui/avatar";
import { useAuditLogs } from "../../lib/queries";
import { formatTimestamp } from "../../lib/format";
import {
  diffChanges,
  groupDayLabel,
  humanizeEntityKind,
  shortId,
  summarizeActivity,
} from "../../lib/audit-display";
import type { AdminAudit } from "../../lib/admin-api";

function actionIcon(code: string): IconName {
  if (code.startsWith("PARTICIPANT_")) {
    if (code.includes("DEACTIVATED")) return "tutup";
    if (code.includes("REACTIVATED")) return "cek";
    if (code.includes("UPDATED")) return "edit";
    return "tambah";
  }
  if (code === "ATTENDANCE_CORRECTED") return "edit";
  if (code === "LEAVE_APPROVED") return "cek";
  if (code === "LEAVE_REJECTED") return "tutup";
  if (code === "ATTENDANCE_SETTINGS_UPDATED") return "pengaturan";
  return "riwayat";
}

function rowYmd(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function hasReason(reason: string): boolean {
  const clean = reason.trim();
  return clean !== "" && clean !== "-";
}

export default function AuditLogPage() {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useAuditLogs({ query, action, date }, page, perPage);
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const selected = rows.find((l) => l.id === selectedId) ?? rows[0];
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const todayYmd = rowYmd(new Date().toISOString());
  const changes = selected ? diffChanges(selected.beforeData, selected.afterData) : [];

  const withGroups: Array<{ group: string | null; row: AdminAudit }> = rows.map((row, i) => {
    const ymd = rowYmd(row.createdAt);
    const prevYmd = i === 0 ? null : rowYmd(rows[i - 1]?.createdAt ?? row.createdAt);
    return { group: ymd === prevYmd ? null : groupDayLabel(ymd, todayYmd), row };
  });

  return (
    <AdminShell title="Audit log" subtitle="Pengaturan / Audit log" withNotif={false}>
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <Link className="text-link" href="/pengaturan">
              <Icon name="chevronLeft" />
              Kembali ke pengaturan
            </Link>
            <h2 style={{ marginTop: 10 }}>Aktivitas administratif</h2>
            <p>Siapa melakukan apa dan kapan. Tidak dapat diubah maupun dihapus.</p>
          </div>
        </section>

        <div className="review-layout">
          <section className="surface rise" style={{ "--i": 1 } as React.CSSProperties}>
            <div className="toolbar">
              <label className="toolbar-search">
                <span className="sr-only">Cari audit log</span>
                <Icon name="cari" />
                <input
                  type="search"
                  placeholder="Cari nama, aksi, atau keterangan..."
                  value={query}
                  aria-label="Cari audit log"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <div className="toolbar-filters">
                <select
                  className="select-ui compact-select"
                  aria-label="Jenis aksi"
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua aksi</option>
                  <option value="ATTENDANCE_CORRECTED">Koreksi presensi</option>
                  <option value="LEAVE_APPROVED">Persetujuan izin</option>
                  <option value="LEAVE_REJECTED">Penolakan izin</option>
                  <option value="PARTICIPANT_UPDATED">Edit peserta</option>
                  <option value="ATTENDANCE_SETTINGS_UPDATED">Ubah pengaturan</option>
                </select>
                <input
                  className="input-ui compact-select"
                  type="date"
                  value={date}
                  aria-label="Tanggal"
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="table-scroll">
              {list.isPending ? (
                <TableSkeleton rows={5} columns={4} />
              ) : list.isError ? (
                <ErrorState
                  message="Tidak dapat memuat audit log."
                  onRetry={() => list.refetch()}
                />
              ) : rows.length === 0 ? (
                <EmptyState
                  title="Tidak ada aktivitas yang cocok"
                  description="Ubah kata kunci atau filter aksi."
                />
              ) : (
                <table className="admin-table" style={{ minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Aktivitas</th>
                      <th>Aktor</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {withGroups.map(({ group, row: l }) => {
                      const active = selected?.id === l.id;
                      return (
                        <Fragment key={l.id}>
                          {group ? (
                            <tr className="audit-date-row">
                              <td colSpan={4}>{group}</td>
                            </tr>
                          ) : null}
                          <tr key={l.id} style={active ? { background: "#fdf8f5" } : undefined}>
                            <td>
                              <span className="table-primary">{l.shortTimeLabel}</span>
                              <span className="table-secondary">WIB</span>
                            </td>
                            <td>
                              <div className="audit-activity">
                                <span className="medal-ui" aria-hidden="true">
                                  <Icon name={actionIcon(l.actionCode)} />
                                </span>
                                <span>
                                  <strong>{summarizeActivity(l)}</strong>
                                  <span className="table-secondary">
                                    {humanizeEntityKind(l.entityKind)}
                                  </span>
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="audit-event">
                                <Avatar name={l.actor} />
                                <span>
                                  <strong>{l.actor}</strong>
                                  <span className="table-secondary">{l.actorRole}</span>
                                </span>
                              </div>
                            </td>
                            <td>
                              <a
                                className="action-square"
                                href="#detail-audit"
                                aria-label={`Detail: ${summarizeActivity(l)}`}
                                onClick={() => setSelectedId(l.id)}
                              >
                                <Icon name="chevronRight" />
                              </a>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <Pagination
              from={rows.length === 0 ? 0 : (page - 1) * perPage + 1}
              to={(page - 1) * perPage + rows.length}
              total={total}
              unit="aktivitas"
              page={page}
              pageCount={pageCount}
              onPage={setPage}
              perPage={perPage}
              onPerPage={(next) => {
                setPerPage(next);
                setPage(1);
              }}
              withPrev={false}
              nextLabel="Berikutnya"
            />
          </section>

          {selected ? (
            <aside className="surface review-panel" id="detail-audit">
              <div className="surface-header">
                <div>
                  <h3>Detail perubahan</h3>
                  <p>{formatTimestamp(selected.createdAt)} WIB</p>
                </div>
                <span className="badge badge-primary">Immutable</span>
              </div>
              <div className="review-person">
                <Avatar name={selected.actor} />
                <div>
                  <strong>{selected.actor}</strong>
                  <small>{selected.actorRole}</small>
                </div>
              </div>
              <div className="review-copy">
                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>Aktivitas</dt>
                    <dd>{summarizeActivity(selected)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Jenis data</dt>
                    <dd>{humanizeEntityKind(selected.entityKind)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>ID data</dt>
                    <dd title={selected.entityId}>{shortId(selected.entityId)}</dd>
                  </div>
                  {selected.participantName ? (
                    <div className="detail-row">
                      <dt>Peserta</dt>
                      <dd>{selected.participantName}</dd>
                    </div>
                  ) : null}
                  {hasReason(selected.reason) ? (
                    <div className="detail-row">
                      <dt>Alasan</dt>
                      <dd>{selected.reason}</dd>
                    </div>
                  ) : null}
                </dl>
                <h4 style={{ marginTop: 17 }}>Perubahan data</h4>
                {changes.length === 0 ? (
                  <p className="table-secondary" style={{ margin: "8px 0 0" }}>
                    Tidak ada rincian perubahan nilai.
                  </p>
                ) : (
                  changes.map((change) => (
                    <div key={change.key} className="audit-change">
                      <span className="audit-change-label">{change.label}</span>
                      <div className="change-grid">
                        <div className="change-block">
                          <span>Sebelum</span>
                          <strong>{change.before}</strong>
                        </div>
                        <span className="change-arrow" aria-hidden="true">
                          <Icon name="chevronRight" />
                        </span>
                        <div className="change-block">
                          <span>Sesudah</span>
                          <strong>{change.after}</strong>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>
          ) : null}
        </div>

        <footer className="page-footer">
          <span>Audit log tidak dapat diedit</span>
          <span>Zona waktu WIB</span>
        </footer>
      </div>
    </AdminShell>
  );
}
