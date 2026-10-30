"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/shop", label: "Shop", match: (p: string) => p.startsWith("/shop") || p.startsWith("/products") },
  { href: "/stores", label: "Stores", match: (p: string) => p.startsWith("/stores") },
  {
    href: "/brief",
    label: "Style brief",
    match: (p: string) => p.startsWith("/brief") || p.startsWith("/proposals") || p.startsWith("/saved"),
  },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-stone">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 px-4 md:h-18 md:px-6">
        <Link href="/" className="flex min-h-14 items-center gap-2 rounded-field">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span className="font-display text-h2 font-semibold text-ink">Look Exchange</span>
        </Link>
        <nav aria-label="Main" className="-mx-3 flex w-full md:mx-0 md:w-auto">
          {NAV.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center border-b-2 px-3 text-small font-medium md:px-4 ${
                  active ? "border-terracotta text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
