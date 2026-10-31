import type { Metadata } from "next";
import Link from "next/link";
import { ProposalCard } from "@/components/ProposalCard";
import { FrameLabel, TryOnViewer } from "@/components/TryOnViewer";
import { VideoPanel } from "@/components/VideoPanel";
import {
  EXAMPLE_BRIEF,
  EXAMPLE_ITEM_ID,
  EXAMPLE_PHOTO,
  EXAMPLE_PROPOSALS,
  EXAMPLE_STORE_ID,
  EXAMPLE_TRY_ON,
  EXAMPLE_VIDEO,
} from "@/lib/example";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Example" };

const eyebrow = "text-label font-medium tracking-[0.2em] text-terracotta-text uppercase";
const sectionTitle = "font-display text-h2 font-medium text-ink md:text-h1";

/**
 * A replay of the first full run on the live site: the brief, the four answers, the try-on and the video.
 * Everything is stored with the site, so the page needs no photo, spends no YouCam units and calls no API.
 */
export default function ExamplePage() {
  const haven = EXAMPLE_PROPOSALS.find((p) => p.storeId === EXAMPLE_STORE_ID);
  const piece = haven?.items.find((i) => i.itemId === EXAMPLE_ITEM_ID);
  if (!haven || !piece) return null;

  return (
    <main className="mx-auto flex max-w-page flex-col gap-10 px-4 py-10 md:gap-14 md:px-8 md:py-14 lg:px-12">
      <header className="flex max-w-3xl flex-col gap-3">
        <p className={eyebrow}>Example</p>
        <h1 className="font-display text-h1 font-medium text-ink md:text-display">One brief, start to finish</h1>
        <p className="text-body text-muted">
          This replays a real run on Look Exchange, so you can see it without adding a photo or waiting. Nothing here is made live,
          which is why it loads at once.
        </p>
      </header>

      <section aria-labelledby="brief-heading" className="flex flex-col gap-4">
        <h2 id="brief-heading" className={sectionTitle}>
          1. The brief
        </h2>
        <div className="flex flex-col gap-4 rounded-card bg-surface p-5 md:flex-row md:items-center md:justify-between md:gap-8 md:p-7">
          <div className="flex flex-col gap-2">
            <p className="font-display text-h2 text-ink md:text-h1">&ldquo;{EXAMPLE_BRIEF.text}&rdquo;</p>
            <p className="text-small text-muted">
              Top size {EXAMPLE_BRIEF.size} · Budget {formatPrice(EXAMPLE_BRIEF.budget)} · Started from the cardigan&apos;s product
              page
            </p>
          </div>
          <Link
            href="/brief"
            className="flex min-h-12 shrink-0 items-center justify-center self-start rounded-full bg-sage px-7 text-body font-medium text-on-sage hover:bg-sage-hover md:self-center"
          >
            Try it with your photo
          </Link>
        </div>
      </section>

      <section aria-labelledby="answers-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="answers-heading" className={sectionTitle}>
            2. Four stores answer
          </h2>
          <p className="text-small text-muted">
            Each store styled the same brief from its own shelves. Haven built its look around the cardigan, so that is the one
            tried on below.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {EXAMPLE_PROPOSALS.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      </section>

      <section aria-labelledby="tryon-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="tryon-heading" className={sectionTitle}>
            3. Haven&apos;s look, tried on
          </h2>
          <p className="text-small text-muted">
            The shopper is a fictional person made with AI image generation. YouCam put the cardigan on that photo in about 10
            seconds.
          </p>
        </div>
        {/* The first column is as wide as the try-on (3fr of the viewer's 3fr + 2fr), so the two photos line up. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[calc((100%_-_1.5rem)*0.375)_1fr]">
          <div className="relative aspect-[3/4] self-start overflow-hidden rounded-card border border-line bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={EXAMPLE_PHOTO}
              alt="The example shopper, a fictional person, standing in a white t-shirt and jeans"
              className="size-full object-cover"
            />
            <FrameLabel ai>AI-generated photo</FrameLabel>
          </div>
          <TryOnViewer
            item={piece}
            previewId={null}
            finished={{ imageUrl: EXAMPLE_TRY_ON, alt: `The example shopper wearing the ${piece.name}` }}
          />
        </div>
      </section>

      <section aria-labelledby="video-note" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="video-note" className={sectionTitle}>
            4. Then a 5-second video
          </h2>
          <p className="text-small text-muted">
            Made from the try-on above. It took about 11 minutes in this run, so on the live site it works in the background
            while you keep editing.
          </p>
        </div>
        <VideoPanel
          proposal={haven}
          previewId={null}
          itemName={piece.name}
          finished={{ videoUrl: EXAMPLE_VIDEO, poster: EXAMPLE_TRY_ON }}
        />
      </section>

      <section className="flex flex-col items-start gap-4 rounded-card bg-sage-tint p-5 md:flex-row md:items-center md:justify-between md:p-7">
        <p className="font-display text-h2 text-ink">Now try it on you.</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/brief"
            className="flex min-h-12 items-center rounded-full bg-sage px-7 text-body font-medium text-on-sage hover:bg-sage-hover"
          >
            Post a style brief
          </Link>
          <Link href="/shop" className="inline-flex min-h-11 items-center border-b-2 border-terracotta text-body font-medium text-ink">
            Browse the shops
          </Link>
        </div>
      </section>
    </main>
  );
}
