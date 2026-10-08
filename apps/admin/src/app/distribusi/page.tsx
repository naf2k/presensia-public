import type { Metadata } from "next";

import { AdminShell } from "../../components/layout/admin-shell";
import { Notice } from "../../components/ui/notice";
import { apkDownloadUrl, expoProjectUrl, installPageUrl } from "../../lib/install-config";
import { InstallQr } from "../install/qr";
import { DistribusiActions } from "./actions";

export const metadata: Metadata = {
  title: "Distribusi Aplikasi",
};

export default function DistribusiPage() {
  const installUrl = installPageUrl();
  const isLocalhostQr = installUrl.includes("localhost");

  return (
    <AdminShell title="Distribusi Aplikasi" subtitle="QR final untuk peserta PKL/magang baru">
      <div className="page-stack">
        <section className="page-heading rise">
          <div>
            <h2>QR unduh aplikasi</h2>
            <p>
              Satu QR untuk semua peserta. Discan dari HP Android maupun iPhone, halaman tujuan
              otomatis mengarahkan ke APK atau Expo Go. QR tidak perlu diganti saat tautan
              berubah — cukup ubah env lalu redeploy.
            </p>
          </div>
        </section>

        <section className="surface rise" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="surface-body distribusi-qr">
            <div id="qr-presensia">
              <InstallQr value={installUrl} size={220} />
            </div>
            <div className="distribusi-info">
              <h3>Tujuan QR</h3>
              <p className="distribusi-url">
                <strong>{installUrl}</strong>
              </p>
              <h3>Konfigurasi aktif</h3>
              <ul>
                <li>
                  <strong>APK Android:</strong> <span>{apkDownloadUrl()}</span>
                </li>
                <li>
                  <strong>Proyek Expo (iPhone):</strong> <span>{expoProjectUrl()}</span>
                </li>
              </ul>
              <p>
                Mengganti tautan: ubah <code>NEXT_PUBLIC_APK_URL</code> /{" "}
                <code>NEXT_PUBLIC_EXPO_PROJECT_URL</code> di Vercel lalu redeploy. Prosedur
                lengkap ada di <code>docs/ops/distribusi.md</code>.
              </p>
              <DistribusiActions installUrl={installUrl} />
              {isLocalhostQr ? (
                <div style={{ marginTop: 16 }}>
                  <Notice
                    tone="warning"
                    title="QR ini menunjuk ke localhost — jangan dicetak."
                  >
                    Set NEXT_PUBLIC_APP_URL di environment build lalu redeploy sebelum mencetak
                    QR.
                  </Notice>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
