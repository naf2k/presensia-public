import { headers } from "next/headers";
import type { Metadata } from "next";
import type { CSSProperties } from "react";

import { Icon } from "../../components/ui/icon";
import { Notice } from "../../components/ui/notice";
import {
  SUPPORT_CONTACT_NAME,
  SUPPORT_CONTACT_PHONE,
  VIEWER_ACCOUNT_EMAIL,
  apkDownloadUrl,
  expoGoQrUrl,
  expoProjectUrl,
  installPageUrl,
  supportWhatsappUrl,
} from "../../lib/install-config";
import { CopyInstallLink } from "./copy-link-button";
import { detectOs, type OsKind } from "./os";
import { InstallQr } from "./qr";

export const metadata: Metadata = {
  title: "Unduh Aplikasi Presensia",
  description:
    "Unduh aplikasi Presensia untuk peserta PKL/magang Diskominfo Provinsi Banten — Android via APK, iPhone via Expo Go.",
};

const OS_LABEL: Record<OsKind, string> = {
  android: "HP Android",
  ios: "iPhone",
  other: "perangkat lain",
};

function AndroidCard({ index }: { index: number }) {
  return (
    <section
      className="surface install-card rise"
      style={{ "--i": index } as CSSProperties}
      aria-label="Panduan Android"
    >
      <div className="surface-body">
        <div className="install-card-top">
          <span className="install-medal" aria-hidden="true">
            <Icon name="unduh" />
          </span>
          <span className="badge badge-success">Android</span>
        </div>
        <h2>HP Android</h2>
        <p className="install-card-desc">
          Unduh file APK resmi, sekali pasang. Update aplikasi tiba otomatis; install ulang hanya
          bila ada perubahan besar.
        </p>
        <a className="btn-ui btn-primary-ui login-submit" href={apkDownloadUrl()}>
          Download APK Presensia <Icon name="unduh" />
        </a>
        <ol className="install-steps">
          <li>Ketuk tombol Download APK di atas, tunggu file selesai diunduh.</li>
          <li>
            Jika HP meminta izin, aktifkan <strong>“Install unknown apps”</strong> untuk browser
            kamu (sekali saja).
          </li>
          <li>Buka file yang diunduh, ketuk Install, tunggu sampai selesai.</li>
          <li>
            Buka aplikasi Presensia, masuk dengan{" "}
            <strong>email dan kata sandi akun peserta</strong> kamu (bukan akun Expo).
          </li>
        </ol>
      </div>
    </section>
  );
}

function IphoneCard({ index }: { index: number }) {
  return (
    <section
      className="surface install-card rise"
      style={{ "--i": index } as CSSProperties}
      aria-label="Panduan iPhone"
    >
      <div className="surface-body">
        <div className="install-card-top">
          <span className="install-medal" aria-hidden="true">
            <Icon name="lanjut" />
          </span>
          <span className="badge badge-neutral">iPhone</span>
        </div>
        <h2>iPhone</h2>
        <p className="install-card-desc">
          iPhone membuka Presensia lewat aplikasi Expo Go (gratis, dari App Store).
        </p>
        <a className="btn-ui btn-primary-ui login-submit" href={expoProjectUrl()}>
          Buka di Expo Go <Icon name="lanjut" />
        </a>
        <ol className="install-steps">
          <li>
            Install <strong>Expo Go</strong> dari App Store, lalu buka dan masuk dengan akun
            resmi bersama: <strong>{VIEWER_ACCOUNT_EMAIL}</strong> (minta kata sandinya ke
            pendamping/admin — jangan diubah).
          </li>
          <li>
            Ketuk tombol Buka di Expo Go di atas — proyek Presensia terbuka di dalam Expo Go.
          </li>
          <li>
            Masuk dengan <strong>email dan kata sandi akun peserta</strong> kamu.
          </li>
          <li>
            Besok-besok: buka Presensia dari daftar <strong>Recent</strong> di Expo Go, tidak
            perlu mengulang langkah ini.
          </li>
          <li>
            Jalan pintas: buka Expo Go, masuk akun resmi, lalu <strong>pindai kode QR</strong>{" "}
            di bawah halaman ini — Presensia langsung terbuka.
          </li>
        </ol>
      </div>
    </section>
  );
}

const FLOW_STEPS: Array<{ title: string; desc: string }> = [
  {
    title: "Absen masuk",
    desc: "Selfie di lokasi magang. Izinkan kamera & lokasi.",
  },
  {
    title: "Isi jurnal",
    desc: "Catat kegiatan harian. Simpan sebelum pulang.",
  },
  {
    title: "Absen pulang",
    desc: "Foto pulang itu wajib. Kirim sebelum jam pulang.",
  },
  {
    title: "Izin / sakit",
    desc: "Ajukan tanggal, alasan, dan lampiran.",
  },
  {
    title: "Lupa sandi",
    desc: "Hubungi pendamping. Jangan buat akun baru.",
  },
];

export default async function InstallPage() {
  const os = detectOs((await headers()).get("user-agent"));
  const installUrl = installPageUrl();
  const showAndroid = os === "android" || os === "other";
  const showIphone = os === "ios" || os === "other";

  return (
    <div className="install">
      <header className="install-hero">
        <div className="install-hero-inner">
          <div className="install-brand">
            <span className="install-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" width={40} height={40} alt="" />
              <span>
                <strong>Presensia</strong>
                <span>Diskominfo Provinsi Banten</span>
              </span>
            </span>
            <span className="install-os">Terdeteksi: {OS_LABEL[os]}</span>
          </div>
          <h1>Unduh aplikasi Presensia.</h1>
          <p>
            Khusus peserta PKL dan magang. Pilih perangkatmu di bawah, ikuti langkahnya, lalu
            masuk dengan akun peserta masing-masing.
          </p>
        </div>
      </header>

      <main className="install-main">
        <div className="install-grid">
          {showAndroid ? <AndroidCard index={0} /> : null}
          {showIphone ? <IphoneCard index={showAndroid ? 1 : 0} /> : null}
        </div>

        <section className="install-flow rise" style={{ "--i": 2 } as CSSProperties} aria-label="Cara memakai Presensia">
          <h2>Cara memakai Presensia</h2>
          <ol>
            {FLOW_STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="install-flow-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <strong>{step.title}</strong>
                <p>{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {showIphone ? (
          <section
            className="surface install-qrband rise"
            style={{ "--i": 3 } as CSSProperties}
            aria-label="Pindai dengan Expo Go"
          >
            <div className="surface-body install-qrband-inner">
              <InstallQr value={expoGoQrUrl()} size={200} />
              <div className="install-qrband-info">
                <h2>Pindai dengan Expo Go</h2>
                <p>
                  Khusus iPhone: buka Expo Go, masuk akun resmi bersama, lalu pindai kode di
                  samping — aplikasi Presensia langsung terbuka. Kode ini selalu membuka versi
                  terbaru, tidak perlu unduh ulang gambar QR.
                </p>
              <Notice tone="info" title="Akun peserta berbeda dengan akun Expo.">
                Akun Expo hanya untuk membuka aplikasi di iPhone. Presensi, jurnal, dan izin
                selalu memakai akun peserta. <CopyInstallLink url={installUrl} />
              </Notice>
            </div>
          </div>
        </section>
        ) : null}

        <footer className="install-foot">
          Butuh bantuan? Hubungi {SUPPORT_CONTACT_NAME} —{" "}
          <a className="text-link" href={supportWhatsappUrl()}>
            {SUPPORT_CONTACT_PHONE}
          </a>
        </footer>
      </main>
    </div>
  );
}
