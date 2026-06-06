import Link from "next/link";

const LINKS = [
  { href: "/matches", label: "Partidos" },
  { href: "/groups", label: "Grupos" },
  { href: "/eliminatoria", label: "Eliminatoria" },
  { href: "/predictions", label: "Predicciones" },
  { href: "/leaderboard", label: "Ranking" },
];

export function Navbar() {
  return (
    <header className="border-b border-border bg-background/70 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="relative w-8 h-8 rounded-full bg-accent flex items-center justify-center text-base">
            <span aria-hidden>⚽</span>
            <span className="absolute inset-0 rounded-full pulse-ring" aria-hidden />
          </span>
          <span className="font-semibold tracking-tight text-base">
            Mundial<span className="font-display not-italic text-accent">26</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/login"
          className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-accent text-accent-foreground rounded-full hover:bg-accent-bold transition-colors"
        >
          Entrar
          <span aria-hidden>→</span>
        </Link>
      </div>

      <nav className="md:hidden border-t border-border overflow-x-auto">
        <div className="flex gap-1 px-4 py-2 min-w-max">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1 text-sm font-medium text-muted-foreground whitespace-nowrap"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
