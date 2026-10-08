import { describe, expect, it } from "vitest";

import {
  diffChanges,
  groupDayLabel,
  humanizeActionCode,
  humanizeEntityKind,
  shortId,
  summarizeActivity,
  type AuditDisplayRow,
} from "./audit-display";

const BASE_ROW: AuditDisplayRow = {
  actionCode: "PARTICIPANT_CREATED",
  action: "Menambah peserta",
  entityKind: "profile",
  participantName: "Nadia Safitri",
};

describe("humanizeEntityKind", () => {
  it("menerjemahkan nama tabel teknis", () => {
    expect(humanizeEntityKind("attendance_settings")).toBe("Pengaturan presensi");
    expect(humanizeEntityKind("profile")).toBe("Peserta");
    expect(humanizeEntityKind("attendance_date")).toBe("Absensi harian");
    expect(humanizeEntityKind("holiday_calendar")).toBe("Hari libur");
    expect(humanizeEntityKind("leave_request")).toBe("Pengajuan izin");
  });

  it("merapikan kode tak dikenal tanpa label generik", () => {
    expect(humanizeEntityKind("operational_schedule")).toBe("Operational schedule");
  });
});

describe("summarizeActivity", () => {
  it("menyebut nama peserta untuk aksi peserta", () => {
    expect(summarizeActivity(BASE_ROW)).toBe("Menambah peserta Nadia Safitri");
  });

  it("meringkas ubah pengaturan tanpa UUID", () => {
    expect(
      summarizeActivity({
        actionCode: "ATTENDANCE_SETTINGS_UPDATED",
        action: "Mengubah pengaturan",
        entityKind: "attendance_settings",
      }),
    ).toBe("Mengubah pengaturan");
  });

  it("memakai label aksi mentah yang dirapikan bila tak dikenal", () => {
    expect(
      summarizeActivity({
        actionCode: "NIGHTLY_JOB",
        action: "Aktivitas administratif",
        entityKind: "attendance_date",
      }),
    ).toBe("Nightly job · Absensi harian");
  });
});

describe("humanizeActionCode", () => {
  it("merapikan kode aksi", () => {
    expect(humanizeActionCode("NIGHTLY_ABSENCE_JOB")).toBe("Nightly absence job");
  });
});

describe("diffChanges", () => {
  it("hanya menampilkan field yang berubah dengan label Indonesia", () => {
    const diff = diffChanges(
      { latitude: "-6.1", radius_meters: 150, location_name: "Kantor" },
      { latitude: "-6.169042", radius_meters: 300, location_name: "Kantor" },
    );
    expect(diff).toEqual([
      { key: "latitude", label: "Latitude", before: "-6.1", after: "-6.169042" },
      { key: "radius_meters", label: "Radius (m)", before: "150", after: "300" },
    ]);
  });

  it("melewati kolom internal dan memformat boolean serta hari kerja", () => {
    const diff = diffChanges(
      { id: "abc", singleton_key: true, require_checkout_photo: false, work_days: [1, 2, 3, 4] },
      { id: "abc", singleton_key: true, require_checkout_photo: true, work_days: [1, 2, 3] },
    );
    expect(diff).toEqual([
      { key: "require_checkout_photo", label: "Selfie check-out wajib", before: "Tidak", after: "Ya" },
      { key: "work_days", label: "Hari kerja", before: "Sen–Kam", after: "Sen–Rab" },
    ]);
  });

  it("kosong bila tidak ada perubahan", () => {
    expect(diffChanges({ a: 1 }, { a: 1 })).toEqual([]);
  });
});

describe("shortId", () => {
  it("memendekkan UUID", () => {
    expect(shortId("55555555-5555-4555-8555-555555555555")).toBe("55555555");
  });
});

describe("groupDayLabel", () => {
  it("melabeli hari ini dan kemarin", () => {
    expect(groupDayLabel("2026-09-29", "2026-09-29")).toBe("Hari ini");
    expect(groupDayLabel("2026-09-28", "2026-09-29")).toBe("Kemarin");
    expect(groupDayLabel("2026-09-24", "2026-09-29")).toBe("Kamis, 24 Sep 2026");
  });
});
