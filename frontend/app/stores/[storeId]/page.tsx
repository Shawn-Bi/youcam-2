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
        <img src={store.heroImage} alt="" className="absolute inset-0 size-full object-cover object-[center_12%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone via-stone/85 to-stone/60 md:from-stone/95 md:via-stone/60 md:via-50% md:to-transparent md:to-85%" />
        <div className="relative mx-auto flex max-w-page flex-col gap-2 px-4 py-14 md:px-8 lg:px-12 md:py-24">
          <Link href="/stores" className="inline-flex min-h-11 items-center self-start text-small font-medium text-sage underline">
            All stores
          </Link>
          <h1 className="font-display text-display font-medium text-ink md:text-hero">{store.name}</h1>
          <p className="max-w-xs text-body text-ink md:text-h2 md:font-display lg:max-w-lg">{store.description}</p>
        </div>
      </section>
      <div className="mx-auto max-w-page px-4 py-8 md:px-8 lg:px-12 md:py-10">
        <ShopBrowser items={itemsInStore(store.storeId)} storeFilter={false} />
      </div>
    </main>
  );
}
