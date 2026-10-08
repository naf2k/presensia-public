import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_ROWS,
  generateImportPassword,
  mapImportHeader,
  mapImportRows,
  matchPhotoStems,
  matchPhotosByName,
  mergeRowWithBatch,
  parseImportCategory,
  resolveImportInstitution,
  validateImportRows,
} from "./import-validation";

describe("mapImportHeader", () => {
  it("mengenali header standar tanpa peduli kapital", () => {
    expect(mapImportHeader(["NIS", "Nama Lengkap", "Jurusan", "Email", "No HP"])).toEqual({
      nis: 0,
      nama: 1,
      jurusan: 2,
      email: 3,
      hp: 4,
    });
  });

  it("mengenali varian nama kolom", () => {
    expect(mapImportHeader(["nis/nim", "nama", "program studi", "e-mail", "telepon"])).toEqual({
      nis: 0,
      nama: 1,
      jurusan: 2,
      email: 3,
      hp: 4,
    });
  });

  it("menolak bila kolom wajib hilang", () => {
    const result = mapImportHeader(["NIS", "Nama"]);
    expect("error" in result ? result.error : "").toMatch(/email/i);
  });
});

describe("mapImportRows + validateImportRows", () => {
  const idx = { nis: 0, nama: 1, jurusan: 2, email: 3, hp: 4 };

  it("baris valid lolos semua", () => {
    const rows = mapImportRows(
      [["2024001", "Nadia Safitri", "RPL", "nadia@mail.com", "0812"]],
      idx,
    );
    expect(validateImportRows(rows).every((message) => message === "")).toBe(true);
  });

  it("menandai email tidak valid, NIS pendek, nama kosong", () => {
    const rows = mapImportRows(
      [
        ["1", "A", "RPL", "bukan-email", ""],
        ["2024002", "", "RPL", "ok@mail.com", ""],
      ],
      idx,
    );
    const errors = validateImportRows(rows);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/email|nis|nama/i);
    expect(errors[1]).toMatch(/nama/i);
  });

  it("menandai email ganda dalam file", () => {
    const rows = mapImportRows(
      [
        ["2024001", "Nadia", "RPL", "sama@mail.com", ""],
        ["2024002", "Bima", "RPL", "SAMA@mail.com", ""],
      ],
      idx,
    );
    const errors = validateImportRows(rows);
    expect(errors[0]).toMatch(/ganda/i);
    expect(errors[1]).toMatch(/ganda/i);
  });

  it("menandai NIS ganda dalam file", () => {
    const rows = mapImportRows(
      [
        ["2024001", "Nadia", "RPL", "a@mail.com", ""],
        ["2024001", "Bima", "RPL", "b@mail.com", ""],
      ],
      idx,
    );
    expect(validateImportRows(rows)[1]).toMatch(/ganda/i);
  });

  it("menolak lebih dari batas baris", () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({
      nis: `N${i}`,
      nama: "Nama",
      jurusan: "RPL",
      email: `u${i}@mail.com`,
      hp: "",
    }));
    expect(validateImportRows(rows).length).toBeGreaterThan(0);
  });
});

describe("matchPhotoStems", () => {
  it("mencocokkan tanpa peduli kapital, spasi, dan ekstensi", () => {
    const map = matchPhotoStems(
      ["2024001", "2024002"],
      ["2024001.JPG", " 2024002.png", "sampah.gif"],
    );
    expect(map.get("2024001")).toBe("2024001.JPG");
    expect(map.get("2024002")).toBe(" 2024002.png");
  });
});

describe("generateImportPassword", () => {
  it("selalu memenuhi policy (8+, besar, kecil, angka)", () => {
    for (let i = 0; i < 100; i += 1) {
      const pw = generateImportPassword();
      expect(pw.length).toBeGreaterThanOrEqual(8);
      expect(pw).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/);
    }
  });

  it("tidak menghasilkan password yang sama berurutan", () => {
    expect(generateImportPassword()).not.toBe(generateImportPassword());
  });
});

const INSTITUTIONS = [
  { id: "id-smk", name: "SMK Telkom Bandung", type: "SMK" as const },
  { id: "id-univ", name: "Universitas Padjadjaran", type: "UNIVERSITY" as const },
];

const BATCH = {
  institutionId: "id-smk",
  participantType: "SMK_PKL" as const,
  startDate: "2026-09-27",
  endDate: "2026-12-31",
};

describe("resolveImportInstitution", () => {
  it("cocok persis tanpa peduli kapital/spasi", () => {
    expect(resolveImportInstitution("smk telkom bandung", INSTITUTIONS)?.id).toBe("id-smk");
    expect(resolveImportInstitution("  Universitas Padjadjaran ", INSTITUTIONS)?.id).toBe("id-univ");
  });

  it("null bila kosong atau tak dikenal", () => {
    expect(resolveImportInstitution("", INSTITUTIONS)).toBeNull();
    expect(resolveImportInstitution("SMK entah", INSTITUTIONS)).toBeNull();
  });
});

describe("parseImportCategory", () => {
  it("mengenali varian umum", () => {
    expect(parseImportCategory("SMK PKL")).toBe("SMK_PKL");
    expect(parseImportCategory("smk_pkl")).toBe("SMK_PKL");
    expect(parseImportCategory("Mahasiswa Magang")).toBe("UNIVERSITY_INTERN");
    expect(parseImportCategory("Mahasiswa")).toBe("UNIVERSITY_INTERN");
  });

  it("null untuk nilai asing/kosong", () => {
    expect(parseImportCategory("")).toBeNull();
    expect(parseImportCategory("Magang Bebas")).toBeNull();
  });
});

