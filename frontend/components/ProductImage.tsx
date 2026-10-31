"use client";

import { useState } from "react";
import type { Category } from "@/lib/types";

const CATEGORY_LABEL: Record<Category, string> = {
  top: "Top",
  outer: "Jacket",
  bottom: "Bottoms",
  bag: "Bag",
};

/** Product photo in a fixed 4:5 frame; shows a quiet placeholder when there is no image or it fails to load. */
export function ProductImage({ src, alt, category }: { src: string; alt: string; category: Category }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="aspect-[4/5] w-full overflow-hidden rounded-photo bg-sage-tint">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <div
          {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
          className="flex size-full items-center justify-center"
        >
          <span className="text-label font-medium tracking-wide text-muted uppercase">{CATEGORY_LABEL[category]}</span>
        </div>
      )}
    </div>
  );
}
