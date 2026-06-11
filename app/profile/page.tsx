"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth";
import { getSupabase } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { TIMEZONES } from "@/lib/timezones";
import { fetchLeaderboard } from "@/lib/leaderboard";
import { levelLabel } from "@/lib/roles";

const AVATAR_BUCKET = "mundial-avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export default function ProfilePage() {
  const router = useRouter();
  const { loading, user, profile, signOut, refreshProfile } = useAuth();

  // `draft` es null mientras no se haya editado: el campo muestra el valor del
  // perfil. Así evitamos sincronizar estado desde un efecto.
  const [draft, setDraft] = useState<string | null>(null);
  const username = draft ?? profile?.username ?? "";
  const [tzDraft, setTzDraft] = useState<string | null>(null);
  const timezone = tzDraft ?? profile?.timezone ?? "";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<{
    rank: number;
    points: number;
    correct: number;
    scored: number;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Carga el puesto y puntos del usuario en el ranking.
  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) return;
      try {
        const board = await fetchLeaderboard();
        const idx = board.findIndex((e) => e.userId === user.id);
        if (active && idx >= 0) {
          const me = board[idx];
          setStats({
            rank: idx + 1,
            points: me.points,
            correct: me.correct,
            scored: me.predictionsScored,
          });
        }
      } catch {
        // sin stats, no pasa nada
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user]);

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-subir el mismo archivo
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("La imagen es muy grande (máx. 2 MB).");
      return;
    }

    setUploading(true);
    setError(null);
    setSaved(false);

    const supabase = getSupabase();
    const path = `${user.id}/avatar`;

    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setError(upErr.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    // ?v= rompe la caché para que se vea la foto nueva al instante.
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

    const { error: dbErr } = await supabase
      .from("mundial_profiles")
      .upsert(
        { id: user.id, avatar_url: publicUrl, username: username.trim() || "Jugador" },
        { onConflict: "id" },
      );
    if (dbErr) {
      setError(dbErr.message);
      setUploading(false);
      return;
    }

    await refreshProfile();
    setUploading(false);
    setSaved(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    // Upsert: crea la fila del perfil si aún no existe, o actualiza los datos.
    const { error } = await getSupabase().from("mundial_profiles").upsert(
      {
        id: user.id,
        username: username.trim(),
        timezone: timezone || null,
      },
      { onConflict: "id" },
    );

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await refreshProfile();
    setDraft(null);
    setTzDraft(null);
    setSaved(true);
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 py-20 text-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-16">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Tu perfil
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Hola,{" "}
          <span className="font-display text-accent">
            {profile?.username ?? "jugador"}.
          </span>
        </h1>
        <span
          className={`inline-block mt-3 text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 border ${
            profile?.is_admin
              ? "text-accent border-accent/40 bg-accent-soft"
              : "text-muted-foreground border-border"
          }`}
        >
          Nivel: {levelLabel(profile?.is_admin)}
        </span>
      </header>

      {stats && (
        <Link
          href="/leaderboard"
          className="block bg-surface border border-border rounded-2xl p-5 mb-4 hover:border-accent/40 transition-colors"
        >
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat value={`#${stats.rank}`} label="Puesto" highlight />
            <Stat value={stats.points} label="Puntos" highlight />
            <Stat value={stats.correct} label="Aciertos" />
            <Stat value={stats.scored} label="Jugados" />
          </div>
        </Link>
      )}

      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-4 mb-6">
          <Avatar
            url={profile?.avatar_url ?? null}
            name={profile?.username ?? "?"}
            size={72}
            className="text-2xl shrink-0"
          />
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 text-sm font-semibold border border-border-strong rounded-full hover:bg-surface-muted transition-colors disabled:opacity-60"
            >
              {uploading ? "Subiendo…" : "Cambiar foto"}
            </button>
            <p className="text-xs text-muted-foreground mt-1.5">
              JPG o PNG, máx. 2 MB.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatar}
            className="hidden"
          />
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Nombre de jugador
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setDraft(e.target.value);
                setSaved(false);
              }}
              required
              className="mt-1.5 w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Zona horaria
            </span>
            <select
              value={timezone}
              onChange={(e) => {
                setTzDraft(e.target.value);
                setSaved(false);
              }}
              className="mt-1.5 w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1.5">
              Usamos tu zona horaria para mostrarte la hora de cada partido en tu
              hora local. Así no tienes que calcular la diferencia.
            </p>
          </label>

          <div className="text-xs text-muted-foreground">
            Sesión: <span className="text-foreground">{user.email}</span>
          </div>

          {error && (
            <p className="text-sm text-pink bg-pink/10 border border-pink/30 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-sm text-accent bg-accent-soft border border-accent/30 rounded-xl px-4 py-3">
              Guardado ✓
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-accent text-accent-foreground font-semibold rounded-full hover:bg-accent-bold transition-colors disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </div>

      {profile?.is_admin && (
        <Link
          href="/admin"
          className="mt-4 block text-center text-sm font-semibold text-accent hover:underline underline-offset-4"
        >
          Panel de administración →
        </Link>
      )}

      <button
        onClick={async () => {
          await signOut();
          router.push("/");
        }}
        className="mt-6 w-full py-3 border border-border-strong font-semibold rounded-full hover:bg-surface transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

function Stat({
  value,
  label,
  highlight,
}: {
  value: string | number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        className={`font-display text-2xl sm:text-3xl leading-none ${
          highlight ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
        {label}
      </div>
    </div>
  );
}