describe("mergeRowWithBatch", () => {
  const row = (over: Record<string, string> = {}) => ({
    nis: "2024001",
    nama: "Nadia",
    jurusan: "RPL",
    email: "nadia@mail.com",
    hp: "",
    institusi: "",
    kategori: "",
    mulai: "",
    selesai: "",
    ...over,
  });

  it("pakai batch bila sel kosong semua", () => {
    const merged = mergeRowWithBatch(row(), BATCH, INSTITUTIONS);
    expect(merged.errors).toEqual([]);
    expect(merged.value).toMatchObject({
      institutionId: "id-smk",
      participantType: "SMK_PKL",
      startDate: "2026-09-27",
      endDate: "2026-12-31",
    });
  });

  it("sel terisi menimpa batch", () => {
    const merged = mergeRowWithBatch(
      row({ institusi: "Universitas Padjadjaran", kategori: "Mahasiswa Magang", mulai: "2026-10-01", selesai: "2026-12-01" }),
      BATCH,
      INSTITUTIONS,
    );
    expect(merged.errors).toEqual([]);
    expect(merged.value).toMatchObject({
      institutionId: "id-univ",
      participantType: "UNIVERSITY_INTERN",
      startDate: "2026-10-01",
      endDate: "2026-12-01",
    });
  });

  it("menolak institusi tak dikenal tanpa kategori, mismatch, tanggal jelek", () => {
    const noCat = { institutionId: "id-smk", participantType: "", startDate: "2026-09-27", endDate: "2026-12-31" } as const;
    expect(
      mergeRowWithBatch(row({ institusi: "SMK Entah" }), noCat, INSTITUTIONS).errors.join(" "),
    ).toMatch(/institusi/i);
    expect(
      mergeRowWithBatch(row({ kategori: "Mahasiswa Magang" }), BATCH, INSTITUTIONS).errors.join(" "),
    ).toMatch(/tipe|kategori/i);
    expect(
      mergeRowWithBatch(row({ mulai: "2026-12-31", selesai: "2026-01-01" }), BATCH, INSTITUTIONS).errors.join(" "),
    ).toMatch(/tanggal/i);
    expect(
      mergeRowWithBatch(row({ mulai: "bukan-tanggal" }), BATCH, INSTITUTIONS).errors.join(" "),
    ).toMatch(/tanggal/i);
  });

  it("error bila batch maupun sel kosong", () => {
    const empty = { institutionId: "", participantType: "" as const, startDate: "", endDate: "" };
    const merged = mergeRowWithBatch(row(), empty, INSTITUTIONS);
    expect(merged.errors.length).toBeGreaterThan(0);
  });
});

describe("matchPhotosByName", () => {
  const rows = [
    { nis: "2024001", nama: "Nadia Safitri" },
    { nis: "2024002", nama: "Bima Prasetyo" },
  ];

  it("cocok tanpa peduli kapital, spasi ganda, dan ekstensi", () => {
    const map = matchPhotosByName(rows, ["NADIA  SAFITRI.JPG", "bima prasetyo.png", "acak.jpg"]);
    expect(map.get("2024001")).toBe("NADIA  SAFITRI.JPG");
    expect(map.get("2024002")).toBe("bima prasetyo.png");
  });

  it("mengabaikan nama kembar (tidak menebak)", () => {
    const dupes = [...rows, { nis: "2024003", nama: "Nadia Safitri" }];
    const map = matchPhotosByName(dupes, ["Nadia Safitri.jpg"]);
    expect(map.has("2024001")).toBe(false);
    expect(map.has("2024003")).toBe(false);
  });

  it("melewati baris tanpa nama", () => {
    const map = matchPhotosByName([{ nis: "X", nama: "" }], ["X.jpg"]);
    expect(map.has("X")).toBe(false);
  });
});

describe("mergeRowWithBatch institusi baru", () => {
  const row = (over: Record<string, string> = {}) => ({
    nis: "2024001",
    nama: "Nadia",
    jurusan: "RPL",
    email: "nadia@mail.com",
    hp: "",
    institusi: "",
    kategori: "",
    mulai: "",
    selesai: "",
    ...over,
  });

  it("nama tak dikenal + kategori valid = institusi baru, bukan error", () => {
    const merged = mergeRowWithBatch(
      row({ institusi: "SMK Contoh Baru", kategori: "SMK PKL" }),
      BATCH,
      INSTITUTIONS,
    );
    expect(merged.errors).toEqual([]);
    expect(merged.value.newInstitution).toEqual({ name: "SMK Contoh Baru", type: "SMK" });
  });

  it("institusi baru tanpa kategori = error (tipe tak diketahui)", () => {
    const merged = mergeRowWithBatch(row({ institusi: "SMK Contoh Baru" }), {
      institutionId: "",
      participantType: "",
      startDate: "2026-09-27",
      endDate: "2026-12-31",
    }, INSTITUTIONS);
    expect(merged.errors.join(" ")).toMatch(/kategori|tipe/i);
  });

  it("nama dikenal tetap resolve ID (bukan baru)", () => {
    const merged = mergeRowWithBatch(row({ institusi: "SMK Telkom Bandung" }), BATCH, INSTITUTIONS);
    expect(merged.errors).toEqual([]);
    expect(merged.value.institutionId).toBe("id-smk");
    expect(merged.value.newInstitution).toBeUndefined();
  });
});
