"use client";

import Link from "next/link";
import { useAuth } from "@/lib/supabase/auth";
import { Avatar } from "@/components/Avatar";

// variant "desktop" -> chip a la derecha de la barra (oculto en móvil).
// variant "mobile"  -> entrada dentro del menú móvil deslizable.
export function AuthNav({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const { loading, user, profile } = useAuth();
  const mobile = variant === "mobile";

  if (loading) {
    return mobile ? null : <div className="hidden sm:block w-20 h-9" aria-hidden />;
  }

  if (user) {
    return (
      <Link
        href="/profile"
        className={
          mobile
            ? "inline-flex items-center gap-2 px-3 py-1 text-sm font-semibold text-foreground whitespace-nowrap"
            : "hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-border-strong rounded-full hover:bg-surface transition-colors"
        }
      >
        <Avatar
          url={profile?.avatar_url ?? null}
          name={profile?.username ?? "?"}
          size={mobile ? 22 : 24}
          className="text-xs"
        />
        <span className="max-w-[8rem] truncate">
          {profile?.username ?? "Perfil"}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      className={
        mobile
          ? "inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold text-accent whitespace-nowrap"
          : "hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-accent text-accent-foreground rounded-full hover:bg-accent-bold transition-colors"
      }
    >
      Entrar
      <span aria-hidden>→</span>
    </Link>
  );
}
