import type { Metadata } from "next";
import { Suspense } from "react";
import { BriefForm } from "@/components/BriefForm";

export const metadata: Metadata = { title: "Style brief" };

export default function BriefPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:gap-8 md:px-8 md:py-8">
      <h1 className="text-center font-display text-display font-medium text-ink">Tell us the look</h1>
      {/* BriefForm reads ?item= and ?size= from a product page. */}
      <Suspense>
        <BriefForm />
      </Suspense>
    </main>
  );
}
