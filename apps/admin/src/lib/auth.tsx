"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AdminApiError, normalizeError } from "./errors";
import { supabase } from "./supabase";

export type AdminProfile = {
  id: string;
  fullName: string;
  email: string;
  avatarPath: string | null;
};

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: AdminProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordRecovery: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function validateAdmin(session: Session | null): Promise<AdminProfile | null> {
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,avatar_path,role,is_active")
    .eq("id", session.user.id)
    .single();
  if (error) throw normalizeError(error);
  if (data.role !== "admin") throw new AdminApiError("ADMIN_REQUIRED");
  if (!data.is_active) throw new AdminApiError("ACCOUNT_INACTIVE");
  return { id: data.id, fullName: data.full_name, email: data.email, avatarPath: data.avatar_path };
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const nextProfile = await validateAdmin(data.session);
        if (!active) return;
        setSession(data.session);
        setProfile(nextProfile);
      } catch {
        await supabase.auth.signOut().catch(() => undefined);
        if (active) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (active) setReady(true);
      }
    };
    void restore();
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setReady(true);
        return;
      }
      if (event === "TOKEN_REFRESHED") {
        setSession(nextSession);
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void (async () => {
          try {
            const nextProfile = await validateAdmin(nextSession);
            if (!active) return;
            setSession(nextSession);
            setProfile(nextProfile);
          } catch {
            await supabase.auth.signOut().catch(() => undefined);
            if (active) {
              setSession(null);
              setProfile(null);
            }
          } finally {
            if (active) setReady(true);
          }
        })();
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ready,
        session,
        user: session?.user ?? null,
        profile,
        signIn: async (email, password) => {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });
          if (error) throw new AdminApiError("INVALID_CREDENTIALS");
          try {
            const nextProfile = await validateAdmin(data.session);
            setSession(data.session);
            setProfile(nextProfile);
          } catch (authError) {
            await supabase.auth.signOut();
            throw authError;
          }
        },
        signOut: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) throw normalizeError(error);
          setSession(null);
          setProfile(null);
        },
        sendPasswordRecovery: async (email) => {
          const redirectTo = `${window.location.origin}/reset-password`;
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
          if (error) throw normalizeError(error);
        },
        updatePassword: async (password) => {
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw normalizeError(error);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return value;
}
