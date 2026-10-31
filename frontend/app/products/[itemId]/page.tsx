import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductActions } from "@/components/ProductActions";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { CATEGORY_NAMES, catalogItems, getCatalogItem, getStore, itemsInStore } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";

type Params = { params: Promise<{ itemId: string }> };

export function generateStaticParams() {
  return catalogItems.map((i) => ({ itemId: i.itemId }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = getCatalogItem((await params).itemId);
  return { title: item?.name ?? "Product" };
}

export default async function ProductPage({ params }: Params) {
  const item = getCatalogItem((await params).itemId);
  const store = item && getStore(item.storeId);
  if (!item || !store) notFound();
  const more = itemsInStore(store.storeId)
    .filter((i) => i.itemId !== item.itemId)
    .slice(0, 4);

  return (
    <main className="mx-auto flex max-w-page flex-col gap-12 px-4 py-8 md:px-8 lg:px-12 md:py-12">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_1fr] md:gap-12">
        <div className="rounded-card bg-surface p-3">
          <ProductImage src={item.imageUrl} alt={item.name} category={item.category} />
        </div>

        <div className="flex flex-col gap-6 md:py-6">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-small text-muted">
            <Link href={`/stores/${store.storeId}`} className="inline-flex min-h-11 items-center font-medium text-sage underline">
              {store.name}
            </Link>
            <span aria-hidden="true">/</span>
            <span>{CATEGORY_NAMES[item.category]}</span>
          </nav>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-h1 font-medium text-ink md:text-display">{item.name}</h1>
            <p className="font-display text-h2 text-ink tabular-nums">{formatPrice(item.price)}</p>
          </div>
          <p className="text-body text-muted">
            {item.colors.join(" and ").replace(/^./, (c) => c.toUpperCase())}. Made for {item.styleTags.join(", ")} looks.
          </p>
          <ProductActions item={item} />
        </div>
      </div>

      {more.length > 0 && (
        <section aria-labelledby="more-heading" className="flex flex-col gap-5">
          <h2 id="more-heading" className="font-display text-h1 font-medium text-ink">
            More from {store.name}
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {more.map((i) => (
              <ProductCard key={i.itemId} item={i} showStore={false} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
