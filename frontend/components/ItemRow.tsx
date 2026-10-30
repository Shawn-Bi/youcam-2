"use client";

import { formatPrice } from "@/lib/format";
import type { Item } from "@/lib/types";
import { ProductImage } from "./ProductImage";

const smallButton =
  "min-h-11 rounded-full border border-line px-4 text-small font-medium text-ink hover:bg-sage-tint disabled:cursor-wait";

type Props = {
  item: Item;
  viewing: boolean;
  busy: boolean;
  onView: () => void;
  onSize: (size: string) => void;
  onToggleLock: () => void;
  onReplace: () => void;
};

/** One editable item in a proposal: view its preview, change size, lock it, or replace it. */
export function ItemRow({ item, viewing, busy, onView, onSize, onToggleLock, onReplace }: Props) {
  const sizeId = `size-${item.itemId}`;
  return (
    <li className={`flex gap-3 rounded-card p-3 ${viewing ? "bg-sage-tint" : ""}`}>
      <button
        type="button"
        onClick={onView}
        aria-pressed={viewing}
        aria-label={`Show ${item.name} in the preview`}
        className="w-16 shrink-0 rounded-field"
      >
        <ProductImage src={item.imageUrl} alt="" category={item.category} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-small font-medium text-ink">{item.name}</p>
          <p className="text-small font-medium tabular-nums text-ink">{formatPrice(item.price)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.sizesInStock.length > 0 ? (
            <>
              <label htmlFor={sizeId} className="sr-only">
                Size for {item.name}
              </label>
              <select
                id={sizeId}
                value={item.size ?? ""}
                onChange={(e) => onSize(e.target.value)}
                disabled={busy}
                className="min-h-11 rounded-full border border-line bg-surface px-3 text-small text-ink"
              >
                {item.sizesInStock.map((s) => (
                  <option key={s} value={s}>
                    Size {s}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="rounded-full bg-sand px-3 py-1 text-label font-medium text-on-sand">One size</span>
          )}
          <button type="button" onClick={onToggleLock} disabled={busy} aria-pressed={item.locked} className={smallButton}>
            {item.locked ? "Locked" : "Lock"}
          </button>
          {!item.locked && (
            <button type="button" onClick={onReplace} disabled={busy} className={smallButton}>
              Replace
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
