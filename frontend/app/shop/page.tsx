import type { Metadata } from "next";
import { ShopBrowser } from "@/components/ShopBrowser";
import { catalogItems } from "@/lib/catalog";

export const metadata: Metadata = { title: "Shop" };

export default function ShopPage() {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 md:gap-8 md:px-8 lg:px-12 md:py-12">
      {/* The nav already says where you are; the heading is for screen readers. */}
      <h1 className="sr-only">Shop</h1>
      <ShopBrowser items={catalogItems} />
    </main>
  );
}
