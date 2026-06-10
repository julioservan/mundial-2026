"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth";
import { getSupabase } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";

const AVATAR_BUCKET = "mundial-avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export default function ProfilePage() {
  const router = useRouter();
  const { loading, user, profile, signOut, refreshProfile } = useAuth();

  // `draft` es null mientras no se haya editado: el campo muestra el valor del
  // perfil. Así evitamos sincronizar estado desde un efecto.
  const [draft, setDraft] = useState<string | null>(null);
  const username = draft ?? profile?.username ?? "";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

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

    // Upsert: crea la fila del perfil si aún no existe, o actualiza el nombre.
    const { error } = await getSupabase()
      .from("mundial_profiles")
      .upsert({ id: user.id, username: username.trim() }, { onConflict: "id" });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await refreshProfile();
    setDraft(null);
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
      </header>

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
          href="/admin/results"
          className="mt-4 block text-center text-sm font-semibold text-accent hover:underline underline-offset-4"
        >
          Panel de resultados (admin) →
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
