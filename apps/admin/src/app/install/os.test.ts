import { describe, expect, it } from "vitest";

import { detectOs } from "./os";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15 Mobile/15E148";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("detectOs", () => {
  it("mengenali Chrome Android", () => {
    expect(detectOs(ANDROID_UA)).toBe("android");
  });

  it("mengenali Safari iPhone", () => {
    expect(detectOs(IPHONE_UA)).toBe("ios");
  });

  it("mengenali iPad", () => {
    expect(detectOs(IPAD_UA)).toBe("ios");
  });

  it("mengenali iPadOS mode desktop (Macintosh + Mobile)", () => {
    expect(detectOs(IPAD_DESKTOP_UA)).toBe("ios");
  });

  it("mengembalikan other untuk desktop sungguhan", () => {
    expect(detectOs(DESKTOP_UA)).toBe("other");
  });

  it("mengembalikan other bila user-agent kosong atau tidak ada", () => {
    expect(detectOs("")).toBe("other");
    expect(detectOs(null)).toBe("other");
    expect(detectOs(undefined)).toBe("other");
  });

  it("tidak sensitif huruf besar-kecil", () => {
    expect(detectOs("Mozilla/5.0 (Linux; ANDROID 14) Mobile")).toBe("android");
  });
});
