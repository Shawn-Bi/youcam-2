import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-line bg-stone">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-field">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span className="font-display text-h2 font-semibold text-ink">Look Exchange</span>
        </Link>
      </div>
    </header>
  );
}
