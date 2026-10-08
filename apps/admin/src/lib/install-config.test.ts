import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_APK_URL,
  DEFAULT_EXPO_PROJECT_URL,
  INSTALL_PATH,
  apkDownloadUrl,
  appOrigin,
  expoGoQrUrl,
  expoProjectUrl,
  installPageUrl,
  supportWhatsappUrl,
} from "./install-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("install-config", () => {
  it("installPageUrl menggabung origin + /install", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://presensia-admin.vercel.app/");
    expect(installPageUrl()).toBe("https://presensia-admin.vercel.app/install");
    expect(INSTALL_PATH).toBe("/install");
  });

  it("memakai origin lokal bila env tidak diset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(appOrigin()).toBe("http://localhost:3000");
  });

  it("apkDownloadUrl memakai default bila env kosong", () => {
    delete process.env.NEXT_PUBLIC_APK_URL;
    expect(apkDownloadUrl()).toBe(DEFAULT_APK_URL);
    expect(DEFAULT_APK_URL).toContain("expo.dev/artifacts/eas/");
    expect(DEFAULT_APK_URL).toMatch(/\.apk$/);
  });

  it("apkDownloadUrl memakai env bila diset (ganti APK tanpa cetak ulang QR)", () => {
    vi.stubEnv("NEXT_PUBLIC_APK_URL", "https://contoh.test/baru.apk");
    expect(apkDownloadUrl()).toBe("https://contoh.test/baru.apk");
  });

  it("expoProjectUrl memakai default proyek tim", () => {
    delete process.env.NEXT_PUBLIC_EXPO_PROJECT_URL;
    expect(expoProjectUrl()).toBe(DEFAULT_EXPO_PROJECT_URL);
    expect(DEFAULT_EXPO_PROJECT_URL).toContain("nafi-bussinesss-team/projects/presensia-mobile");
  });

  it("supportWhatsappUrl mengubah 08… menjadi format wa.me 62…", () => {
    const url = supportWhatsappUrl("Halo");
    expect(url.startsWith("https://wa.me/628118110456?text=")).toBe(true);
    expect(url).toContain(encodeURIComponent("Halo"));
  });

  it("expoGoQrUrl mengembalikan deep link channel iPhone persis", () => {
    delete process.env.NEXT_PUBLIC_EXPO_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_EXPO_RUNTIME;
    delete process.env.NEXT_PUBLIC_EXPO_CHANNEL;
    expect(expoGoQrUrl()).toBe(
      "exp://u.expo.dev/823e20f7-f1be-4952-83d3-8c7b5ca89e33?runtime-version=exposdk%3A57.0.0&channel-name=production",
    );
  });

  it("expoGoQrUrl mengikuti env bila runtime/channel berubah", () => {
    vi.stubEnv("NEXT_PUBLIC_EXPO_RUNTIME", "exposdk:58.0.0");
    expect(expoGoQrUrl()).toContain("runtime-version=exposdk%3A58.0.0");
  });
});
