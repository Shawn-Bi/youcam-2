import type { Metadata } from "next";
import { Suspense } from "react";
import { BriefForm } from "@/components/BriefForm";

export const metadata: Metadata = { title: "Style brief" };

export default function BriefPage() {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-8 px-4 py-8 md:px-8 lg:px-12 [@media(max-height:760px)]:gap-5 [@media(max-height:760px)]:py-5">
      <h1 className="text-center font-display text-display font-medium text-ink">Tell us the look</h1>
      {/* BriefForm reads ?item= and ?size= from a product page. */}
      <Suspense>
        <BriefForm />
      </Suspense>
    </main>
  );
}
