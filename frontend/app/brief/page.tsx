import type { Metadata } from "next";
import { Suspense } from "react";
import { BriefForm } from "@/components/BriefForm";

export const metadata: Metadata = { title: "Style brief" };

export default function BriefPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10 md:py-14">
      <div className="flex flex-col gap-3">
        <p className="text-label font-medium tracking-[0.2em] text-terracotta-text uppercase">Style brief</p>
        <h1 className="font-display text-display font-medium text-ink md:text-hero">Tell us the look</h1>
        <p className="text-body text-muted md:text-h2 md:font-display">
          All four stores answer with outfits in your size and budget. Try each one on your own photo.
        </p>
      </div>
      {/* BriefForm reads ?item= and ?size= from a product page. */}
      <Suspense>
        <BriefForm />
      </Suspense>
    </main>
  );
}
