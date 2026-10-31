import Link from "next/link";
import type { Store } from "@/lib/catalog";

/** A large photo card for one store, with its name and tagline over the image. */
export function StoreCard({ store, headingLevel = 3 }: { store: Store; headingLevel?: 2 | 3 }) {
  // Dark-toned photos get white text over a dark fade; light ones get ink over stone.
  const dark = store.tone === "dark";
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Link
      href={`/stores/${store.storeId}`}
      className={`group relative flex min-h-72 overflow-hidden rounded-card md:min-h-96 ${dark ? "bg-ink" : "bg-sand"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={store.heroImage} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      <div
        className={`absolute inset-0 ${
          dark ? "bg-gradient-to-r from-black/75 via-black/35 to-transparent" : "bg-gradient-to-r from-stone/90 via-stone/50 to-transparent"
        }`}
      />
      <div className={`relative flex flex-col justify-center gap-3 p-6 md:p-8 ${dark ? "text-white" : "text-ink"}`}>
        <Heading className="font-display text-h1 font-medium lg:text-display">{store.name}</Heading>
        <p className="max-w-48 text-label font-medium tracking-[0.2em] uppercase">{store.tagline}</p>
      </div>
    </Link>
  );
}
