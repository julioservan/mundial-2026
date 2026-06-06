export const metadata = {
  title: "Iniciar sesión · Mundial 2026",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-20">
      <div className="bg-surface border border-border rounded-3xl p-10 text-center">
        <div className="font-display text-6xl text-accent mb-2">⚽</div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Entrar al{" "}
          <span className="font-display text-accent">Mundial.</span>
        </h1>
        <p className="text-muted-foreground mb-8 text-sm">
          La autenticación se conectará con Supabase próximamente. Por ahora tus
          predicciones se guardan localmente en tu navegador.
        </p>
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] uppercase bg-accent-soft text-accent border border-accent/30 px-3 py-1.5 rounded-full">
          🚧 Próximamente
        </div>
      </div>
    </div>
  );
}
