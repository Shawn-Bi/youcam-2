import Link from "next/link";
import { getStore, type CatalogItem } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "./ProductImage";

/** A product tile in the shop grids: photo, name, store and price, linking to the product page. */
export function ProductCard({ item, showStore = true }: { item: CatalogItem; showStore?: boolean }) {
  return (
    <li>
      <Link
        href={`/products/${item.itemId}`}
        className="group flex h-full flex-col gap-3 rounded-card bg-surface p-2 pb-4 transition-shadow hover:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)]"
      >
        <ProductImage src={item.imageUrl} alt="" category={item.category} />
        <div className="flex flex-col gap-0.5 px-2">
          {showStore && (
            <span className="text-label font-medium tracking-[0.12em] text-muted uppercase">{getStore(item.storeId)?.name}</span>
          )}
          <span className="text-small font-medium text-ink group-hover:underline">{item.name}</span>
          <span className="font-display text-price text-ink tabular-nums">{formatPrice(item.price)}</span>
        </div>
      </Link>
    </li>
  );
}
