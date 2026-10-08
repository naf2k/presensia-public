"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/ui/icon";
import { Toaster, toast } from "../../components/ui/toast";
import { useAdminAuth } from "../../lib/auth";
import { friendlyError } from "../../lib/errors";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const auth = useAdminAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  // The form is only valid inside a recovery session (opened from the email
  // link). A plain logged-in session must never be able to set a password
  // here without proving mailbox ownership first.
  const [recoveryReady, setRecoveryReady] = useState(
    () =>
      typeof window !== "undefined" &&
      /[?#&]type=recovery\b/.test(window.location.search + window.location.hash),
  );

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!recoveryReady) {
      toast.error("Buka tautan pemulihan dari email untuk mengganti kata sandi.");
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      toast.error(
        "Kata sandi minimal 8 karakter dan memuat huruf besar, huruf kecil, serta angka.",
      );
      return;
    }
    if (password !== confirm) {
      toast.error("Konfirmasi kata sandi belum sama.");
      return;
    }
    setPending(true);
    try {
      await auth.updatePassword(password);
      toast.success("Kata sandi berhasil diperbarui.");
      router.replace("/");
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="Tentang Presensia">
        <div className="login-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" width={46} height={46} alt="" />
          <div>
            <strong>Presensia</strong>
            <span>Diskominfo Provinsi Banten</span>
          </div>
        </div>
        <div className="login-message">
          <h1>Perbarui akses administrator.</h1>
          <p>Gunakan kata sandi yang kuat dan tidak digunakan pada layanan lain.</p>
        </div>
        <p className="login-foot">Sistem internal pengelolaan PKL &amp; Magang · Zona waktu WIB</p>
      </section>
      <section className="login-form-panel">
        {recoveryReady ? (
          <form className="login-form-wrap" onSubmit={submit} noValidate>
            <h2>Buat kata sandi baru</h2>
            <p>Minimal 8 karakter, huruf besar, huruf kecil, dan angka.</p>
            <div className="login-fields">
              <div className="field-group">
                <label htmlFor="new-password">Kata sandi baru</label>
                <input
                  id="new-password"
                  name="new-password"
                  className="input-ui"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="field-group">
                <label htmlFor="confirm-password">Konfirmasi kata sandi</label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  className="input-ui"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
              <button
                className="btn-ui btn-primary-ui login-submit"
                type="submit"
                disabled={pending || !auth.session}
              >
                {pending ? "Menyimpan..." : "Simpan kata sandi"}
              </button>
            </div>
            <div className="security-note">
              <Icon name="kunci" />
              <span>
                Akses terbatas untuk admin berwenang. Tautan pemulihan hanya berlaku sementara.
              </span>
            </div>
          </form>
        ) : (
          <div className="login-form-wrap">
            <h2>Perlu tautan pemulihan</h2>
            <p>
              Halaman ini hanya berfungsi bila dibuka dari tautan pemulihan yang dikirim ke email
              dinas. Minta tautan baru lewat tombol “Lupa kata sandi?” di halaman login.
            </p>
            <div className="security-note">
              <Icon name="kunci" />
              <span>Kata sandi tidak dapat diganti tanpa membuktikan akses email.</span>
            </div>
          </div>
        )}
      </section>
      <Toaster />
    </main>
  );
}
