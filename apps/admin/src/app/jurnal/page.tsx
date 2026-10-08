"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminShell } from "../../components/layout/admin-shell";
import { Icon } from "../../components/ui/icon";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/states";
import { Pagination } from "../../components/ui/pagination";
import { Avatar } from "../../components/ui/avatar";
import { useInstitutions, useJournals } from "../../lib/queries";
import { dateInput } from "../../lib/format";


export default function JurnalPage() {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState(() => dateInput().slice(0, 7));
  const [institution, setInstitution] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showInactive, setShowInactive] = useState(false);
  const list = useJournals({ query, month: period, institution, showInactive }, page, perPage);
  const institutions = useInstitutions();
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const selected = rows.find((j) => j.id === selectedId) ?? rows[0];
  const selectedParticipant = selected?.participant;
  const hasDetail = Boolean(selected && selectedParticipant);
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  return (
    <AdminShell title="Jurnal" subtitle="Aktivitas harian peserta" withNotif={false}>
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <h2>Jurnal kegiatan</h2>
            <p>
              Jurnal bersifat opsional dan hanya dapat dibaca admin. Isi ditampilkan sebagai teks
              aman tanpa HTML.
            </p>
          </div>
        </section>

        <div className={`review-layout ${hasDetail ? "has-detail" : "is-full"}`}>
          <section className="surface">
            <div className="toolbar">
              <label className="toolbar-search">
                <span className="sr-only">Cari jurnal</span>
                <Icon name="cari" />
                <input
                  type="search"
                  placeholder="Cari peserta atau isi jurnal..."
                  value={query}
                  aria-label="Cari jurnal"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <div className="toolbar-filters">
                <input
                  className="input-ui compact-select"
                  type="month"
                  value={period}
                  aria-label="Periode"
                  onChange={(e) => setPeriod(e.target.value)}
                />
                <select
                  className="select-ui compact-select"
                  aria-label="Institusi"
                  value={institution}
                  onChange={(e) => {
                    setInstitution(e.target.value);
                    setPage(1);
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
                    setPage(1);
                  }}
                />
                <span aria-hidden="true" />
                <span className="sr-only">Tampilkan nonaktif</span>
              </label>
              <span className="table-secondary">Tampilkan nonaktif</span>
              </div>
            </div>

            <div className="table-scroll">
              {list.isPending ? (
                <TableSkeleton rows={6} columns={4} />
              ) : list.isError ? (
                <ErrorState message="Tidak dapat memuat jurnal." onRetry={() => list.refetch()} />
              ) : rows.length === 0 ? (
                <EmptyState
                  title="Tidak ada jurnal yang cocok"
                  description="Ubah kata kunci atau filter periode."
                />
              ) : (
                <table className="admin-table fixed-table" style={{ minWidth: 700 }}>
                  <colgroup>
                    <col style={{ width: 100 }} />
                    <col style={{ width: 190 }} />
                    <col style={{ width: 160 }} />
                    <col />
                    <col style={{ width: 64 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Peserta</th>
                      <th>Institusi</th>
                      <th>Ringkasan jurnal</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((j) => {
                      const p = j.participant;
                      const active = selected?.id === j.id;
                      return (
                        <tr key={j.id} style={active ? { background: "#fdf8f5" } : undefined}>
                          <td>
                            <span className="table-primary">{j.dateLabel}</span>
                            <span className="table-secondary">{j.timeLabel}</span>
                          </td>
                          <td>
                            <Link className="person" href={`/peserta/${p.id}`}>
                              <Avatar name={p.name} variant={p.avatarVariant} />
                              <div>
                                <strong>{p.name}</strong>
                                <span>{p.category === "SMK PKL" ? "SMK PKL" : "Mahasiswa"}</span>
                              </div>
                            </Link>
                          </td>
                          <td>{p.institutionShort}</td>
                          <td>
                            <span className="table-primary clamp-1">{j.excerpt}</span>
                            <span className="table-secondary">{j.charCount} karakter</span>
                          </td>
                          <td>
                            <a
                              className="action-square"
                              href="#detail-jurnal"
                              aria-label={`Baca jurnal ${p.name.split(" ")[0]}`}
                              onClick={() => setSelectedId(j.id)}
                            >
                              <Icon name="lihat" />
                            </a>
                          </td>
                        </tr>
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
              unit="jurnal"
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

          {selected && selectedParticipant ? (
            <aside className="surface review-panel" id="detail-jurnal">
              <div className="surface-header">
                <div>
                  <h3>Detail jurnal</h3>
                  <p>{selected.dateLabel}</p>
                </div>
                <span className="badge badge-success">Terisi</span>
              </div>
              <div className="review-person">
                <Avatar
                  name={selectedParticipant.name}
                  variant={selectedParticipant.avatarVariant}
                />
                <div>
                  <strong>{selectedParticipant.name}</strong>
                  <small>{selectedParticipant.institution}</small>
                </div>
              </div>
              <div className="review-copy">
                <h4>Kegiatan hari ini</h4>
                <p className="journal-content">{selected.content}</p>
                <dl className="detail-list" style={{ marginTop: 16 }}>
                  <div className="detail-row">
                    <dt>Dibuat</dt>
                    <dd>{selected.createdLabel}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Diperbarui</dt>
                    <dd>{selected.updatedLabel}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Versi</dt>
                    <dd>{selected.revisions?.length ?? 1} revisi</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Kehadiran</dt>
                    <dd>
                      {selected.attendanceId ? (
                        <Link className="text-link" href={`/kehadiran/${selected.attendanceId}`}>
                          {selected.attendanceLabel}
                        </Link>
                      ) : (
                        selected.attendanceLabel
                      )}
                    </dd>
                  </div>
                </dl>
                {(selected.revisions?.length ?? 0) > 1 ? (
                  <>
                    <h4 style={{ marginTop: 17 }}>Riwayat revisi</h4>
                    <ul style={{ marginTop: 8, display: "grid", gap: 10 }}>
                      {(selected.revisions ?? []).map((revision) => (
                        <li
                          key={revision.revisionNo}
                          className="detail-row"
                          style={{ display: "block" }}
                        >
                          <span className="table-secondary">
                            Versi {revision.revisionNo} · {revision.createdLabel}
                          </span>
                          <p className="journal-content" style={{ marginTop: 4 }}>
                            {revision.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>

        <footer className="page-footer">
          <span>Jurnal bersifat opsional</span>
          <span>Konten ditampilkan sebagai teks aman</span>
        </footer>
      </div>
    </AdminShell>
  );
}
