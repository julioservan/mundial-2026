"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./client";

export interface MundialProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  timezone: string | null;
  is_admin: boolean;
}

interface AuthState {
  configured: boolean;
  loading: boolean;
  user: User | null;
  profile: MundialProfile | null;
  signUp: (
    email: string,
    password: string,
    username: string,
  ) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string): Promise<MundialProfile | null> {
  const { data } = await getSupabase()
    .from("mundial_profiles")
    .select("id, username, avatar_url, timezone, is_admin")
    .eq("id", userId)
    .maybeSingle();
  return (data as MundialProfile) ?? null;
}

// Un correo nunca es un nombre para mostrar: nos quedamos con la parte local.
function sanitizeUsername(raw: string | undefined | null): string | null {
  const v = raw?.trim();
  if (!v) return null;
  return v.includes("@") ? v.split("@")[0] || null : v;
}

// Garantiza que exista una fila de perfil para el usuario. Lo hacemos en el
// cliente (en vez de con un trigger sobre auth.users) para no tocar la
// configuración del proyecto Supabase compartido.
async function ensureProfile(
  user: User,
  fallbackUsername?: string,
): Promise<MundialProfile | null> {
  const existing = await fetchProfile(user.id);
  if (existing) {
    // Reparación de cuentas antiguas que guardaron el correo entero como
    // nombre de usuario: se reescribe con la parte antes de la @.
    if (user.email && existing.username === user.email) {
      const username = sanitizeUsername(user.email) ?? "Jugador";
      const { data } = await getSupabase()
        .from("mundial_profiles")
        .update({ username })
        .eq("id", user.id)
        .select("id, username, avatar_url, timezone, is_admin")
        .maybeSingle();
      return (data as MundialProfile) ?? { ...existing, username };
    }
    return existing;
  }

  const username =
    sanitizeUsername(fallbackUsername) ||
    sanitizeUsername(user.user_metadata?.username as string | undefined) ||
    sanitizeUsername(user.email) ||
    "Jugador";

  const { data, error } = await getSupabase()
    .from("mundial_profiles")
    .upsert({ id: user.id, username }, { onConflict: "id" })
    .select("id, username, avatar_url, timezone, is_admin")
    .maybeSingle();
  if (error) {
    // No bloquea la app, pero deja rastro para diagnosticar (p. ej. RLS).
    console.error("No se pudo crear el perfil:", error.message);
  }
  return (data as MundialProfile) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Si no hay credenciales no hay nada que cargar.
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MundialProfile | null>(null);

  const applySession = useCallback(async (session: Session | null) => {
    const nextUser = session?.user ?? null;
    setUser(nextUser);
    setProfile(nextUser ? await ensureProfile(nextUser) : null);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await applySession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) return { error: error.message };
      // Si la confirmación de email está desactivada, ya hay sesión: crea perfil.
      if (data.user && data.session) await ensureProfile(data.user, username);
      return { error: null };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) setProfile(await fetchProfile(user.id));
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      user,
      profile,
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [loading, user, profile, signUp, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
