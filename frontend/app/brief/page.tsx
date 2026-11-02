import type { Metadata } from "next";
import { Suspense } from "react";
import { BriefForm } from "@/components/BriefForm";

export const metadata: Metadata = { title: "Style brief" };

export default function BriefPage() {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 md:gap-8 md:px-8 lg:px-12 md:py-12">
      <div className="flex flex-col gap-2"><h1 className="font-display text-h1 font-medium text-ink md:text-display">What are we styling?</h1><p className="max-w-2xl text-body text-muted">Tell us the look. Four stores will put together proposals for you to compare and try on.</p></div>
      {/* BriefForm reads ?item= and ?size= from a product page. */}
      <Suspense>
        <BriefForm />
      </Suspense>
    </main>
  );
}
