"use client";

import type * as React from "react";

import { useState } from "react";
import { AdminShell } from "../../components/layout/admin-shell";
import { AttendanceBadge } from "../../components/ui/badges";
import { Field, SelectInput, TextInput } from "../../components/ui/form";
import { Icon } from "../../components/ui/icon";
import { Notice } from "../../components/ui/notice";
import { toast } from "../../components/ui/toast";
import { downloadXlsx, type ReportRow } from "../../lib/export";
import { downloadPdf, reportFilename } from "../../lib/report-pdf";
import { useAttendance, useInstitutions, useParticipants } from "../../lib/queries";
import { dateInput } from "../../lib/format";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/states";
import type { AttendanceStatus } from "@presensia/types";

const STATUS_LABEL: Record<string, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  IZIN: "Izin",
  SAKIT: "Sakit",
  TIDAK_HADIR: "Tidak hadir",
};

function buildRows(
  records: NonNullable<ReturnType<typeof useAttendance>["data"]>["rows"],
): ReportRow[] {
  return records.map((r) => {
    const p = r.participant;
    return {
      nama: p.name,
      idNumber: p.studentNumber,
      institusi: p.institutionShort,
      jurusan: p.major,
      tanggal: r.dateLabel,
      masuk: r.checkIn ?? "—",
      pulang: r.checkOut ?? "—",
      status: STATUS_LABEL[r.status] ?? r.status,
      telat: r.checkIn ? `${r.lateMinutes} menit` : "—",
      keterangan: r.checkIn && !r.checkOut ? "Belum check-out" : (r.note ?? "—"),
    };
  });
}

