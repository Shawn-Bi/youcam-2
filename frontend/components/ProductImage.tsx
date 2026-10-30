import type { Category } from "@/lib/types";

const CATEGORY_LABEL: Record<Category, string> = {
  top: "Top",
  outer: "Jacket",
  bottom: "Bottoms",
  bag: "Bag",
};

/** Product photo in a fixed 4:5 frame; shows a quiet placeholder until catalogs have images. */
export function ProductImage({ src, alt, category }: { src: string; alt: string; category: Category }) {
  return (
    <div className="aspect-[4/5] w-full overflow-hidden rounded-field bg-sage-tint">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <div role="img" aria-label={alt} className="flex size-full items-center justify-center">
          <span className="text-label font-medium tracking-wide text-muted uppercase">{CATEGORY_LABEL[category]}</span>
        </div>
      )}
    </div>
  );
}
