"use client";

import type * as React from "react";

import { useState } from "react";
import { AdminShell } from "../../components/layout/admin-shell";
import { ActiveBadge } from "../../components/ui/badges";
import { Field, SelectInput, Switch, TextInput } from "../../components/ui/form";
import { Icon } from "../../components/ui/icon";
import { Notice } from "../../components/ui/notice";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/states";
import { toast } from "../../components/ui/toast";
import { ScheduleEditor } from "../../components/institutions/schedule-editor";
import type { AdminInstitution } from "../../lib/admin-api";
import { friendlyError } from "../../lib/errors";
import { useInstitutionsAll, useSaveInstitution } from "../../lib/queries";

type FormState = {
  id?: string;
  name: string;
  type: "SMK" | "UNIVERSITY";
  city: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = { name: "", type: "SMK", city: "", isActive: true };

function validate(form: FormState) {
  const errors: Partial<Record<"name" | "city", string>> = {};
  if (form.name.trim().length < 2 || form.name.trim().length > 150)
    errors.name = "Nama institusi wajib 2–150 karakter.";
  if (form.city.trim().length > 100) errors.city = "Kota maksimal 100 karakter.";
  return errors;
}

export default function InstitusiPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<"name" | "city", string>>>({});

  const list = useInstitutionsAll();
  const save = useSaveInstitution();

  const rows = (list.data ?? []).filter((item) => {
    const q = query.trim().toLowerCase();
    if (q && ![item.name, item.city ?? ""].some((value) => value.toLowerCase().includes(q)))
      return false;
    if (status === "active" && !item.isActive) return false;
    if (status === "inactive" && item.isActive) return false;
    return true;
  });
  const activeTotal = (list.data ?? []).filter((item) => item.isActive).length;

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (item: AdminInstitution) => {
    setForm({
      id: item.id,
      name: item.name,
      type: item.type,
      city: item.city ?? "",
      isActive: item.isActive,
    });
    setErrors({});
    setFormOpen(true);
  };

  const editing = (list.data ?? []).find((item) => item.id === form.id) ?? null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate(
      {
        id: form.id,
        name: form.name.trim(),
        type: form.type,
        city: form.city.trim(),
        isActive: form.isActive,
      },
      {
        onSuccess: () => {
          toast.success(form.id ? "Institusi diperbarui." : "Institusi ditambahkan.");
          setFormOpen(false);
        },
        onError: (error) => toast.error(friendlyError(error)),
      },
    );
  };

  return (
    <AdminShell title="Institusi" subtitle={`${activeTotal} institusi aktif`}>
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <h2>Data institusi</h2>
            <p>Kelola sekolah dan universitas mitra PKL serta magang.</p>
          </div>
          <div className="heading-actions">
            <button className="btn-ui btn-primary-ui" type="button" onClick={openAdd}>
              <Icon name="tambah" />
              Tambah institusi
            </button>
          </div>
        </section>

        {formOpen ? (
          <section className="surface rise" style={{ "--i": 1 } as React.CSSProperties}>
            <div className="surface-header">
              <div>
                <h3>{form.id ? "Ubah institusi" : "Institusi baru"}</h3>
                <p>Nama dan tipe harus unik — satu nama tidak bisa ganda dalam tipe yang sama.</p>
              </div>
            </div>
            <form onSubmit={submit} noValidate>
              <div className="surface-body">
                <div className="form-grid">
                  <Field
                    label="Nama institusi"
                    required
                    htmlFor="institusi-nama"
                    error={errors.name}
                  >
                    <TextInput
                      id="institusi-nama"
                      name="nama"
                      value={form.name}
                      maxLength={150}
                      aria-invalid={!!errors.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="cth. SMK Negeri 1 Serang"
                    />
                  </Field>
                  <Field label="Tipe" required htmlFor="institusi-tipe">
                    <SelectInput
                      id="institusi-tipe"
                      name="tipe"
                      value={form.type}
                      onChange={(e) =>
                        setForm({ ...form, type: e.target.value as FormState["type"] })
                      }
                    >
                      <option value="SMK">SMK</option>
                      <option value="UNIVERSITY">Universitas</option>
                    </SelectInput>
                  </Field>
                  <Field label="Kota" htmlFor="institusi-kota" error={errors.city}>
                    <TextInput
                      id="institusi-kota"
                      name="kota"
                      value={form.city}
                      maxLength={100}
                      aria-invalid={!!errors.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="cth. Kota Serang"
                    />
                  </Field>
                </div>
                <Switch
                  label="Institusi aktif"
                  description="Institusi nonaktif tidak muncul di pilihan saat menambah peserta."
                  aria-label="Institusi aktif"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                {editing && !form.isActive && editing.activeInternships > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <Notice tone="warning" title="Peserta masih terhubung">
                      {editing.activeInternships} peserta aktif memakai institusi ini. Mereka tetap
                      bisa presensi, tetapi institusi tidak bisa dipilih untuk peserta baru.
                    </Notice>
                  </div>
                ) : null}
                {form.id ? (
                  <div style={{ marginTop: 16 }}>
                    <div className="form-section-head">
                      <h3>Jadwal khusus</h3>
                    </div>
                    <ScheduleEditor institutionId={form.id} institutionName={form.name} />
                  </div>
                ) : null}
                <div className="form-footer">
                  <button
                    className="btn-ui btn-secondary-ui"
                    type="button"
                    onClick={() => setFormOpen(false)}
                  >
                    Batal
                  </button>
                  <button className="btn-ui btn-primary-ui" type="submit" disabled={save.isPending}>
                    <Icon name="simpan" />
                    {save.isPending
                      ? "Menyimpan..."
                      : form.id
                        ? "Simpan perubahan"
                        : "Tambah institusi"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        ) : null}

        <section className="surface rise" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="toolbar">
            <label className="toolbar-search">
              <span className="sr-only">Cari institusi</span>
              <Icon name="cari" />
              <input
                type="search"
                placeholder="Cari nama atau kota..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Cari institusi"
              />
            </label>
            <div className="toolbar-filters">
              <select
                className="select-ui compact-select"
                aria-label="Filter status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>

          <div className="table-scroll">
            {list.isPending ? (
              <TableSkeleton rows={8} columns={5} />
            ) : list.isError ? (
              <ErrorState
                message="Tidak dapat memuat data institusi."
                onRetry={() => list.refetch()}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                title="Tidak ada institusi yang cocok"
                description="Ubah kata kunci atau filter, atau tambah institusi baru."
              />
            ) : (
              <table className="admin-table admin-table--cards">
                <thead>
                  <tr>
                    <th>Institusi</th>
                    <th>Tipe</th>
                    <th>Kota</th>
                    <th>Peserta aktif</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id} data-type={item.typeLabel}>
                      <td data-label="Institusi" className="cell-main">
                        <span className="inst-medal" aria-hidden="true">
                          <Icon name="gedung" />
                        </span>
                        <span className="inst-text">
                          <span className="table-primary">{item.name}</span>
                          <span className="table-secondary">
                            {item.city ?? "-"} · {item.typeLabel} · {item.activeInternships}{" "}
                            peserta aktif
                            {item.scheduleSummary ? ` · ${item.scheduleSummary}` : ""}
                          </span>
                        </span>
                      </td>
                      <td data-label="Tipe">{item.typeLabel}</td>
                      <td data-label="Kota">{item.city ?? "-"}</td>
                      <td data-label="Peserta aktif">{item.activeInternships}</td>
                      <td data-label="Status">
                        <ActiveBadge isActive={item.isActive} />
                      </td>
                      <td data-label="Aksi">
                        <div className="table-actions">
                          <button
                            className="action-square"
                            type="button"
                            onClick={() => openEdit(item)}
                            aria-label={`Ubah ${item.name}`}
                          >
                            <Icon name="edit" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="pagination">
            <span>
              {rows.length} dari {(list.data ?? []).length} institusi
            </span>
            <span className="table-secondary">
              Hapus tidak tersedia — nonaktifkan bila sudah tidak dipakai
            </span>
          </div>
        </section>

        <footer className="page-footer">
          <span>Perubahan institusi langsung memengaruhi pilihan pada form peserta</span>
        </footer>
      </div>
    </AdminShell>
  );
}
