import type { Metadata } from "next";
import { ShopBrowser } from "@/components/ShopBrowser";
import { catalogItems } from "@/lib/catalog";

export const metadata: Metadata = { title: "Shop" };

export default function ShopPage() {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 md:gap-8 md:px-8 lg:px-12 md:py-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h1 font-medium text-ink md:text-display">Shop everything</h1>
        <p className="text-body text-muted">Every piece from Northline and Mono Studio.</p>
      </div>
      <ShopBrowser items={catalogItems} />
    </main>
  );
}
