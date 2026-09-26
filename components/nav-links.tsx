'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const NAV_ITEMS = [
  { href: '/', label: 'Timeline' },
  { href: '/capture', label: 'Capture' },
  { href: '/ask', label: 'Ask' },
  { href: '/check', label: 'Check' },
  { href: '/graph', label: 'Graph' },
  { href: '/lab', label: 'Lab' },
  { href: '/impact', label: 'Impact' },
] as const

export function NavLinks() {
  const pathname = usePathname()
  return (
    <nav aria-label="Main">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 md:flex-col md:gap-2">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block border-b py-1.5 font-serif text-lg transition-colors hover:text-foreground ${
                  active ? 'border-foreground text-foreground' : 'border-transparent text-foreground/75'
                }`}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
