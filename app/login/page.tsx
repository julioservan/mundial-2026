"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { configured, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    const result =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, username);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === "signup") {
      // Si la confirmación de email está activa no habrá sesión todavía.
      setNotice(
        "Cuenta creada. Si tu proyecto pide confirmar el email, revisa tu bandeja; si no, ya puedes entrar.",
      );
      setMode("signin");
      return;
    }

    router.push("/predictions");
  }

  if (!configured) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 py-20">
        <div className="bg-surface border border-border rounded-3xl p-10 text-center">
          <div className="font-display text-6xl text-accent mb-2">⚽</div>
          <h1 className="text-2xl font-bold tracking-tight mb-3">
            Configuración pendiente
          </h1>
          <p className="text-muted-foreground text-sm">
            Faltan las variables de entorno de Supabase. Copia{" "}
            <code className="text-foreground">.env.example</code> a{" "}
            <code className="text-foreground">.env.local</code> y rellénalas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-20">
      <div className="bg-surface border border-border rounded-3xl p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="font-display text-5xl text-accent mb-2">⚽</div>
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "signin" ? "Entrar al " : "Únete al "}
            <span className="font-display text-accent">Mundial.</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {mode === "signin"
              ? "Accede para guardar tus predicciones y competir."
              : "Crea tu cuenta para entrar en la liga."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <Field
              label="Nombre de jugador"
              type="text"
              value={username}
              onChange={setUsername}
              placeholder="Cómo te verán en el ranking"
              required
            />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="tu@email.com"
            required
          />
          <Field
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            required
          />

          {error && (
            <p className="text-sm text-pink bg-pink/10 border border-pink/30 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
          {notice && (
            <p className="text-sm text-accent bg-accent-soft border border-accent/30 rounded-xl px-4 py-3">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-accent text-accent-foreground font-semibold rounded-full hover:bg-accent-bold transition-colors disabled:opacity-60"
          >
            {submitting
              ? "Un momento…"
              : mode === "signin"
                ? "Entrar"
                : "Crear cuenta"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "signin" ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="font-semibold text-accent hover:underline underline-offset-4"
          >
            {mode === "signin" ? "Regístrate" : "Entra"}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
      />
    </label>
  );
}
