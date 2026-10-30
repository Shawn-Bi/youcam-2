"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { CATEGORY_NAMES, SIZES, stores, type CatalogItem } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import type { Category } from "@/lib/types";
import { ProductCard } from "./ProductCard";

const CATEGORIES = Object.keys(CATEGORY_NAMES) as Category[];

type Props = {
  items: CatalogItem[];
  /** Shows the store filter; off on a single store's page. */
  storeFilter?: boolean;
};

/** Product grid with category, store, size and price filters, plus the style-brief banner. */
export function ShopBrowser({ items, storeFilter = true }: Props) {
  const uid = useId();
  const maxPrice = Math.max(...items.map((i) => i.price));
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [size, setSize] = useState<string | null>(null);
  const [priceCap, setPriceCap] = useState(maxPrice);

  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          (categories.length === 0 || categories.includes(i.category)) &&
          (storeIds.length === 0 || storeIds.includes(i.storeId)) &&
          // Bags come in one size, so a size filter never hides them.
          (!size || i.sizesInStock.length === 0 || i.sizesInStock.includes(size)) &&
          i.price <= priceCap,
      ),
    [items, categories, storeIds, size, priceCap],
  );

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const filtered = categories.length > 0 || storeIds.length > 0 || size !== null || priceCap < maxPrice;
  const clear = () => {
    setCategories([]);
    setStoreIds([]);
    setSize(null);
    setPriceCap(maxPrice);
  };

  const check = "size-4 accent-sage";
  const groupTitle = "text-small font-medium text-ink";

  // Rendered twice (phone drawer, desktop column), so ids get a per-copy suffix.
  const filters = (copy: string) => (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className={`${groupTitle} mb-2`}>Category</legend>
        {CATEGORIES.map((c) => (
          <label key={c} className="flex min-h-11 items-center gap-3 text-small text-ink">
            <input type="checkbox" className={check} checked={categories.includes(c)} onChange={() => setCategories(toggle(categories, c))} />
            {CATEGORY_NAMES[c]}
          </label>
        ))}
      </fieldset>

      {storeFilter && (
        <fieldset className="flex flex-col gap-2 border-t border-line pt-5">
          <legend className={`${groupTitle} mb-2`}>Store</legend>
          {stores.map((s) => (
            <label key={s.storeId} className="flex min-h-11 items-center gap-3 text-small text-ink">
              <input type="checkbox" className={check} checked={storeIds.includes(s.storeId)} onChange={() => setStoreIds(toggle(storeIds, s.storeId))} />
              {s.name}
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2 border-t border-line pt-5">
        <legend className={`${groupTitle} mb-2`}>Size</legend>
        <div className="grid grid-cols-3 gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={size === s}
              onClick={() => setSize(size === s ? null : s)}
              className={`min-h-11 rounded-full border text-small font-medium ${
                size === s ? "border-sage bg-sage text-on-sage" : "border-line bg-surface text-ink hover:border-sage"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <label htmlFor={`${uid}-${copy}-price`} className={groupTitle}>
          Price
        </label>
        <p className="text-small text-muted">Up to {formatPrice(priceCap)}</p>
        <input
          id={`${uid}-${copy}-price`}
          type="range"
          min={10}
          max={maxPrice}
          step={1}
          value={priceCap}
          onChange={(e) => setPriceCap(Number(e.target.value))}
          className="accent-sage"
        />
      </div>

      {filtered && (
        <button type="button" onClick={clear} className="min-h-11 self-start text-small font-medium text-sage underline">
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr] md:gap-8">
      <aside aria-label="Filters" className="self-start rounded-card bg-surface px-5 py-1 md:p-5">
        <details className="md:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center text-small font-medium text-ink">
            Filters{filtered ? " (on)" : ""}
          </summary>
          <div className="pt-4">{filters("m")}</div>
        </details>
        <div className="hidden md:block">{filters("d")}</div>
      </aside>

      <div className="flex flex-col gap-5">
        <BriefBanner />
        <p className="text-small text-muted" aria-live="polite">
          {shown.length} {shown.length === 1 ? "piece" : "pieces"}
        </p>
        {shown.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((item) => (
              <ProductCard key={item.itemId} item={item} showStore={storeFilter} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-2 rounded-card bg-surface p-6">
            <p className="text-body text-ink">Nothing matches these filters.</p>
            <button type="button" onClick={clear} className="min-h-11 text-small font-medium text-sage underline">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Points shoppers who aren't sure what to pick toward the style brief. */
export function BriefBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-sage-tint px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-small text-ink sm:text-body">
        <span aria-hidden="true" className="mr-2 text-sage">
          ✦
        </span>
        Not sure? Post a style brief and both stores will style you.
      </p>
      <Link
        href="/brief"
        className="flex min-h-11 shrink-0 items-center justify-center rounded-full bg-sage px-5 text-small font-medium text-on-sage hover:bg-sage-hover"
      >
        Style brief →
      </Link>
    </div>
  );
}
