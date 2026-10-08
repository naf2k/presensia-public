"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AdminShell } from "../../components/layout/admin-shell";
import { LeaveStatusBadge, LeaveTypeBadge } from "../../components/ui/badges";
import { Icon } from "../../components/ui/icon";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/states";
import { Avatar } from "../../components/ui/avatar";
import { toast } from "../../components/ui/toast";
import { useLeaves, useReviewLeave, useSignedUrl } from "../../lib/queries";
import { cn } from "@presensia/utils";
import { dateInput } from "../../lib/format";
import { friendlyError } from "../../lib/errors";

type StatusTab = "PENDING" | "APPROVED" | "REJECTED";

function statusFromParam(value: string | null): StatusTab {
  if (value === "disetujui") return "APPROVED";
  if (value === "ditolak") return "REJECTED";
  return "PENDING";
}

function IzinSakitContent() {
  const searchParams = useSearchParams();
  const status = statusFromParam(searchParams.get("status"));
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [period, setPeriod] = useState(() => dateInput().slice(0, 7));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const [showInactive, setShowInactive] = useState(false);
  const list = useLeaves({ status, query, type: typeFilter, month: period, showInactive });
  const review = useReviewLeave();

  const counts = list.data?.counts ?? { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  const rows = list.data?.rows ?? [];
  const selected = rows.find((l) => l.id === selectedId) ?? rows[0];
  const selectedParticipant = selected?.participant;
  const hasDetail = Boolean(selected && selectedParticipant);
  const attachment = useSignedUrl("leave-attachments", selected?.attachmentPath ?? null);

  const decide = (decision: "APPROVED" | "REJECTED") => {
    if (!selected) return;
    review.mutate(
      { id: selected.id, decision, adminNote: note },
      {
        onSuccess: () => {
          toast.success(decision === "APPROVED" ? "Pengajuan disetujui." : "Pengajuan ditolak.");
          setSelectedId(null);
          setNote("");
        },
        onError: (error) => toast.error(friendlyError(error)),
      },
    );
  };

  const tabs = [
    {
      status: "PENDING" as StatusTab,
      href: "/izin-sakit",
      label: "Menunggu",
      count: counts.PENDING,
    },
    {
      status: "APPROVED" as StatusTab,
      href: "/izin-sakit?status=disetujui",
      label: "Disetujui",
      count: counts.APPROVED,
    },
    {
      status: "REJECTED" as StatusTab,
      href: "/izin-sakit?status=ditolak",
      label: "Ditolak",
      count: counts.REJECTED,
    },
  ];

  const subtitle =
    counts.PENDING > 0 ? `${counts.PENDING} pengajuan menunggu` : "Pengajuan peserta";

  return (
    <AdminShell title="Izin & Sakit" subtitle={subtitle}>
      <div className="page-stack">
      <section className="page-heading rise">
        <div>
          <h2>Pengajuan peserta</h2>
          <p>Tinjau alasan dan lampiran sebelum menyetujui atau menolak pengajuan.</p>
        </div>
      </section>

      <nav className="tabs" aria-label="Status pengajuan" style={{ marginBottom: 16 }}>
        {tabs.map((t) => (
          <Link
            key={t.status}
            href={t.href}
            role="tab"
            aria-selected={status === t.status}
            className={cn("tab", status === t.status && "is-active")}
          >
            {t.label}
            <span className="tab-count">{t.count}</span>
          </Link>
        ))}
      </nav>

      <div className={`review-layout ${hasDetail ? "has-detail" : "is-full"}`}>
        <section className="surface" id="pending">
          <div className="toolbar">
            <label className="toolbar-search">
              <span className="sr-only">Cari pengajuan</span>
              <Icon name="cari" />
              <input
                type="search"
                placeholder="Cari peserta atau alasan..."
                value={query}
                aria-label="Cari pengajuan"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="toolbar-filters">
              <select
                className="select-ui compact-select"
                aria-label="Tipe pengajuan"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Semua tipe</option>
                <option value="IZIN">Izin</option>
                <option value="SAKIT">Sakit</option>
              </select>
              <label className="switch" title="Tampilkan baris milik peserta nonaktif">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => {
                    setShowInactive(e.target.checked);
                  }}
                />
                <span aria-hidden="true" />
                <span className="sr-only">Tampilkan nonaktif</span>
              </label>
              <span className="table-secondary">Tampilkan nonaktif</span>
              <input
                className="input-ui compact-select"
                type="month"
                value={period}
                aria-label="Periode"
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
          </div>

          <div className="table-scroll">
            {list.isPending ? (
              <TableSkeleton rows={4} columns={6} />
            ) : list.isError ? (
              <ErrorState message="Tidak dapat memuat pengajuan." onRetry={() => list.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                title="Tidak ada pengajuan pada tab ini"
                description="Ubah kata kunci atau tipe pengajuan."
              />
            ) : (
              <table className="admin-table fixed-table" style={{ minWidth: 700 }}>
                  <colgroup>
                    <col style={{ width: 170 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 92 }} />
                    <col />
                    <col style={{ width: 104 }} />
                    <col style={{ width: 114 }} />
                    <col style={{ width: 64 }} />
                  </colgroup>
                <thead>
                  <tr>
                    <th>Peserta</th>
                    <th>Tipe</th>
                    <th>Tanggal</th>
                    <th>Alasan</th>
                    <th>Lampiran</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => {
                     const p = l.participant;
                    const active = selected?.id === l.id;
                    return (
                      <tr key={l.id} style={active ? { background: "#fdf8f5" } : undefined}>
                        <td>
                          <Link className="person" href={`/peserta/${p.id}`}>
                            <Avatar name={p.name} variant={p.avatarVariant} />
                            <div>
                              <strong>{p.name}</strong>
                              <span>{p.category === "SMK PKL" ? "SMK PKL" : "Mahasiswa"}</span>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <LeaveTypeBadge type={l.type} />
                        </td>
                        <td>
                          <span className="table-primary">{l.dateLabel}</span>
                          <span className="table-secondary">{l.durationLabel}</span>
                        </td>
                        <td>
                            <span className="table-primary clamp-1">{l.reasonShort}</span>
                        </td>
                        <td>
                          {l.attachment ? (
                            <a
                              className="text-link attachment-link"
                              href="#review"
                              title={l.attachment}
                              onClick={() => setSelectedId(l.id)}
                            >
                              <Icon name="lihat" />
                              <span>Lihat</span>
                            </a>
                          ) : (
                            <span className="table-secondary">Tidak ada</span>
                          )}
                        </td>
                        <td>
                          <LeaveStatusBadge status={l.status} />
                        </td>
                        <td>
                          <a
                            className="action-square"
                            href="#review"
                            aria-label={`Tinjau ${l.type === "IZIN" ? "izin" : "sakit"} ${p.name.split(" ")[0]}`}
                            onClick={() => setSelectedId(l.id)}
                          >
                            <Icon name="chevronRight" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="pagination">
            <span>
              {status === "PENDING"
                ? `${counts.PENDING} pengajuan menunggu keputusan`
                : status === "APPROVED"
                  ? `${counts.APPROVED} pengajuan disetujui`
                  : `${counts.REJECTED} pengajuan ditolak`}
            </span>
            <span className="table-secondary">Urut dari yang paling lama</span>
          </div>
        </section>

        {selected && selectedParticipant ? (
          <aside className="surface review-panel" id="review">
            <div className="surface-header">
              <div>
                <h3>Tinjau pengajuan</h3>
                <p>{selected.submittedLabel ?? "Diajukan peserta"}</p>
              </div>
              <LeaveStatusBadge status={selected.status} />
            </div>
            <div className="review-person">
              <Avatar name={selectedParticipant.name} variant={selectedParticipant.avatarVariant} />
              <div>
                <strong>{selectedParticipant.name}</strong>
                <small>{selectedParticipant.institution}</small>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="review-copy">
                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>Tipe</dt>
                    <dd>
                      <LeaveTypeBadge type={selected.type} />
                    </dd>
                  </div>
                  <div className="detail-row">
                    <dt>Tanggal</dt>
                    <dd>
                      {selected.dateLabel}
                    </dd>
                  </div>
                  <div className="detail-row">
                    <dt>Durasi</dt>
                    <dd>{selected.durationLabel}</dd>
                  </div>
                </dl>
                <h4 style={{ marginTop: 17 }}>Alasan peserta</h4>
                <blockquote className="reason-callout">{selected.reasonFull}</blockquote>
                <h4 style={{ marginTop: 17 }}>Lampiran</h4>
                {selected.attachment ? (
                  <button
                    className="btn-ui btn-secondary-ui"
                    type="button"
                    style={{ marginTop: 5 }}
                    aria-label={`Preview lampiran ${selected.attachment}`}
                    disabled={attachment.isPending}
                    onClick={() => {
                      if (attachment.data) window.open(attachment.data, "_blank", "noopener,noreferrer");
                      else if (attachment.isError) toast.error(friendlyError(attachment.error));
                    }}
                  >
                    <Icon name="lihat" />
                    {selected.attachment}
                  </button>
                ) : (
                  <p>Tidak ada lampiran.</p>
                )}
                <div className="field-group" style={{ marginTop: 17 }}>
                  <label htmlFor="catatan-admin">Catatan admin</label>
                  <textarea
                    className="textarea-ui"
                    id="catatan-admin"
                    name="catatan"
                    maxLength={500}
                    placeholder="Catatan opsional untuk peserta..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                {selected.status === "PENDING" ? (
                  <div className="review-actions">
                    <button
                      className="btn-ui btn-danger-ui"
                      type="button"
                      disabled={review.isPending}
                      onClick={() => decide("REJECTED")}
                    >
                      <Icon name="tutup" />
                      Tolak
                    </button>
                    <button
                      className="btn-ui btn-primary-ui"
                      type="button"
                      disabled={review.isPending}
                      onClick={() => decide("APPROVED")}
                    >
                      <Icon name="cek" />
                      Setujui
                    </button>
                  </div>
                ) : null}
              </div>
            </form>
          </aside>
        ) : null}
      </div>

      <footer className="page-footer">
        <span>Keputusan dicatat dalam audit log</span>
        <span>Lampiran bersifat privat</span>
      </footer>
      </div>
    </AdminShell>
  );
}

export default function IzinSakitPage() {
  return (
    <Suspense>
      <IzinSakitContent />
    </Suspense>
  );
}
