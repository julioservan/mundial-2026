"use client";

import { useState } from "react";

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Foto de jugador con fallback (a un texto: dorsal o iniciales) si no hay
// imagen o el CDN la bloquea.
export function PlayerAvatar({
  photo,
  fallback,
  size = 28,
  alt,
}: {
  photo?: string | null;
  fallback: string;
  size?: number;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!photo || failed) {
    return (
      <span
        style={style}
        className="rounded-full bg-surface-muted shrink-0 flex items-center justify-center text-[10px] font-bold text-muted-foreground tabular-nums"
      >
        {fallback}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt={alt ?? ""}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="rounded-full object-cover bg-surface-muted shrink-0"
    />
  );
}
