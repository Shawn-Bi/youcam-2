"use client";

import Link from "next/link";
import { useState } from "react";
import { SIZES, type CatalogItem } from "@/lib/catalog";

/** Size picker and the way into the style brief, carrying this piece and size along. */
export function ProductActions({ item }: { item: CatalogItem }) {
  const [size, setSize] = useState<string | null>(null);
  const sized = item.sizesInStock.length > 0;
  const query = new URLSearchParams({ item: item.itemId, ...(size ? { size } : {}) });

  return (
    <div className="flex flex-col gap-6">
      {sized ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-small font-medium text-ink">
            Size{size ? `: ${size}` : ""}
          </legend>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => {
              const inStock = item.sizesInStock.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!inStock}
                  aria-pressed={size === s}
                  onClick={() => setSize(s)}
                  aria-label={inStock ? s : `${s}, sold out`}
                  className={`min-h-11 min-w-14 rounded-full border px-4 text-small font-medium ${
                    size === s
                      ? "border-sage bg-sage text-on-sage"
                      : inStock
                        ? "border-line bg-surface text-ink hover:border-sage"
                        : "cursor-not-allowed border-line text-muted line-through"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="text-small text-muted">One size</p>
      )}

      <div className="flex flex-col gap-3">
        <Link
          href={`/brief?${query}`}
          className="flex min-h-12 items-center justify-center rounded-full bg-sage px-6 text-body font-medium text-on-sage hover:bg-sage-hover"
        >
          Style a look around this
        </Link>
        <p className="text-small text-muted">
          Post a style brief with this piece. Both stores build an outfit around it that you can try on your own photo.
        </p>
      </div>
    </div>
  );
}
