"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminAuthProvider, useAdminAuth } from "../lib/auth";

/**
 * Client providers for the admin app.
 * No business logic here — only TanStack Query wiring (PRD §24.1).
 */
function AuthGate({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  const { ready, session, profile } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const isResetPassword = pathname === "/reset-password";
  const isInstall = pathname === "/install";
  const isPublicAuth = isLogin || isResetPassword || isInstall;

  useEffect(() => {
    if (!ready) return;
    if (!session || !profile) {
      queryClient.clear();
      if (!isPublicAuth) router.replace("/login");
      return;
    }
    if (isLogin) router.replace("/");
  }, [isLogin, isPublicAuth, profile, queryClient, ready, router, session]);

  // Halaman unduh publik tidak butuh status sesi — render langsung agar
  // pemindai QR tidak melihat layar tunggu administrator.
  if (isInstall) return children;

  if (!ready || (!isPublicAuth && (!session || !profile)) || (isLogin && session && profile)) {
    return <SessionWait />;
  }
  return children;
}

// Layar tunggu cek sesi: satu baris teks + spinner kecil. Tombol muat-ulang
// muncul bila macet >12 detik.
function SessionWait() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="login-page" aria-busy="true" aria-label="Memeriksa sesi administrator">
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }} role="status">
            <span className="spinner spinner-small" aria-hidden="true" />
            <p style={{ margin: 0 }}>Memeriksa sesi administrator...</p>
          </div>
          {slow ? (
            <button
              type="button"
              className="btn-ui btn-secondary-ui"
              style={{ marginTop: 12 }}
              onClick={() => window.location.reload()}
            >
              Koneksi lambat — muat ulang
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <AuthGate queryClient={queryClient}>{children}</AuthGate>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}
