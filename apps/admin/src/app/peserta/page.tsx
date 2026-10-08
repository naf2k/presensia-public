"use client";

import type * as React from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AdminShell } from "../../components/layout/admin-shell";
import { ActiveBadge } from "../../components/ui/badges";
import { Icon } from "../../components/ui/icon";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/states";
import { Pagination } from "../../components/ui/pagination";
import { Avatar } from "../../components/ui/avatar";
import { useInstitutions, useParticipants } from "../../lib/queries";
import type { ParticipantFilter } from "../../lib/admin-api";

export default function PesertaPage() {
  return (
    <Suspense>
      <PesertaList />
    </Suspense>
  );
}

function PesertaList() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("query") ?? "");
  const [category, setCategory] = useState("all");
  const [institution, setInstitution] = useState("all");
  const [status, setStatus] = useState("active");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const filter: ParticipantFilter = { query, category, institution, status, period };
  const list = useParticipants(filter, page, perPage);
  const institutions = useInstitutions();

  const resetPage = () => setPage(1);
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const from = rows.length === 0 ? 0 : (page - 1) * perPage + 1;
  const to = (page - 1) * perPage + rows.length;

  return (
    <AdminShell title="Peserta" subtitle={`${list.data?.activeTotal ?? 0} peserta aktif`}>
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <h2>Data peserta</h2>
            <p>Kelola identitas, institusi, periode, dan status akun peserta PKL serta magang.</p>
          </div>
          <div className="heading-actions">
            <Link className="btn-ui btn-secondary-ui" href="/peserta/import">
              <Icon name="unduh" />
              Import XLSX
            </Link>
            <Link className="btn-ui btn-primary-ui" href="/peserta/tambah">
              <Icon name="tambah" />
              Tambah peserta
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
                placeholder="Cari nama, NIS/NIM, atau email..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPage();
                }}
                aria-label="Cari peserta"
              />
            </label>
            <div className="toolbar-filters">
              <select
                className="select-ui compact-select"
                aria-label="Filter kategori"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  resetPage();
                }}
              >
                <option value="all">Semua kategori</option>
                <option value="SMK PKL">SMK PKL</option>
                <option value="Mahasiswa Magang">Mahasiswa</option>
              </select>
              <select
                className="select-ui compact-select"
                aria-label="Filter institusi"
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
              <select
                className="select-ui compact-select"
                aria-label="Filter status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  resetPage();
                }}
              >
                <option value="all">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
              <select
                className="select-ui compact-select"
                aria-label="Filter periode"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  resetPage();
                }}
              >
                <option value="all">Semua periode</option>
                <option value="active">Periode berjalan</option>
                <option value="ended">Periode selesai</option>
              </select>
            </div>
          </div>

          <div className="table-scroll">
            {list.isPending ? (
              <TableSkeleton rows={8} columns={6} />
            ) : list.isError ? (
              <ErrorState
                message="Tidak dapat memuat data peserta."
                onRetry={() => list.refetch()}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                title="Tidak ada peserta yang cocok"
                description="Ubah kata kunci atau filter untuk menemukan peserta lain."
              />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Peserta</th>
                    <th>NIS / NIM</th>
                    <th>Kategori</th>
                    <th>Institusi</th>
                    <th>Periode</th>
                    <th>Status</th>
                    <th aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link className="person" href={`/peserta/${p.id}`}>
                          <Avatar name={p.name} variant={p.avatarVariant} />
                          <div>
                            <strong>{p.name}</strong>
                            <span>{p.email}</span>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <span className="table-id">{p.studentNumber}</span>
                      </td>
                      <td>{p.category}</td>
                      <td>
                        <span className="table-primary">{p.institutionShort}</span>
                        <span className="table-secondary">{p.major}</span>
                      </td>
                      <td>
                        <span className="table-primary">{p.periodLabel}</span>
                        <span className="table-secondary">{p.remainingLabel}</span>
                      </td>
                      <td>
                        <ActiveBadge isActive={p.isActive} endingSoon={p.endingSoon} />
                      </td>
                      <td>
                        <div className="table-actions">
                          <Link
                            className="action-square"
                            href={`/peserta/${p.id}`}
                            aria-label={`Detail ${p.name.split(" ")[0]}`}
                          >
                            <Icon name="lihat" />
                          </Link>
                          <Link
                            className="action-square"
                            href={`/peserta/${p.id}/edit`}
                            aria-label={`Edit ${p.name.split(" ")[0]}`}
                          >
                            <Icon name="edit" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            from={from}
            to={to}
            total={total}
            unit="peserta"
            page={Math.min(page, pageCount)}
            pageCount={pageCount}
            onPage={setPage}
            perPage={perPage}
            onPerPage={(next) => {
              setPerPage(next);
              setPage(1);
            }}
          />
        </section>

        <footer className="page-footer">
          <span>Presensia v1.0 · Data peserta</span>
          <span>20 baris per halaman</span>
        </footer>
      </div>
    </AdminShell>
  );
}
