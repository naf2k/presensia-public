"use client";

import type * as React from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AdminShell } from "../../components/layout/admin-shell";
import { AttendanceBadge } from "../../components/ui/badges";
import { Icon } from "../../components/ui/icon";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/states";
import { Pagination } from "../../components/ui/pagination";
import { Avatar } from "../../components/ui/avatar";
import { PhotoEvidence } from "../../components/attendance/evidence";
import { useAttendance, useInstitutions, useOperationalContext } from "../../lib/queries";
import { useServerClock } from "../../lib/use-server-clock";
import type { AttendanceFilter } from "../../lib/admin-api";
import { dateInput, formatLongDate, formatTimestamp } from "../../lib/format";


export default function KehadiranPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(() => dateInput());
  const [dateTo, setDateTo] = useState(() => dateInput());
  const [status, setStatus] = useState(() => {
    const param = searchParams.get("status");
    return param && ["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "TIDAK_HADIR"].includes(param)
      ? param
      : "all";
  });
  const [institution, setInstitution] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [showInactive, setShowInactive] = useState(false);
  const filter: AttendanceFilter = { query, status, institution, dateFrom, dateTo, showInactive };
  const list = useAttendance(filter, page, perPage);
  const institutions = useInstitutions();
  const clock = useOperationalContext();
  const serverClock = useServerClock(clock.data?.serverNow, clock.dataUpdatedAt, 30_000);

  const resetPage = () => setPage(1);
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const from = rows.length === 0 ? 0 : (page - 1) * perPage + 1;
  const to = (page - 1) * perPage + rows.length;
  const summary = list.data?.summary;

  return (
    <AdminShell
      title="Kehadiran"
      subtitle={
        dateFrom === dateTo
          ? formatLongDate(dateFrom)
          : `${formatLongDate(dateFrom)} - ${formatLongDate(dateTo)}`
      }
    >
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <h2>Data kehadiran</h2>
            <p>
              Telusuri bukti foto, validasi lokasi, keterlambatan, dan riwayat koreksi seluruh
              peserta.
            </p>
          </div>
          <div className="heading-actions">
            <Link className="btn-ui btn-secondary-ui" href="/laporan">
              <Icon name="unduh" />
              Export data
            </Link>
          </div>
        </section>

        <section className="surface rise" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="toolbar">
            <label className="toolbar-search">
              <span className="sr-only">Cari peserta</span>
              <Icon name="cari" />
              <input
                type="search"
                placeholder="Cari nama, NIS, atau NIM..."
                value={query}
                aria-label="Cari peserta"
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPage();
                }}
              />
            </label>
            <div className="toolbar-filters">
              <input
                className="input-ui compact-select"
                type="date"
                value={dateFrom}
                aria-label="Tanggal mulai"
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  resetPage();
                }}
              />
              <span className="table-secondary">sampai</span>
              <input
                className="input-ui compact-select"
                type="date"
                value={dateTo}
                aria-label="Tanggal selesai"
                onChange={(e) => {
                  setDateTo(e.target.value);
                  resetPage();
                }}
              />
              <select
                className="select-ui compact-select"
                aria-label="Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  resetPage();
                }}
              >
                <option value="all">Semua status</option>
                <option value="HADIR">Hadir</option>
                <option value="TERLAMBAT">Terlambat</option>
                <option value="IZIN">Izin</option>
                <option value="SAKIT">Sakit</option>
                <option value="TIDAK_HADIR">Tidak hadir</option>
              </select>
              <select
                className="select-ui compact-select"
                aria-label="Institusi"
                value={institution}
                onChange={(e) => {
                  setInstitution(e.target.value);
                  resetPage();
                }}
              >
                <option value="all">Semua institusi</option>
                {(institutions.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <label className="switch" title="Tampilkan baris milik peserta nonaktif">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => {
                    setShowInactive(e.target.checked);
                    resetPage();
                  }}
                />
                <span aria-hidden="true" />
                <span className="sr-only">Tampilkan nonaktif</span>
              </label>
              <span className="table-secondary">Tampilkan nonaktif</span>
            </div>
          </div>

          <div className="summary-band">
            <div>
              <strong>{summary?.total ?? 0}</strong>
              <span>Peserta</span>
            </div>
            <div>
              <strong>{summary?.hadir ?? 0}</strong>
              <span>Hadir</span>
            </div>
            <div>
              <strong>{summary?.terlambat ?? 0}</strong>
              <span>Terlambat</span>
            </div>
            <div>
              <strong>{summary?.izin ?? 0}</strong>
              <span>Izin</span>
            </div>
            <div>
              <strong>{summary?.sakit ?? 0}</strong>
              <span>Sakit</span>
            </div>
            <div>
              <strong>{summary?.tidakHadir ?? 0}</strong>
              <span>Belum hadir</span>
            </div>
          </div>

          <div className="table-scroll">
            {list.isPending ? (
              <TableSkeleton rows={8} columns={8} />
            ) : list.isError ? (
              <ErrorState
                message="Tidak dapat memuat data kehadiran."
                onRetry={() => list.refetch()}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                title="Tidak ada catatan yang cocok"
                description="Ubah kata kunci, rentang tanggal, atau filter."
              />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Peserta</th>
                    <th>Institusi</th>
                    <th>Masuk</th>
                    <th>Pulang</th>
                    <th>Status</th>
                    <th>Telat</th>
                    <th>Foto</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const p = r.participant;
                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="table-primary">{r.dateLabel}</span>
                          {r.weekdayLabel ? (
                            <span className="table-secondary">{r.weekdayLabel}</span>
                          ) : null}
                        </td>
                        <td>
                          <Link className="person" href={`/peserta/${p.id}`}>
                            <Avatar name={p.name} variant={p.avatarVariant} />
                            <div>
                              <strong>{p.name}</strong>
                              <span>{p.studentNumber}</span>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <span className="table-primary">{p.institutionShort}</span>
                          <span className="table-secondary">
                            {p.category === "SMK PKL" ? "SMK PKL" : "Mahasiswa"}
                          </span>
                        </td>
                        <td>{r.checkIn ?? "—"}</td>
                        <td>{r.checkOut ?? "—"}</td>
                        <td>
                          <AttendanceBadge status={r.status} />
                          {r.corrected ? (
                            <span className="corrected-mark">
                              <Icon name="edit" />
                              Dikoreksi
                            </span>
                          ) : null}
                        </td>
                        <td>{r.checkIn ? `${r.lateMinutes} menit` : "—"}</td>
                        <td>
                          {r.checkIn ? (
                            <PhotoEvidence
                              participant={p}
                              tone={r.photoTone}
                              path={r.checkInPhotoPath}
                              variant="thumb"
                            />
                          ) : (
                            <span className="table-secondary">Tidak ada</span>
                          )}
                        </td>
                        <td>
                          <div className="table-actions">
                            <Link
                              className="action-square"
                              href={`/kehadiran/${r.id}`}
                              aria-label={`Detail kehadiran ${p.name.split(" ")[0]}`}
                            >
                              <Icon name="lihat" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            from={from}
            to={to}
            total={total}
            unit="catatan"
            page={Math.min(page, pageCount)}
            pageCount={pageCount}
            onPage={setPage}
            perPage={perPage}
            onPerPage={(next) => {
              setPerPage(next);
              setPage(1);
            }}
            prevLabel="Sebelumnya"
            nextLabel="Berikutnya"
          />
        </section>

        <footer className="page-footer">
          <span>Semua waktu dalam WIB</span>
          <span>
            {clock.data
              ? `Waktu server ${formatTimestamp(serverClock.toISOString())}`
              : "Menghubungkan ke waktu server..."}
          </span>
        </footer>
      </div>
    </AdminShell>
  );
}