export default function LaporanPage() {
  const [start, setStart] = useState(() => `${dateInput().slice(0, 7)}-01`);
  const [end, setEnd] = useState(() => dateInput());
  const [institution, setInstitution] = useState("all");
  const [participant, setParticipant] = useState("all");
  const [status, setStatus] = useState("all");
  const institutions = useInstitutions();
  const participants = useParticipants(
    { query: "", category: "all", institution: "all", status: "all", period: "all" },
    1,
    1000,
  );
  const report = useAttendance(
    { query: "", status, institution, dateFrom: start, dateTo: end },
    1,
    1000,
  );

  const records = (report.data?.rows ?? []).filter(
    (row) => participant === "all" || row.participantId === participant,
  );
  const rows = buildRows(records);
  const previewRows = rows.slice(0, 5);
  const summary = report.data?.summary;
  const participantCount = new Set(records.map((r) => r.participantId)).size;
  const rangeLabel = (() => {
    if (!start || !end) return "Pilih periode";
    const s = new Date(`${start}T12:00:00+07:00`);
    const e = new Date(`${end}T12:00:00+07:00`);
    const sameMonth = start.slice(0, 7) === end.slice(0, 7);
    const startPart = new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: sameMonth ? undefined : "long",
      timeZone: "Asia/Jakarta",
    }).format(s);
    const endPart = new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(e);
    return `${startPart}–${endPart}`;
  })();

  const rangeInvalid = Boolean(start && end && end < start);
  const exportDisabled = report.isPending || report.isError || rows.length === 0;
  const [pdfPending, setPdfPending] = useState(false);

  const findName = (items: Array<{ id: string; name: string }>, id: string): string =>
    items.find((i) => i.id === id)?.name ?? id;

  const institutionLabel =
    institution === "all" ? "Semua institusi" : findName(institutions.data ?? [], institution);
  const participantLabel =
    participant === "all" ? "Semua peserta" : findName(participants.data?.rows ?? [], participant);
  const statusFilterLabel = status === "all" ? "Semua status" : (STATUS_LABEL[status] ?? status);

  const validateExport = (): boolean => {
    if (rangeInvalid) {
      toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return false;
    }
    if (rows.length === 0) {
      toast.error("Tidak ada data untuk diekspor pada filter ini.");
      return false;
    }
    return true;
  };

  const exportPdf = async () => {
    if (!validateExport()) return;
    setPdfPending(true);
    try {
      const dicetak = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date());
      await downloadPdf({
        rows,
        summary: {
          total: summary?.total ?? 0,
          hadir: summary?.hadir ?? 0,
          terlambat: summary?.terlambat ?? 0,
          izin: summary?.izin ?? 0,
          sakit: summary?.sakit ?? 0,
          tidakHadir: summary?.tidakHadir ?? 0,
        },
        meta: {
          periode: rangeLabel,
          institusi: institutionLabel,
          peserta: participantLabel,
          status: statusFilterLabel,
          pesertaCount: participantCount,
          dicetak,
        },
        filename: reportFilename(stamp),
      });
      toast.success("File PDF diunduh.");
    } catch {
      toast.error("Gagal menyusun PDF — coba lagi.");
    } finally {
      setPdfPending(false);
    }
  };

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !end) {
      toast.error("Tanggal mulai dan selesai wajib diisi.");
      return;
    }
    if (end < start) {
      toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }
    toast.success("Parameter laporan diterapkan pada preview.");
  };

  const stamp = `${start}_sd_${end}`;

  return (
    <AdminShell title="Laporan" subtitle="Rekap kehadiran dan export" withNotif={false}>
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <h2>Buat laporan</h2>
            <p>
              Tentukan periode dan filter. Preview di bawah menunjukkan data yang akan diekspor.
            </p>
          </div>
        </section>

        <section className="surface rise" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="surface-header">
            <div>
              <h3>Parameter laporan</h3>
              <p>Tanggal mulai dan selesai wajib diisi.</p>
            </div>
          </div>
          <form onSubmit={apply} noValidate>
            <div className="surface-body">
              <div className="report-builder">
                <Field label="Mulai" htmlFor="laporan-mulai">
                  <TextInput
                    id="laporan-mulai"
                    name="mulai"
                    type="date"
                    value={start}
                    required
                    onChange={(e) => setStart(e.target.value)}
                  />
                </Field>
                <Field label="Selesai" htmlFor="laporan-selesai">
                  <TextInput
                    id="laporan-selesai"
                    name="selesai"
                    type="date"
                    value={end}
                    required
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </Field>
                <Field label="Institusi" htmlFor="laporan-institusi">
                  <SelectInput
                    id="laporan-institusi"
                    name="institusi"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                  >
                    <option value="all">Semua institusi</option>
                    {(institutions.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Peserta" htmlFor="laporan-peserta">
                  <SelectInput
                    id="laporan-peserta"
                    name="peserta"
                    value={participant}
                    onChange={(e) => setParticipant(e.target.value)}
                  >
                    <option value="all">Semua peserta</option>
                    {(participants.data?.rows ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Status" htmlFor="laporan-status">
                  <SelectInput
                    id="laporan-status"
                    name="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">Semua status</option>
                    <option value="HADIR">Hadir</option>
                    <option value="TERLAMBAT">Terlambat</option>
                    <option value="IZIN">Izin</option>
                    <option value="SAKIT">Sakit</option>
                    <option value="TIDAK_HADIR">Tidak hadir</option>
                  </SelectInput>
                </Field>
                <button className="btn-ui btn-primary-ui" type="submit">
                  <Icon name="filter" />
                  Terapkan
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="surface" id="preview">
          <div className="surface-header">
            <div>
              <h3>Preview laporan</h3>
              <p>
                {rangeLabel} · {participantCount} peserta · {rows.length} catatan
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="btn-ui btn-primary-ui"
                type="button"
                disabled={exportDisabled || pdfPending}
                onClick={exportPdf}
              >
                <Icon name="unduh" />
                {pdfPending ? "Menyusun PDF…" : "Export PDF"}
              </button>
              <button
                className="btn-ui btn-secondary-ui"
                type="button"
                disabled={exportDisabled}
                onClick={() => {
                  if (!validateExport()) return;
                  downloadXlsx(rows, `presensia-${stamp}.xlsx`);
                  toast.success("File XLSX diunduh.");
                }}
              >
                <Icon name="unduh" />
                Export XLSX
              </button>
            </div>
          </div>
          <div className="summary-band">
            <div>
              <strong>{summary?.total ?? 0}</strong>
              <span>Total catatan</span>
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
              <span>Tidak hadir</span>
            </div>
          </div>
          <div className="table-scroll">
            {report.isPending ? (
              <TableSkeleton rows={8} columns={10} />
            ) : report.isError ? (
              <ErrorState message="Tidak dapat memuat laporan." onRetry={() => report.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                title="Tidak ada data laporan"
                description="Ubah periode atau filter laporan."
              />
            ) : (
              <table className="admin-table" style={{ minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>NIS / NIM</th>
                    <th>Institusi</th>
                    <th>Jurusan</th>
                    <th>Tanggal</th>
                    <th>Masuk</th>
                    <th>Pulang</th>
                    <th>Status</th>
                    <th>Telat</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={`${r.idNumber}-${r.tanggal}-${i}`}>
                      <td>
                        <span className="table-primary">{r.nama}</span>
                      </td>
                      <td>{r.idNumber}</td>
                      <td>{r.institusi}</td>
                      <td>{r.jurusan}</td>
                      <td>{r.tanggal}</td>
                      <td>{r.masuk}</td>
                      <td>{r.pulang}</td>
                      <td>
                        <AttendanceBadge
                          status={
                            (
                              {
                                Hadir: "HADIR",
                                Terlambat: "TERLAMBAT",
                                Izin: "IZIN",
                                Sakit: "SAKIT",
                                "Tidak hadir": "TIDAK_HADIR",
                              } as Record<string, AttendanceStatus>
                            )[r.status] ?? "TIDAK_HADIR"
                          }
                        />
                      </td>
                      <td>{r.telat}</td>
                      <td>{r.keterangan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="pagination">
            <span>
              Preview {previewRows.length} dari {rows.length} catatan
              {rows.length > 5 ? " (5 baris pertama)" : ""}
            </span>
            <span className="table-secondary">File export memuat seluruh hasil filter</span>
          </div>
        </section>

        <div style={{ marginTop: 15 }}>
          <Notice tone="info" title="Format export">
            PDF (laporan resmi berkop: ringkasan + tabel) dan XLSX (data mentah) mencakup
            nama, NIS/NIM, institusi, jurusan, tanggal, jam masuk/pulang, status,
            keterlambatan, dan keterangan.
          </Notice>
        </div>

        <footer className="page-footer">
          <span>Zona waktu Asia/Jakarta</span>
          <span>PDF A4 landscape · XLSX data mentah</span>
        </footer>
      </div>
    </AdminShell>
  );
}
