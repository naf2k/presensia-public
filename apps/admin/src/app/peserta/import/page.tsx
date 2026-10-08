"use client";

import type * as React from "react";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AdminShell } from "../../../components/layout/admin-shell";
import { Field, SelectInput, TextInput } from "../../../components/ui/form";
import { Icon } from "../../../components/ui/icon";
import { Notice } from "../../../components/ui/notice";
import { toast } from "../../../components/ui/toast";
import { AdminApiError, friendlyError } from "../../../lib/errors";
import {
  MAX_IMPORT_ROWS,
  mapImportTable,
  matchPhotoStems,
  matchPhotosByName,
  mergeRowWithBatch,
  photoStem,
  validateImportRows,
  type ImportBatchDefaults,
  type ImportDraftRow,
  type ImportRowExtras,
  type MergedImportRow,
} from "../../../lib/import-validation";
import { adminApi } from "../../../lib/admin-api";
import { useImportParticipants, useInstitutions } from "../../../lib/queries";

interface RowPhoto {
  file: File;
  url: string;
  matchedBy: "nis" | "nama" | "manual";
}

interface PreviewRow extends ImportDraftRow {
  photo: RowPhoto | null;
  extras: ImportRowExtras;
}

interface EnrichedRow extends PreviewRow {
  merged: MergedImportRow;
  mergeErrors: string[];
  error: string;
  fromFile: { institution: boolean; category: boolean; dates: boolean };
}

interface CreatedRow {
  email: string;
  password: string;
  photoOk: boolean;
  photoError: string;
}

const ACCEPTED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);

async function shrinkPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!blob) return file;
  const stem = photoStem(file.name) || "foto";
  return new File([blob], `${stem}.jpg`, { type: "image/jpeg" });
}

function downloadTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["NIS", "Nama Lengkap", "Jurusan", "Email", "No HP", "Institusi", "Kategori", "Tgl Mulai", "Tgl Selesai"],
    ["2024001", "Nadia Safitri", "Rekayasa Perangkat Lunak", "nadia@mail.com", "0812000001", "", "", "", ""],
  ]);
  sheet["!cols"] = [
    { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 15 },
    { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
  ];
  const note = XLSX.utils.aoa_to_sheet([
    ["Catatan: 4 kolom terakhir opsional — kosongkan untuk ikut paket di atas. Institusi wajib persis (copy-paste). Kategori: SMK PKL / Mahasiswa Magang. Tanggal: YYYY-MM-DD."],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Siswa");
  XLSX.utils.book_append_sheet(book, note, "Baca dulu");
  XLSX.writeFile(book, "template-import-peserta.xlsx");
}

export default function ImportPesertaPage() {
  const institutions = useInstitutions();
  const importBatch = useImportParticipants();
  const [institution, setInstitution] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [headerError, setHeaderError] = useState("");
  const [results, setResults] = useState<CreatedRow[] | null>(null);
  const [failed, setFailed] = useState<Array<{ email: string; code: string }>>([]);
  const [progress, setProgress] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const rowPhotoInputs = useRef(new Map<number, HTMLInputElement>());

  const busy = importBatch.isPending || progress !== "";
  const applyPhotos = (files: File[], base: PreviewRow[]) => {
    const images = files.filter((file) => ACCEPTED_IMAGE.has(file.type));
    if (images.length < files.length)
      toast.error("Sebagian file bukan JPG/PNG/WEBP dan dilewati.");
    // Prioritas: NIS dulu, lalu nama (tanpa menebak yang kembar).
    const byNis = matchPhotoStems(
      base.map((row) => row.nis),
      images.map((file) => file.name),
    );
    const used = new Set(byNis.values());
    const remaining = base.filter((row) => !byNis.has(row.nis));
    const byName = matchPhotosByName(
      remaining.map((row) => ({ nis: row.nis, nama: row.nama })),
      images.filter((file) => !used.has(file.name)).map((file) => file.name),
    );
    const lookup = new Map<string, File>();
    for (const file of images) lookup.set(file.name, file);
    return base.map((row) => {
      const nisName = byNis.get(row.nis);
      if (nisName) {
        const file = lookup.get(nisName);
        return {
          ...row,
          photo: file ? { file, url: URL.createObjectURL(file), matchedBy: "nis" as const } : row.photo,
        };
      }
      const namaName = byName.get(row.nis);
      if (namaName) {
        const file = lookup.get(namaName);
        return {
          ...row,
          photo: file ? { file, url: URL.createObjectURL(file), matchedBy: "nama" as const } : row.photo,
        };
      }
      return row;
    });
  };

  const recompute = (next: PreviewRow[]) => {
    setRows(next);
  };

  const batch: ImportBatchDefaults = {
    institutionId: institution,
    participantType: category === "" ? "" : category === "SMK PKL" ? "SMK_PKL" : "UNIVERSITY_INTERN",
    startDate,
    endDate,
  };

  const institutionChoices = useMemo(
    () =>
      (institutions.data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
      })),
    [institutions.data],
  );

  const institutionName = (id: string) =>
    institutionChoices.find((item) => item.id === id)?.name ?? "—";

  const enriched: EnrichedRow[] = useMemo(() => {
    const messages = validateImportRows(rows);
    return rows.map((row, index) => {
      const merged = mergeRowWithBatch(
        { institusi: row.extras.institusi, kategori: row.extras.kategori, mulai: row.extras.mulai, selesai: row.extras.selesai },
        batch,
        institutionChoices,
      );
      const mergeErrors = merged.errors;
      const base = messages[index] ?? "";
      return {
        ...row,
        merged: merged.value,
        mergeErrors,
        error: [base, ...mergeErrors].filter(Boolean).join("; "),
        fromFile: {
          institution: row.extras.institusi !== "",
          category: row.extras.kategori !== "",
          dates: row.extras.mulai !== "" || row.extras.selesai !== "",
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, institution, category, startDate, endDate, institutions.data]);

  const onXlsx = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    try {
      const buffer = await file.arrayBuffer();
      const book = XLSX.read(buffer, { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]!];
      if (!sheet) {
        setHeaderError("Sheet pertama tidak ditemukan.");
        setRows([]);
        return;
      }
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      setHeaderError("");
      const table = mapImportTable(grid);
      if ("error" in table) {
        setHeaderError(table.error);
        setRows([]);
        return;
      }
      recompute(
        table.rows.map((row) => ({ ...row, photo: null })),
      );
    } catch {
      setHeaderError("File tidak dapat dibaca. Gunakan template XLSX.");
      setRows([]);
    }
  };

  const onPhotos = (files: File[]) => {
    if (!files.length) return;
    setResults(null);
    setRows((current) => applyPhotos(files, current));
  };

  const attachRowPhoto = (index: number, file: File | undefined) => {
    if (!file || !ACCEPTED_IMAGE.has(file.type)) {
      toast.error("Format foto harus JPG, PNG, atau WEBP.");
      return;
    }
    setRows((current) =>
      current.map((row, i) =>
        i === index
          ? { ...row, photo: { file, url: URL.createObjectURL(file), matchedBy: "manual" as const } }
          : row,
      ),
    );
  };

  const validRows = useMemo(() => enriched.filter((row) => !row.error), [enriched]);
  const invalidRows = useMemo(() => enriched.filter((row) => row.error), [enriched]);

  const canSubmit = !busy && validRows.length > 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    runSubmit();
  };

  const runSubmit = () => {
    if (!canSubmit) {
      toast.error(
        !validRows.length
          ? "Tidak ada baris valid untuk dibuat."
          : "Lengkapi batch atau kolom per baris yang ditandai.",
      );
      return;
    }
    setFailed([]);
    setResults(null);
    importBatch.mutate(
      {
        institutionId: institution,
        participantType:
          category === "" ? undefined : category === "SMK PKL" ? "SMK_PKL" : "UNIVERSITY_INTERN",
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        rows: validRows.map((row) => ({
          studentNumber: row.nis,
          fullName: row.nama,
          major: row.jurusan,
          email: row.email,
          phone: row.hp,
          // Baris institusi-baru hanya kirim newInstitution (tanpa id
          // fallback) agar edge tidak salah pakai id batch.
          institutionId:
            row.merged.newInstitution || !row.fromFile.institution
              ? undefined
              : row.merged.institutionId,
          participantType: row.fromFile.category ? row.merged.participantType : undefined,
          startDate: row.fromFile.dates && row.extras.mulai ? row.merged.startDate : undefined,
          endDate: row.fromFile.dates && row.extras.selesai ? row.merged.endDate : undefined,
          newInstitution: row.merged.newInstitution,
        })),
      },
      {
        onSuccess: async (result) => {
          const byEmail = new Map(validRows.map((row) => [row.email.toLowerCase(), row]));
          const created: CreatedRow[] = [];
          let done = 0;
          for (const item of result.succeeded) {
            done += 1;
            setProgress(`Mengunggah foto ${done}/${result.succeeded.length}...`);
            const draft = byEmail.get(item.email.toLowerCase());
            let photoOk = false;
            let photoError = "";
            if (draft?.photo) {
              try {
                const small = await shrinkPhoto(draft.photo.file);
                await adminApi.uploadAvatar(item.participantId, small);
                photoOk = true;
              } catch {
                photoError = "Foto gagal diunggah; tambah manual dari detail peserta.";
              }
            }
            created.push({ email: item.email, password: item.password, photoOk, photoError });
          }
          setProgress("");
          setResults(created);
          setFailed(result.failed);
          if (result.failed.length)
            toast.error(`${result.failed.length} baris gagal. Sisanya berhasil.`);
          else toast.success(`${created.length} akun peserta berhasil dibuat.`);
        },
        onError: (error) => toast.error(friendlyError(error)),
      },
    );
  };

  const copyAll = () => {
    if (!results?.length) return;
    const text = results
      .map((row) => `Email: ${row.email}\nKata sandi: ${row.password}`)
      .join("\n\n");
    void navigator.clipboard?.writeText(text).then(
      () => toast.success("Kredensial tersalin."),
      () => toast.error("Gagal menyalin."),
    );
  };

  return (
    <AdminShell title="Import peserta" subtitle="Peserta / Import massal" withNotif={false}>
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <h2>Import peserta massal</h2>
            <p>Satu file untuk satu institusi, kategori, dan periode — atau campur per baris lewat kolom opsional. Kredensial tampil sekali.</p>
          </div>
          <div className="heading-actions">
            <Link className="btn-ui btn-secondary-ui" href="/peserta">
              Kembali
            </Link>
          </div>
        </section>

        <section className="surface rise" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="surface-header">
            <div>
              <h3>1 · Paket &amp; file</h3>
              <p>Foto dicocokkan dari nama file = NIS (mis. 2024001.jpg).</p>
            </div>
            <div className="heading-actions">
              <button className="btn-ui btn-secondary-ui" type="button" onClick={downloadTemplate}>
                <Icon name="unduh" />
                Template XLSX
              </button>
            </div>
          </div>
          <form onSubmit={submit} noValidate>
            <div className="surface-body">
              <div className="form-grid">
                <Field
                  label="Institusi (default batch)"
                  htmlFor="batch-institution"
                  hint="Boleh kosong bila semua baris mengisi kolom Institusi."
                >
                  <SelectInput
                    id="batch-institution"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                  >
                    <option value="">
                      {institutions.isPending ? "Memuat institusi..." : "Pilih institusi"}
                    </option>
                    {(institutions.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field
                  label="Kategori (default batch)"
                  htmlFor="batch-category"
                  hint="Boleh kosong bila semua baris mengisi kolom Kategori."
                >
                  <SelectInput
                    id="batch-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Ikut file</option>
                    <option value="SMK PKL">SMK PKL</option>
                    <option value="Mahasiswa Magang">Mahasiswa Magang</option>
                  </SelectInput>
                </Field>
                <Field
                  label="Tanggal mulai (default)"
                  htmlFor="batch-start"
                  hint="Boleh kosong bila semua baris mengisi Tgl Mulai."
                >
                  <TextInput
                    id="batch-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
                <Field
                  label="Tanggal selesai (default)"
                  htmlFor="batch-end"
                  hint="Boleh kosong bila semua baris mengisi Tgl Selesai."
                >
                  <TextInput
                    id="batch-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Field>
                <Field
                  label="File XLSX"
                  required
                  htmlFor="batch-xlsx"
                  hint={fileName || `Maks ${MAX_IMPORT_ROWS} baris.`}
                >
                  <label className="upload-box" htmlFor="batch-xlsx">
                    <span>
                      <Icon name="unggah" />
                      <strong>{fileName || "Pilih file XLSX"}</strong>
                      <span>Kolom wajib: NIS, Nama, Jurusan, Email. Opsional: Institusi, Kategori, Tgl Mulai, Tgl Selesai.</span>
                    </span>
                  </label>
                  <input
                    id="batch-xlsx"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="sr-only"
                    onChange={(e) => void onXlsx(e.target.files?.[0])}
                  />
                </Field>
                <Field
                  label="Foto-foto"
                  htmlFor="batch-photos"
                  hint="JPG/PNG/WEBP, boleh banyak sekaligus."
                >
                  <label className="upload-box" htmlFor="batch-photos">
                    <span>
                      <Icon name="kamera" />
                      <strong>Pilih foto-foto</strong>
                      <span>Nama file = NIS (mis. 2024001.jpg). Preview langsung muncul di bawah.</span>
                    </span>
                  </label>
                  <input
                    id="batch-photos"
                    ref={photoInput}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      onPhotos([...(e.target.files ?? [])]);
                      e.target.value = "";
                    }}
                  />
                </Field>
              </div>
              {headerError ? (
                <div style={{ marginTop: 12 }}>
                  <Notice tone="warning" title="File bermasalah">
                    {headerError}
                  </Notice>
                </div>
              ) : null}
            </div>
          </form>
        </section>

        {enriched.length > 0 ? (
          <section className="surface rise" style={{ "--i": 2 } as React.CSSProperties}>
            <div className="surface-header">
              <div>
                <h3>2 · Preview &amp; validasi</h3>
                <p>
                  {validRows.length} siap · {invalidRows.length} bermasalah (tidak ikut terkirim).
                </p>
              </div>
            </div>
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>NIS</th>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Paket</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((row, index) => (
                    <tr key={`${row.nis}-${index}`}>
                      <td>
                        {row.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.photo.url}
                            alt=""
                            className="avatar"
                            width={40}
                            height={40}
                          />
                        ) : (
                          <span className="table-secondary">—</span>
                        )}
                      </td>
                      <td>{row.nis}</td>
                      <td>
                        <span className="table-primary">{row.nama}</span>
                      </td>
                      <td>{row.email}</td>
                      <td>
                        <span className="table-secondary">
                          {row.merged.newInstitution
                            ? row.merged.newInstitution.name
                            : row.merged.institutionId
                              ? institutionName(row.merged.institutionId)
                              : "—"}
                          {row.merged.newInstitution ? (
                            <span className="badge badge-warning">BARU — akan dibuat</span>
                          ) : row.fromFile.institution ? (
                            <span className="badge badge-success">ikut file</span>
                          ) : (
                            <span className="badge badge-neutral">ikut batch</span>
                          )}
                        </span>
                        <br />
                        <span className="table-secondary">
                          {row.merged.participantType === "SMK_PKL" ? "SMK PKL" : row.merged.participantType === "UNIVERSITY_INTERN" ? "Mahasiswa" : "—"}
                          {" · "}
                          {row.merged.startDate || "—"}–{row.merged.endDate || "—"}
                        </span>
                      </td>
                      <td>
                        {row.error ? (
                          <span className="badge badge-danger">{row.error}</span>
                        ) : row.photo ? (
                          <span className="badge badge-success">
                            {row.photo.matchedBy === "nis"
                              ? `Siap — foto cocok (NIS ${row.nis})`
                              : row.photo.matchedBy === "nama"
                                ? `Siap — foto cocok (nama ${row.nama})`
                                : "Siap — foto dipilih manual"}
                          </span>
                        ) : (
                          <span className="badge badge-neutral">Tanpa foto</span>
                        )}
                      </td>
                      <td>
                        {!row.photo && !row.error ? (
                          <>
                            <label
                              className="text-link"
                              htmlFor={`row-photo-${index}`}
                              style={{ cursor: "pointer" }}
                            >
                              + foto
                            </label>
                            <input
                              id={`row-photo-${index}`}
                              ref={(el) => {
                                if (el) rowPhotoInputs.current.set(index, el);
                              }}
                              type="file"
                              accept=".jpg,.jpeg,.png,.webp"
                              className="sr-only"
                              onChange={(e) => {
                                attachRowPhoto(index, e.target.files?.[0]);
                                e.target.value = "";
                              }}
                            />
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-footer">
              <span className="table-secondary">
                {progress || "Baris merah dilewati otomatis."}
              </span>
              <button
                className="btn-ui btn-primary-ui"
                type="button"
                disabled={!canSubmit}
                onClick={runSubmit}
              >
                <Icon name="tambah" />
                {busy ? "Memproses..." : `Buat ${validRows.length} akun`}
              </button>
            </div>
          </section>
        ) : null}

        {failed.length > 0 ? (
          <section className="surface rise" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="surface-header">
              <div>
                <h3>Baris gagal dari server</h3>
                <p>Perbaiki dan import ulang hanya baris ini.</p>
              </div>
            </div>
            <div className="surface-body">
              <ul style={{ display: "grid", gap: 8 }}>
                {failed.map((item) => (
                  <li key={item.email} className="detail-row">
                    <span className="table-primary">{item.email}</span>
                    <span className="table-secondary">
                      {friendlyError(new AdminApiError(item.code))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {results ? (
          <section className="surface rise" style={{ "--i": 4 } as React.CSSProperties}>
            <div className="surface-header">
              <div>
                <h3>3 · Kredensial — tampil sekali</h3>
                <p>Salin sekarang untuk dibagikan. Tutup halaman = hilang permanen.</p>
              </div>
              <div className="heading-actions">
                <button className="btn-ui btn-secondary-ui" type="button" onClick={copyAll}>
                  <Icon name="unduh" />
                  Salin semua
                </button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Kata sandi</th>
                    <th>Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.email}>
                      <td>{row.email}</td>
                      <td style={{ fontFamily: "ui-monospace, monospace" }}>{row.password}</td>
                      <td>
                        {row.photoOk ? (
                          <span className="badge badge-success">Terpasang</span>
                        ) : row.photoError ? (
                          <span className="badge badge-warning">{row.photoError}</span>
                        ) : (
                          <span className="table-secondary">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <footer className="page-footer">
          <span>Maksimal {MAX_IMPORT_ROWS} baris per file</span>
          <span>Hapus file XLSX setelah selesai dibagikan</span>
        </footer>
      </div>
    </AdminShell>
  );
}
