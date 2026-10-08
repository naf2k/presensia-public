"use client";

import type * as React from "react";

import Link from "next/link";
import { useState } from "react";
import { AdminShell } from "../../components/layout/admin-shell";
import { Field, TextInput } from "../../components/ui/form";
import { Icon } from "../../components/ui/icon";
import { Notice } from "../../components/ui/notice";
import { ErrorState, TableSkeleton } from "../../components/ui/states";
import { toast } from "../../components/ui/toast";
import { useCleanupOrphans, useHolidays, useRemoveHoliday, useSaveHoliday, useSaveSettings, useSettings } from "../../lib/queries";
import type { AdminSettings } from "../../lib/admin-api";
import { dateInput } from "../../lib/format";
import { formatHolidayChip, formatHolidayLong, splitHolidays } from "../../lib/holiday-display";
import { cn } from "@presensia/utils";
import { friendlyError } from "../../lib/errors";

const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function PengaturanPage() {
  const settingsQuery = useSettings();
  const save = useSaveSettings();
  const [draft, setDraft] = useState<AdminSettings | null>(null);
  const form = draft ?? settingsQuery.data?.settings ?? null;

  const set = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    const base = form;
    if (!base) return;
    setDraft({ ...base, [key]: value });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.workDays.some(Boolean)) {
      toast.error("Pilih minimal satu hari kerja.");
      return;
    }
    if (form.checkOutTime <= form.checkInTime) {
      toast.error("Jam pulang harus setelah jam masuk.");
      return;
    }
    if (form.lateTolerance < 0 || form.lateTolerance > 180) {
      toast.error("Toleransi terlambat harus 0–180 menit.");
      return;
    }
    if (form.radius < 10 || form.radius > 10_000) {
      toast.error("Radius presensi harus 10–10.000 meter.");
      return;
    }
    if (form.maxLocationAccuracyMeters < 5 || form.maxLocationAccuracyMeters > 1_000) {
      toast.error("Batas akurasi GPS harus 5–1.000 meter.");
      return;
    }
    if (form.maxJournalLength < 1 || form.maxJournalLength > 500) {
      toast.error("Panjang jurnal harus 1–500 karakter.");
      return;
    }
    save.mutate(form, {
      onSuccess: () => {
        setDraft(null);
        toast.success("Pengaturan tersimpan dan tercatat di audit log.");
      },
      onError: (error) => toast.error(friendlyError(error)),
    });
  };

  const limit = form ? addMinutes(form.checkInTime, form.lateTolerance) : "08:15";

  return (
    <AdminShell title="Pengaturan" subtitle="Konfigurasi presensi" withNotif={false}>
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <h2>Pengaturan presensi</h2>
            <p>Perubahan berlaku pada proses presensi berikutnya dan tercatat dalam audit log.</p>
          </div>
          <div className="heading-actions">
            <Link className="btn-ui btn-secondary-ui" href="/audit-log">
              <Icon name="riwayat" />
              Buka audit log
            </Link>
          </div>
        </section>

        {settingsQuery.isError ? (
          <section className="surface rise">
            <ErrorState
              message="Tidak dapat memuat pengaturan."
              onRetry={() => settingsQuery.refetch()}
            />
          </section>
        ) : settingsQuery.isPending || !form ? (
          <section className="surface rise">
            <TableSkeleton rows={8} columns={2} />
          </section>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className="settings-layout">
              <nav className="surface settings-nav" aria-label="Bagian pengaturan">
                <a className="is-active" href="#jadwal">
                  <Icon name="kalender" />
                  Jadwal kerja
                </a>
                <a href="#keterlambatan">
                  <Icon name="kehadiran" />
                  Keterlambatan
                </a>
                <a href="#lokasi">
                  <Icon name="lokasi" />
                  Lokasi
                </a>
                <a href="#bukti">
                  <Icon name="kamera" />
                  Bukti check-out
                </a>
                <a href="#jurnal-setting">
                  <Icon name="jurnal" />
                  Jurnal
                </a>
                <a href="#hari-libur">
                  <Icon name="tutup" />
                  Hari libur
                </a>
                <a href="#pemeliharaan">
                  <Icon name="pengaturan" />
                  Pemeliharaan
                </a>
              </nav>

              <div>
                <section className="surface settings-section" id="jadwal">
                  <div className="surface-header">
                    <div>
                      <h3>Jadwal kerja</h3>
                      <p>Hari dan jam operasional reguler.</p>
                    </div>
                  </div>
                  <div className="surface-body">
                    <div className="setting-row">
                      <div className="setting-copy">
                        <strong>Hari kerja</strong>
                        <small>Pilih hari saat peserta dapat melakukan presensi.</small>
                      </div>
                      <div className="weekday-picker">
                        {DAYS.map((day, i) => (
                          <button
                            key={day}
                            className={cn("weekday", form.workDays[i] && "is-active")}
                            type="button"
                            aria-pressed={!!form.workDays[i]}
                            aria-label={day}
                            onClick={() =>
                              set(
                                "workDays",
                                form.workDays.map((v, j) => (j === i ? !v : v)),
                              )
                            }
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="setting-row">
                      <div className="setting-copy">
                        <strong>Jam masuk</strong>
                        <small>Waktu acuan dimulainya kehadiran.</small>
                      </div>
                      <TextInput
                        type="time"
                        name="jam_masuk"
                        value={form.checkInTime}
                        aria-label="Jam masuk"
                        onChange={(e) => set("checkInTime", e.target.value)}
                      />
                    </div>
                    <div className="setting-row">
                      <div className="setting-copy">
                        <strong>Jam pulang</strong>
                        <small>Waktu acuan berakhirnya aktivitas.</small>
                      </div>
                      <TextInput
                        type="time"
                        name="jam_pulang"
                        value={form.checkOutTime}
                        aria-label="Jam pulang"
                        onChange={(e) => set("checkOutTime", e.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <section className="surface settings-section" id="keterlambatan">
                  <div className="surface-header">
                    <div>
                      <h3>Keterlambatan</h3>
                      <p>Status ditentukan otomatis oleh waktu server.</p>
                    </div>
                  </div>
                  <div className="surface-body">
                    <div className="setting-row">
                      <div className="setting-copy">
                        <strong>Toleransi terlambat</strong>
                        <small>Peserta dinyatakan terlambat setelah batas ini.</small>
                      </div>
                      <Field label="Menit setelah jam masuk" htmlFor="toleransi">
                        <TextInput
                          id="toleransi"
                          type="number"
                          name="toleransi"
                           min={0}
                           max={180}
                          value={form.lateTolerance}
                          onChange={(e) => set("lateTolerance", Number(e.target.value))}
                        />
                      </Field>
                    </div>
                    <Notice tone="info" title="Aturan saat ini">
                      Check-in sampai {limit} berstatus Hadir. Setelah {limit} berstatus Terlambat.
                    </Notice>
                  </div>
                </section>

                <section className="surface settings-section" id="lokasi">
                  <div className="surface-header">
                    <div>
                      <h3>Lokasi presensi</h3>
                      <p>Lokasi hanya diambil saat peserta melakukan presensi.</p>
                    </div>
                  </div>
                  <div className="surface-body">
                    <div className="setting-row">
                      <div className="setting-copy">
                        <strong>Nama lokasi</strong>
                        <small>Ditampilkan pada aplikasi peserta.</small>
                      </div>
                      <TextInput
                        type="text"
                        name="lokasi"
                        value={form.locationName}
                        aria-label="Nama lokasi"
                        onChange={(e) => set("locationName", e.target.value)}
                      />
                    </div>
                    <div className="setting-row">
                      <div className="setting-copy">
                        <strong>Koordinat kantor</strong>
                        <small>Gunakan koordinat titik pusat presensi.</small>
                      </div>
                      <div className="form-grid">
                        <Field label="Latitude" htmlFor="latitude">
                          <TextInput
                            id="latitude"
                            type="number"
                            step="any"
                            value={form.latitude}
                            onChange={(e) => set("latitude", e.target.value)}
                          />
                        </Field>
                        <Field label="Longitude" htmlFor="longitude">
                          <TextInput
                            id="longitude"
                            type="number"
                            step="any"
                            value={form.longitude}
                            onChange={(e) => set("longitude", e.target.value)}
                          />
                        </Field>
                      </div>
                    </div>
                    <div className="setting-row">
                      <div className="setting-copy">
                        <strong>Radius presensi</strong>
                        <small>Jarak maksimum peserta dari titik kantor.</small>
                      </div>
                      <Field label="Radius dalam meter" htmlFor="radius">
                        <TextInput
                          id="radius"
                          type="number"
                           min={10}
                           max={10000}
                          value={form.radius}
                          onChange={(e) => set("radius", Number(e.target.value))}
                        />
                      </Field>
                     </div>
                    <div className="setting-row">
                      <div className="setting-copy">
                        <strong>Batas akurasi GPS</strong>
                        <small>Presensi ditolak jika pembacaan lokasi lebih tidak akurat dari batas ini.</small>
                      </div>
                      <Field label="Akurasi maksimum (meter)" htmlFor="gps-accuracy">
                        <TextInput
                          id="gps-accuracy"
                          type="number"
                          min={5}
                          max={1000}
                          value={form.maxLocationAccuracyMeters}
                          onChange={(e) => set("maxLocationAccuracyMeters", Number(e.target.value))}
                        />
                      </Field>
                    </div>
                  </div>
                </section>

                <section className="surface settings-section" id="bukti">
                  <div className="surface-header">
                    <div>
                      <h3>Bukti check-out</h3>
                      <p>Selfie check-in selalu wajib.</p>
                    </div>
                  </div>
                  <div className="surface-body">
                    <div className="switch-line">
                      <div className="switch-copy">
                        <strong>Wajibkan selfie saat check-out</strong>
                        <small>
                          Default nonaktif. Jika aktif, peserta harus mengambil foto sebelum pulang.
                        </small>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          name="checkout_photo"
                          checked={form.requireCheckoutPhoto}
                          onChange={(e) => set("requireCheckoutPhoto", e.target.checked)}
                        />
                        <span aria-hidden="true" />
                        <span className="sr-only">Wajibkan selfie check-out</span>
                      </label>
                    </div>
                  </div>
                </section>

                <section className="surface settings-section" id="jurnal-setting">
                  <div className="surface-header">
                    <div>
                      <h3>Jurnal harian</h3>
                      <p>Jurnal tetap opsional dan tidak membatalkan check-out.</p>
                    </div>
                  </div>
                  <div className="surface-body">
                    <div className="setting-row">
                      <div className="setting-copy">
                        <strong>Panjang maksimum jurnal</strong>
                        <small>Batas karakter yang dapat ditulis peserta.</small>
                      </div>
                      <Field label="Jumlah karakter" htmlFor="jurnal-max">
                        <TextInput
                          id="jurnal-max"
                          type="number"
                          min={1}
                           max={500}
                          value={form.maxJournalLength}
                          onChange={(e) => set("maxJournalLength", Number(e.target.value))}
                        />
                      </Field>
                    </div>
                  </div>
                  <div className="form-footer">
                    <span className="table-secondary" style={{ marginRight: "auto" }}>
                      Terakhir diperbarui {form.updatedLabel}
                    </span>
                    <button
                      className="btn-ui btn-primary-ui"
                      type="submit"
                      disabled={save.isPending}
                    >
                      <Icon name="simpan" />
                      {save.isPending ? "Menyimpan..." : "Simpan pengaturan"}
                    </button>
                  </div>
                </section>

              </div>
            </div>
          </form>
        )}

        {!settingsQuery.isError && !settingsQuery.isPending ? (
          <>
            <HolidaySection />
            <MaintenanceSection />
          </>
        ) : null}

        <footer className="page-footer">
          <span>Zona waktu: Asia/Jakarta (WIB)</span>
          <span>Perubahan dicatat secara otomatis</span>
        </footer>
      </div>
    </AdminShell>
  );
}

function MaintenanceSection() {
  const cleanup = useCleanupOrphans();
  const [result, setResult] = useState("");

  return (
    <section className="surface settings-section" id="pemeliharaan">
      <div className="surface-header">
        <div>
          <h3>Pemeliharaan berkas</h3>
          <p>Cek kesehatan penyimpanan file aplikasi.</p>
        </div>
      </div>
      <div className="surface-body">
        <div className="maint-intro">
          <span className="medal-ui" aria-hidden="true">
            <Icon name="pengaturan" />
          </span>
          <p>
            <strong>Berkas yatim</strong> adalah file foto atau lampiran yang tidak dipakai
            catatan mana pun. Pemindaian mencari berkas berumur di atas 24 jam lalu
            menghapusnya. Data absensi, izin, dan akun <strong>tidak tersentuh</strong>.
          </p>
        </div>
        <button
          className="btn-ui btn-secondary-ui"
          type="button"
          disabled={cleanup.isPending}
          onClick={() =>
            cleanup.mutate(undefined, {
              onSuccess: (data) =>
                setResult(
                  `Dipindai ${data.scanned} berkas · dihapus ${data.deleted.length}.` +
                    (data.deleted.length === 0 ? " Semua bersih." : ""),
                ),
              onError: (error) => setResult(`Gagal: ${friendlyError(error)}`),
            })
          }
        >
          {cleanup.isPending ? "Memindai..." : "Pindai & bersihkan"}
        </button>
        {result ? (
          <div style={{ marginTop: 12 }}>
            <Notice
              tone={result.startsWith("Gagal") ? "warning" : "info"}
              title="Hasil pemindaian"
            >
              {result}
            </Notice>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function HolidaySection() {
  const holidays = useHolidays();
  const today = dateInput();
  const { upcoming, past } = splitHolidays(holidays.data ?? [], today);
  const addHoliday = useSaveHoliday();
  const removeHoliday = useRemoveHoliday();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || name.trim().length < 2) {
      toast.error("Isi tanggal dan nama hari libur.");
      return;
    }
    addHoliday.mutate(
      { date, name: name.trim() },
      {
        onSuccess: () => {
          setDate("");
          setName("");
          toast.success("Hari libur ditambahkan.");
        },
        onError: (error) => toast.error(friendlyError(error)),
      },
    );
  };

  return (
    <section className="surface settings-section" id="hari-libur">
      <div className="surface-header">
        <div>
          <h3 className="holiday-title">
            Hari libur <span className="badge badge-neutral">{upcoming.length} mendatang</span>
          </h3>
          <p>Tanggal merah — presensi ditolak pada hari ini.</p>
        </div>
      </div>
      <div className="surface-body">
        {holidays.isPending ? (
          <TableSkeleton rows={3} columns={2} />
        ) : holidays.isError ? (
          <ErrorState message="Tidak dapat memuat hari libur." onRetry={() => holidays.refetch()} />
        ) : (
          <>
            {upcoming.length === 0 ? (
              <Notice tone="info" title="Belum ada hari libur">
                Tambahkan tanggal merah atau hari kantor tutup agar tidak dihitung sebagai hari
                kerja.
              </Notice>
            ) : (
              <div>
                {upcoming.map((holiday) => (
                  <HolidayRow
                    key={holiday.date}
                    date={holiday.date}
                    name={holiday.name}
                    onRemove={() =>
                      removeHoliday.mutate(holiday.date, {
                        onSuccess: () => toast.success("Hari libur dihapus."),
                        onError: (error) => toast.error(friendlyError(error)),
                      })
                    }
                    removing={removeHoliday.isPending}
                  />
                ))}
              </div>
            )}
            {past.length > 0 ? (
              <>
                <h4 className="holiday-past-title">Sudah lewat</h4>
                <div className="holiday-past">
                  {past.map((holiday) => (
                    <HolidayRow
                      key={holiday.date}
                      date={holiday.date}
                      name={holiday.name}
                      past
                      onRemove={() =>
                        removeHoliday.mutate(holiday.date, {
                          onSuccess: () => toast.success("Hari libur dihapus."),
                          onError: (error) => toast.error(friendlyError(error)),
                        })
                      }
                      removing={removeHoliday.isPending}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
        <div style={{ height: 16 }} aria-hidden="true" />
        <form onSubmit={onAdd} noValidate>
          <div className="form-grid">
            <Field label="Tanggal" htmlFor="libur-tanggal">
              <TextInput
                id="libur-tanggal"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Nama hari libur" htmlFor="libur-nama">
              <TextInput
                id="libur-nama"
                type="text"
                placeholder="mis. Hari Kemerdekaan"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </div>
          <div className="form-footer">
            <button
              className="btn-ui btn-secondary-ui"
              type="submit"
              disabled={addHoliday.isPending}
            >
              <Icon name="tambah" />
              {addHoliday.isPending ? "Menambahkan..." : "Tambah hari libur"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function HolidayRow({
  date,
  name,
  past,
  onRemove,
  removing,
}: {
  date: string;
  name: string;
  past?: boolean;
  onRemove: () => void;
  removing: boolean;
}) {
  const chip = formatHolidayChip(date);
  return (
    <div className={past ? "holiday-row is-past" : "holiday-row"}>
      <span className="holiday-chip" aria-hidden="true">
        <strong>{chip.day}</strong>
        <span>{chip.month}</span>
      </span>
      <span className="holiday-name">
        <strong>{name}</strong>
        <small>{formatHolidayLong(date)}</small>
      </span>
      <button
        type="button"
        className="btn-ui btn-quiet-ui btn-compact"
        disabled={removing}
        onClick={onRemove}
        aria-label={`Hapus ${name}`}
      >
        Hapus
      </button>
    </div>
  );
}
