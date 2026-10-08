import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MobileApiError } from "./format";
import { supabase } from "./supabase";

type SessionContextValue = {
  ready: boolean;
  signedIn: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordRecovery: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function consumeAuthUrl(url: string) {
  const normalized = url.replace("#", "?");
  const parsed = new URL(normalized);
  const accessToken = parsed.searchParams.get("access_token");
  const refreshToken = parsed.searchParams.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        let restored = data.session;
        if (restored) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("role,is_active")
            .eq("id", restored.user.id)
            .maybeSingle();
          if (error || profile?.role !== "participant" || !profile.is_active) {
            await supabase.auth.signOut();
            restored = null;
          }
        }
        if (active) setSession(restored);
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) setReady(true);
      }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_IN" && nextSession) {
        void (async () => {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("role,is_active")
            .eq("id", nextSession.user.id)
            .maybeSingle();
          if (error || profile?.role !== "participant" || !profile.is_active) {
            await supabase.auth.signOut().catch(() => undefined);
            if (active) setSession(null);
          } else if (active) {
            setSession(nextSession);
          }
          if (active) setReady(true);
        })();
        return;
      }
      if (active) {
        setSession(event === "SIGNED_OUT" ? null : nextSession);
        setReady(true);
      }
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void consumeAuthUrl(url);
    });
    const linkListener = Linking.addEventListener("url", ({ url }) => {
      void consumeAuthUrl(url);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
      linkListener.remove();
    };
  }, []);

  return (
    <SessionContext.Provider
      value={{
        ready,
        signedIn: Boolean(session),
        session,
        user: session?.user ?? null,
        signIn: async (email, password) => {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });
          if (error)
            throw new MobileApiError(
              "INVALID_CREDENTIALS",
              "Email atau kata sandi belum cocok. Periksa kembali lalu coba lagi.",
            );
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role,is_active")
            .eq("id", data.user.id)
            .single();
          if (profileError || profile?.role !== "participant") {
            await supabase.auth.signOut();
            throw new MobileApiError(
              "PARTICIPANT_REQUIRED",
              "Akun ini tidak memiliki akses ke aplikasi peserta.",
            );
          }
          if (!profile.is_active) {
            await supabase.auth.signOut();
            throw new MobileApiError(
              "ACCOUNT_INACTIVE",
              "Akunmu sedang nonaktif. Hubungi admin instansi untuk mengaktifkan akses.",
            );
          }
        },
        signOut: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        },
        sendPasswordRecovery: async (email) => {
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: Linking.createURL("/login", { queryParams: { recovery: "new-password" } }),
          });
          if (error) throw error;
        },
        updatePassword: async (password) => {
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
