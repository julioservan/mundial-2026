export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row gap-6 md:gap-2 justify-between items-start md:items-center">
          <div>
            <p className="font-display text-3xl text-accent leading-none">
              Mundialistas<span className="not-italic font-sans font-bold">2026</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2 tracking-wide uppercase">
              11 jun → 19 jul · USA · CAN · MEX
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            Hecho por{" "}
            <a
              href="https://instagram.com/julioservan"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-accent transition-colors underline underline-offset-4 decoration-accent/50"
            >
              Julio Servan
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
