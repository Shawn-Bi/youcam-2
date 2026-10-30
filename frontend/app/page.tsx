import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { StoreCard } from "@/components/StoreCard";
import { getCatalogItem, stores, type CatalogItem } from "@/lib/catalog";

const NEW_IN = ["nl_racer_jacket", "ms_knit_sweater", "nl_chrome_cami", "ms_nova_bag"]
  .map(getCatalogItem)
  .filter((i): i is CatalogItem => Boolean(i));

export default function Home() {
  const inset = getCatalogItem("nl_luna_bag");
  return (
    <main className="flex flex-col gap-14 pb-16 md:gap-20">
      <section className="relative overflow-hidden bg-sand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/catalog/home-hero.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover object-[70%_center] md:left-[30%] md:w-[70%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone via-stone/70 to-transparent md:bg-gradient-to-r md:from-stone md:via-stone/80 md:to-transparent" />
        <div className="relative mx-auto flex min-h-[560px] max-w-6xl flex-col justify-end gap-6 px-4 pt-48 pb-10 md:min-h-[600px] md:justify-center md:px-6 md:py-20">
          <h1 className="max-w-xl font-display text-display font-medium text-ink md:text-hero">
            Two stores.
            <br />
            One look. Yours.
          </h1>
          <p className="max-w-md text-body text-ink md:text-h2 md:font-display">
            Describe the look you want. Two stores style you, and you try it on your own photo.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/brief"
              className="flex min-h-12 items-center rounded-full bg-sage px-7 text-body font-medium text-on-sage hover:bg-sage-hover"
            >
              Post a style brief →
            </Link>
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center border-b-2 border-terracotta text-body font-medium text-ink"
            >
              Browse the shops
            </Link>
          </div>
        </div>
        {inset && (
          <Link
            href={inset.productUrl}
            className="absolute right-[4%] bottom-10 hidden w-40 rotate-2 rounded-card border-4 border-surface bg-surface shadow-[0_16px_40px_-16px_rgb(0_0_0/0.35)] lg:block"
            aria-label={`${inset.name}, from Northline`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={inset.imageUrl} alt="" className="aspect-[4/5] w-full rounded-photo object-cover" />
          </Link>
        )}
      </section>

      <section aria-labelledby="stores-heading" className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 md:px-6">
        <h2 id="stores-heading" className="font-display text-h1 font-medium text-ink">
          Shop the stores
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {stores.map((store, i) => (
            <StoreCard key={store.storeId} store={store} dark={i === 0} />
          ))}
        </div>
      </section>

      <section aria-labelledby="new-heading" className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 md:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="new-heading" className="font-display text-h1 font-medium text-ink">
            New in
          </h2>
          <Link href="/shop" className="inline-flex min-h-11 items-center text-small font-medium text-sage underline">
            Shop everything
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {NEW_IN.map((item) => (
            <ProductCard key={item.itemId} item={item} />
          ))}
        </ul>
      </section>
    </main>
  );
}
