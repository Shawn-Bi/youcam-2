import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopBrowser } from "@/components/ShopBrowser";
import { getStore, itemsInStore, stores } from "@/lib/catalog";

type Params = { params: Promise<{ storeId: string }> };

export function generateStaticParams() {
  return stores.map((s) => ({ storeId: s.storeId }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const store = getStore((await params).storeId);
  return { title: store?.name ?? "Store" };
}

export default async function StorePage({ params }: Params) {
  const store = getStore((await params).storeId);
  if (!store) notFound();

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line bg-sand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={store.heroImage} alt="" className="absolute inset-0 size-full object-cover md:left-1/3 md:w-2/3" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone via-stone/85 to-stone/10 md:via-stone/70 md:to-transparent" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-2 px-4 py-12 md:px-6 md:py-16">
          <Link href="/stores" className="inline-flex min-h-11 items-center self-start text-small font-medium text-sage underline">
            All stores
          </Link>
          <h1 className="font-display text-display font-medium text-ink md:text-hero">{store.name}</h1>
          <p className="max-w-sm text-body text-muted md:text-h2 md:font-display">{store.description}</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <ShopBrowser items={itemsInStore(store.storeId)} storeFilter={false} />
      </div>
    </main>
  );
}
