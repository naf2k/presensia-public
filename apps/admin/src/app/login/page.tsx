"use client";

import type * as React from "react";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "../../components/ui/icon";
import { toast } from "../../components/ui/toast";
import { Toaster } from "../../components/ui/toast";
import { useAdminAuth } from "../../lib/auth";
import { friendlyError } from "../../lib/errors";

export default function LoginPage() {
  const router = useRouter();
  const auth = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, setPending] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) found.email = "Email tidak valid.";
    if (password.length < 1) found.password = "Password wajib diisi.";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Periksa kembali email dan kata sandi.");
      return;
    }
    setPending(true);
    try {
      await auth.signIn(email, password);
      if (remember) window.localStorage.setItem("presensia-admin", email.trim());
      else window.localStorage.removeItem("presensia-admin");
      toast.success("Masuk berhasil. Mengalihkan ke dashboard.");
      router.replace("/");
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setPending(false);
    }
  };

  const recover = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrors((current) => ({ ...current, email: "Isi email dinas yang valid terlebih dahulu." }));
      return;
    }
    setRecovering(true);
    try {
      await auth.sendPasswordRecovery(email);
      toast.success("Tautan pemulihan telah dikirim jika email terdaftar.");
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setRecovering(false);
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
          <h1>Hadir. Tercatat. Terpantau.</h1>
          <p>
            Satu ruang kerja untuk memantau kehadiran, jurnal, dan administrasi peserta PKL serta
            magang dengan lebih terstruktur.
          </p>
        </div>
        <p className="login-foot">Sistem internal pengelolaan PKL &amp; Magang · Zona waktu WIB</p>
      </section>

      <section className="login-form-panel">
        <form className="login-form-wrap" onSubmit={onSubmit} noValidate>
          <h2>Masuk sebagai admin</h2>
          <p>Gunakan akun administrator yang telah terdaftar.</p>
          <div className="login-fields">
            <div className="field-group">
              <label htmlFor="email">Email dinas</label>
              <input
                className="input-ui"
                id="email"
                type="email"
                autoComplete="username"
                placeholder="nama@bantenprov.go.id"
                value={email}
                aria-invalid={!!errors.email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((er) => ({ ...er, email: undefined }));
                }}
              />
              {errors.email ? (
                <span className="field-error" role="alert">
                  {errors.email}
                </span>
              ) : null}
            </div>
            <div className="field-group">
              <label htmlFor="password">Kata sandi</label>
              <div className="password-field">
                <input
                  className="input-ui"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  aria-invalid={!!errors.password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((er) => ({ ...er, password: undefined }));
                  }}
                />
                <button
                  className="password-eye"
                  type="button"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <Icon name="lihat" />
                </button>
              </div>
              {errors.password ? (
                <span className="field-error" role="alert">
                  {errors.password}
                </span>
              ) : null}
            </div>
            <div className="login-options">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Ingat sesi saya
              </label>
              <button type="button" className="text-link" disabled={recovering} onClick={recover}>
                {recovering ? "Mengirim..." : "Lupa kata sandi?"}
              </button>
            </div>
            <button className="btn-ui btn-primary-ui login-submit" type="submit" disabled={pending}>
              {pending ? "Memeriksa..." : "Masuk ke Dashboard"} <Icon name="chevronRight" />
            </button>
          </div>
          <div className="security-note">
            <Icon name="kunci" />
            <span>
              Akses terbatas untuk admin berwenang. Aktivitas administratif penting dicatat dalam
              audit log.
            </span>
          </div>
        </form>
      </section>
      <Toaster />
    </main>
  );
}
