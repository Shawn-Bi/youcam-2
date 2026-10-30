import type { Metadata } from "next";
import { StoreCard } from "@/components/StoreCard";
import { stores } from "@/lib/catalog";

export const metadata: Metadata = { title: "Stores" };

export default function StoresPage() {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 md:gap-8 md:px-8 lg:px-12 md:py-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h1 font-medium text-ink md:text-display">The stores</h1>
        <p className="text-body text-muted">Shop each store, or post a style brief and let both style you.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {stores.map((store, i) => (
          <StoreCard key={store.storeId} store={store} dark={i === 0} headingLevel={2} />
        ))}
      </div>
    </main>
  );
}
