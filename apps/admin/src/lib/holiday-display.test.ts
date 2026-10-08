import { describe, expect, it } from "vitest";

import { formatHolidayChip, splitHolidays } from "./holiday-display";

const LIST = [
  { date: "2026-12-25", name: "Natal" },
  { date: "2026-09-20", name: "Sudah lewat" },
  { date: "2026-10-05", name: "Acara kantor" },
];

describe("splitHolidays", () => {
  it("memisah mendatang (naik) dan lewat (turun)", () => {
    const { upcoming, past } = splitHolidays(LIST, "2026-09-29");
    expect(upcoming.map((h) => h.date)).toEqual(["2026-10-05", "2026-12-25"]);
    expect(past.map((h) => h.date)).toEqual(["2026-09-20"]);
  });

  it("hari ini terhitung mendatang", () => {
    const { upcoming } = splitHolidays([{ date: "2026-09-29", name: "Hari ini" }], "2026-09-29");
    expect(upcoming).toHaveLength(1);
  });
});

describe("formatHolidayChip", () => {
  it("memecah tanggal menjadi hari dan bulan Indonesia", () => {
    expect(formatHolidayChip("2026-12-25")).toEqual({ day: "25", month: "Des" });
  });
});
