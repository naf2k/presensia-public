"use client";

import Link from "next/link";
import { AdminShell } from "../../../components/layout/admin-shell";
import {
  ParticipantForm,
  type ParticipantFormValues,
} from "../../../components/participants/participant-form";

const EMPTY: ParticipantFormValues = {
  fullName: "",
  studentNumber: "",
  category: "",
  institution: "",
  major: "",
  email: "",
  phone: "",
  startDate: "",
  endDate: "",
  isActive: true,
  password: "",
};

export default function TambahPesertaPage() {
  return (
    <AdminShell title="Tambah peserta" subtitle="Peserta / Tambah baru" withNotif={false}>
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <h2>Peserta baru</h2>
            <p>
              Lengkapi identitas dan periode. Kata sandi dibuat otomatis bila dikosongkan, lalu
              tampil sekali untuk dibagikan ke peserta.
            </p>
          </div>
          <div className="heading-actions">
            <Link className="btn-ui btn-secondary-ui" href="/peserta">
              Batal
            </Link>
          </div>
        </section>

        <ParticipantForm initial={EMPTY} submitLabel="Simpan peserta" cancelHref="/peserta" />
      </div>
    </AdminShell>
  );
}
