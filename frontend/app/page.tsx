import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { StoreCard } from "@/components/StoreCard";
import { getCatalogItem, stores, type CatalogItem } from "@/lib/catalog";

const NEW_IN = ["nl_racer_jacket", "sol_sequin_jacket", "hv_chunky_cardigan", "ms_nova_bag"]
  .map(getCatalogItem)
  .filter((i): i is CatalogItem => Boolean(i));

export default function Home() {
  const inset = getCatalogItem("nl_luna_bag");
  return (
    <main className="flex flex-col gap-10 pb-16 md:gap-14">
      <section className="relative overflow-hidden bg-sand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/catalog/home-hero.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover object-[70%_center] md:object-[85%_30%] lg:object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone via-stone/70 to-transparent md:bg-gradient-to-r md:from-stone/95 md:via-stone/55 md:via-45% md:to-transparent md:to-70%" />
        <div className="relative mx-auto flex min-h-[600px] max-w-page flex-col justify-end gap-7 px-4 pt-56 pb-10 md:min-h-[680px] md:justify-center md:px-8 lg:px-12 md:py-20">
          <h1 className="max-w-md font-display text-display font-medium text-ink md:max-w-sm lg:max-w-3xl lg:text-hero">
            Four stores.
            <br />
            One look. Yours.
          </h1>
          <p className="max-w-sm text-body text-ink md:text-h2 md:font-display lg:max-w-lg">
            Describe the look you want. Four stores style you, and you try each look on your own photo.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/brief"
              className="flex min-h-14 items-center rounded-full bg-sage px-8 text-body font-medium text-on-sage hover:bg-sage-hover"
            >
              Post a style brief
            </Link>
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center border-b-2 border-terracotta text-body font-medium text-ink"
            >
              Browse the shops
            </Link>
            <Link
              href="/example"
              className="inline-flex min-h-11 items-center border-b-2 border-terracotta text-body font-medium text-ink"
            >
              See an example
            </Link>
          </div>
        </div>
        {inset && (
          <Link
            href={inset.productUrl}
            className="absolute right-[4%] bottom-10 hidden w-48 rotate-2 rounded-card border-4 border-surface bg-surface shadow-[0_16px_40px_-16px_rgb(0_0_0/0.35)] lg:block"
            aria-label={`${inset.name}, from Northline`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={inset.imageUrl} alt="" className="aspect-[4/5] w-full rounded-photo object-cover" />
          </Link>
        )}
      </section>

      <section aria-labelledby="stores-heading" className="mx-auto flex w-full max-w-page flex-col gap-5 px-4 md:px-8 lg:px-12">
        <h2 id="stores-heading" className="font-display text-h1 font-medium text-ink">
          Shop the stores
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {stores.map((store) => (
            <StoreCard key={store.storeId} store={store} />
          ))}
        </div>
      </section>

      <section aria-labelledby="new-heading" className="mx-auto flex w-full max-w-page flex-col gap-5 px-4 md:px-8 lg:px-12">
        <h2 id="new-heading" className="font-display text-h1 font-medium text-ink">
          New in
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {NEW_IN.map((item) => (
            <ProductCard key={item.itemId} item={item} />
          ))}
        </ul>
      </section>
    </main>
  );
}
