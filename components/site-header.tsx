import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-[#f7f3eb]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="no-underline text-foreground">
          <span className="block font-serif text-xl leading-none tracking-tight">Ground Record</span>
          <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Russia–Ukraine · sources attached
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/#map" className="text-foreground no-underline hover:underline">
            Map
          </Link>
          <Link href="/method" className="text-foreground no-underline hover:underline">
            How to read this
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
        <p>
          Ground Record does not adopt a side’s number and does not write a house narrative.
          Live lines are what public feeds published. Sample blocks are labeled and were written
          so the pages have a shape. Background quotes are from Wikipedia, used under{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
        </p>
      </div>
    </footer>
  );
}
