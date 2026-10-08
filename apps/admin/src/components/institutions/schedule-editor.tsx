"use client";

import { useState } from "react";
import { Field, TextInput } from "../ui/form";
import { Icon } from "../ui/icon";
import { toast } from "../ui/toast";
import { WEEKDAY_LABEL, type InstitutionDaySchedule } from "../../lib/admin-api";
import { friendlyError } from "../../lib/errors";
import { useSaveSchedules, useSchedules } from "../../lib/queries";

type DayState = {
  enabled: boolean;
  followGlobal: boolean;
  checkIn: string;
  checkOut: string;
  tolerance: string;
};

const EMPTY_DAY: DayState = {
  enabled: false,
  followGlobal: true,
  checkIn: "",
  checkOut: "",
  tolerance: "",
};

function fromRows(rows: InstitutionDaySchedule[]): DayState[] {
  const byDay = new Map(rows.map((r) => [r.weekday, r]));
  return [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const row = byDay.get(d);
    if (!row)
      return { ...EMPTY_DAY };
    const custom = row.checkIn !== null || row.checkOut !== null || row.tolerance !== null;
    return {
      enabled: true,
      followGlobal: !custom,
      checkIn: row.checkIn?.slice(0, 5) ?? "",
      checkOut: row.checkOut?.slice(0, 5) ?? "",
      tolerance: row.tolerance !== null ? String(row.tolerance) : "",
    };
  });
}

export function ScheduleEditor({
  institutionId,
  institutionName,
}: {
  institutionId: string;
  institutionName: string;
}) {
  const query = useSchedules(institutionId);
  const save = useSaveSchedules();
  const [days, setDays] = useState<DayState[]>(() => [1, 2, 3, 4, 5, 6, 7].map(() => ({ ...EMPTY_DAY })));
  // Sinkronkan form saat data tiba/berganti institusi (pola adjust-during-render
  // resmi React — bukan setState di dalam effect).
  const [synced, setSynced] = useState<{ id: string; data: unknown } | null>(null);
  if (query.data && synced?.data !== query.data) {
    setSynced({ id: institutionId, data: query.data });
    setDays(fromRows(query.data));
  }
  if (!query.data && synced?.id !== institutionId && synced !== null) {
    setSynced(null);
    setDays([1, 2, 3, 4, 5, 6, 7].map(() => ({ ...EMPTY_DAY })));
  }

  const set = (index: number, patch: Partial<DayState>) =>
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const dayAt = (index: number): DayState => days[index] ?? { ...EMPTY_DAY };

  const onSave = () => {
    const rows: InstitutionDaySchedule[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = dayAt(i);
      if (!d.enabled) continue;
      if (!d.followGlobal) {
        if (!/^\d{2}:\d{2}$/.test(d.checkIn) || !/^\d{2}:\d{2}$/.test(d.checkOut)) {
          toast.error(`Jam masuk/pulang ${WEEKDAY_LABEL[i]} wajib HH:MM bila tidak ikut global.`);
          return;
        }
        const tol = d.tolerance.trim() === "" ? null : Number(d.tolerance);
        if (tol !== null && (!Number.isInteger(tol) || tol < 0 || tol > 180)) {
          toast.error(`Toleransi ${WEEKDAY_LABEL[i]} wajib 0–180 menit.`);
          return;
        }
        rows.push({ weekday: i + 1, checkIn: d.checkIn, checkOut: d.checkOut, tolerance: tol });
      } else {
        rows.push({ weekday: i + 1, checkIn: null, checkOut: null, tolerance: null });
      }
    }
    save.mutate(
      { institutionId, rows },
      {
        onSuccess: () => toast.success(`Jadwal khusus ${institutionName} tersimpan.`),
        onError: (error) => toast.error(friendlyError(error)),
      },
    );
  };

  if (query.isPending) return <p>Memuat jadwal...</p>;
  if (query.isError)
    return <p>Gagal memuat jadwal khusus. Simpan institusi dulu lalu coba lagi.</p>;

  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        Hari yang dicentang = hari kerja institusi ini. Kosongkan semua untuk memakai setting
        global. Centang “Ikut global” bila jamnya sama dengan global.
      </p>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((d, i) => (
          <div
            key={d}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              padding: "8px 10px",
              border: "1px solid var(--line-soft)",
              borderRadius: 10,
            }}
          >
            <label style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 120 }}>
              <input
                type="checkbox"
                checked={dayAt(i).enabled}
                onChange={(e) => set(i, { enabled: e.target.checked })}
              />
              <strong>{["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"][i]}</strong>
            </label>
            {dayAt(i).enabled ? (
              <>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={dayAt(i).followGlobal}
                    onChange={(e) => set(i, { followGlobal: e.target.checked })}
                  />
                  Ikut global
                </label>
                {!dayAt(i).followGlobal ? (
                  <>
                    <Field label="Masuk" htmlFor={`sched-in-${d}`}>
                      <TextInput
                        id={`sched-in-${d}`}
                        type="time"
                        value={dayAt(i).checkIn}
                        onChange={(e) => set(i, { checkIn: e.target.value })}
                      />
                    </Field>
                    <Field label="Pulang" htmlFor={`sched-out-${d}`}>
                      <TextInput
                        id={`sched-out-${d}`}
                        type="time"
                        value={dayAt(i).checkOut}
                        onChange={(e) => set(i, { checkOut: e.target.value })}
                      />
                    </Field>
                    <Field label="Toleransi (mnt)" htmlFor={`sched-tol-${d}`}>
                      <TextInput
                        id={`sched-tol-${d}`}
                        type="number"
                        min={0}
                        max={180}
                        value={dayAt(i).tolerance}
                        onChange={(e) => set(i, { tolerance: e.target.value })}
                      />
                    </Field>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ))}
      </div>
      <div className="form-footer">
        <button
          className="btn-ui btn-secondary-ui"
          type="button"
          onClick={onSave}
          disabled={save.isPending}
        >
          <Icon name="simpan" />
          {save.isPending ? "Menyimpan..." : "Simpan jadwal khusus"}
        </button>
      </div>
    </div>
  );
}
