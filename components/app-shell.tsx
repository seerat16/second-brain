import Link from 'next/link'
import { NavLinks } from './nav-links'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="border-b border-border bg-index md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex flex-col gap-5 p-4 md:sticky md:top-0 md:p-6">
          <Link href="/" className="flex items-center gap-2.5 border-b border-border pb-4">
            <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-sm bg-margin font-serif text-sm text-background">
              P
            </span>
            <span className="font-serif text-xl">ProjectBrain</span>
          </Link>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Orbit</p>
          <NavLinks />
        </div>
      </aside>
      <main className="flex-1 border-margin/70 md:border-l">
        <div className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-8 md:px-10 md:py-12">{children}</div>
      </main>
    </div>
  )
}
