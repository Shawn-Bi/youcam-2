import type { Metadata } from "next";
import { StoreCard } from "@/components/StoreCard";
import { stores } from "@/lib/catalog";

export const metadata: Metadata = { title: "Stores" };

export default function StoresPage() {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 md:gap-8 md:px-8 lg:px-12 md:py-12">
      {/* The nav already says where you are; the heading is for screen readers. */}
      <h1 className="sr-only">Stores</h1>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {stores.map((store) => (
          <StoreCard key={store.storeId} store={store} headingLevel={2} />
        ))}
      </div>
    </main>
  );
}
