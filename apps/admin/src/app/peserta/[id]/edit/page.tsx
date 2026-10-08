"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "../../../../components/layout/admin-shell";
import { Notice } from "../../../../components/ui/notice";
import { ErrorState, TableSkeleton } from "../../../../components/ui/states";
import {
  ParticipantForm,
  type ParticipantFormValues,
} from "../../../../components/participants/participant-form";
import { useParticipant } from "../../../../lib/queries";
import { formatLongDate } from "../../../../lib/format";

export default function EditPesertaPage() {
  const params = useParams<{ id: string }>();
  const detail = useParticipant(params.id);
  const p = detail.data?.participant;

  const initial: ParticipantFormValues = {
    fullName: p?.name ?? "",
    studentNumber: p?.studentNumber ?? "",
    category: p?.category ?? "",
    institution: p?.institutionId ?? "",
    major: p?.major ?? "",
    email: p?.email ?? "",
    phone: p?.phone ?? "",
    startDate: p?.periodStart ?? "",
    endDate: p?.periodEnd ?? "",
    isActive: p?.isActive ?? true,
    password: "",
  };

  return (
    <AdminShell
      withNotif={false}
      title="Edit peserta"
      subtitle={p ? `Peserta / ${p.name} / Edit` : "Peserta / Edit"}
    >
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <h2>Edit {p?.name ?? "peserta"}</h2>
            <p>Perubahan identitas dan periode akan dicatat sebagai aktivitas administratif.</p>
          </div>
          <div className="heading-actions">
            <Link className="btn-ui btn-secondary-ui" href={`/peserta/${params.id}`}>
              Kembali ke detail
            </Link>
          </div>
        </section>

        {detail.isPending ? (
          <section className="surface rise">
            <TableSkeleton rows={6} columns={2} />
          </section>
        ) : detail.isError || !p ? (
          <section className="surface rise">
            <ErrorState
              message="Tidak dapat memuat data peserta."
              onRetry={() => detail.refetch()}
            />
          </section>
        ) : (
          <>
            <div style={{ maxWidth: 1050, marginBottom: 14 }}>
              <Notice tone="warning" title="Perubahan sensitif">
                Menonaktifkan akun akan menghentikan akses login dan presensi, tetapi data historis
                tetap tersimpan.
              </Notice>
            </div>
            <ParticipantForm
              key={p.id}
              initial={initial}
              submitLabel="Simpan perubahan"
              cancelHref={`/peserta/${p.id}`}
              participantId={p.id}
              updatedLabel={
                p.updatedAt
                  ? `Terakhir diperbarui ${formatLongDate(p.updatedAt.slice(0, 10))}.`
                  : undefined
              }
            />
          </>
        )}
      </div>
    </AdminShell>
  );
}
