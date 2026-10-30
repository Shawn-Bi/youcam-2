import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { mainItem } from "@/lib/items";
import type { Proposal } from "@/lib/types";
import { ProductImage } from "./ProductImage";

const chip = "rounded-full bg-sand px-3 py-1 text-label font-medium text-on-sand";
const button =
  "min-h-12 flex-1 rounded-full px-5 text-body font-medium transition-colors disabled:cursor-wait";

/** Each store keeps one accent dot, so the two columns are easy to tell apart. */
const STORE_DOT: Record<string, string> = { northline: "bg-terracotta", "mono-studio": "bg-sage" };

type Props = {
  proposal: Proposal;
  busy: boolean;
  onPreview: () => void;
  onPick: () => void;
};

export function ProposalCard({ proposal, busy, onPreview, onPick }: Props) {
  const headingId = `store-${proposal.id}`;
  const hero = mainItem(proposal);
  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-5 rounded-card bg-surface p-4 md:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`mt-2 size-4 shrink-0 rounded-full ${STORE_DOT[proposal.storeId] ?? "bg-sand"}`} />
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="font-display text-h1 font-medium text-ink">
            {proposal.storeName}
          </h2>
          <p className="text-small text-muted">{proposal.rationale}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.1fr_1fr]">
        {hero && <ProductImage src={hero.imageUrl} alt={hero.name} category={hero.category} />}
        <ul className="flex flex-col gap-3">
          {proposal.items.map((item) => (
            <li key={item.itemId} className="flex gap-3 rounded-photo bg-stone p-2">
              <div className="w-16 shrink-0">
                <ProductImage src={item.imageUrl} alt="" category={item.category} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
                <p className="text-small font-medium text-ink">{item.name}</p>
                <p className="text-small text-muted">{item.size ? `Size ${item.size}` : "One size"}</p>
                <p className="font-display text-price text-ink tabular-nums">{formatPrice(item.price)}</p>
              </div>
            </li>
          ))}
          {proposal.kept.length > 0 && (
            <li>
              <ul className="flex flex-wrap gap-2" aria-label="Pieces you're keeping">
                {proposal.kept.map((piece) => (
                  <li key={piece} className={chip}>
                    Kept: {piece}
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
      </div>

      <div className="mt-auto flex flex-col gap-4 border-t border-line pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-small text-muted">Subtotal</span>
          <span className="font-display text-h2 text-ink tabular-nums">{formatPrice(proposal.subtotal)}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onPreview}
            disabled={busy}
            className={`${button} border border-sage text-sage hover:bg-sage-tint hover:text-sage-hover`}
          >
            Preview on me
          </button>
          <button type="button" onClick={onPick} disabled={busy} className={`${button} bg-sage text-on-sage hover:bg-sage-hover`}>
            {busy ? "Picking…" : "Pick this store"}
          </button>
        </div>
      </div>
    </article>
  );
}

type NoMatchProps = {
  proposal: Proposal;
  budget: number;
  nextBudget: number;
  busy: boolean;
  onRaiseBudget: () => void;
};

/** A store that found nothing: say what happened and offer one-click ways to loosen the brief. */
export function NoMatchCard({ proposal, budget, nextBudget, busy, onRaiseBudget }: NoMatchProps) {
  const headingId = `store-${proposal.id}`;
  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-4 self-start rounded-card border border-dashed border-line bg-surface p-4 md:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`mt-2 size-4 shrink-0 rounded-full ${STORE_DOT[proposal.storeId] ?? "bg-sand"}`} />
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="font-display text-h1 font-medium text-ink">
            {proposal.storeName}
          </h2>
          <p className="text-body text-ink">No match for this brief.</p>
          <p className="text-small text-muted">{proposal.rationale}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRaiseBudget}
          disabled={busy}
          className={`${button} bg-sage text-on-sage hover:bg-sage-hover`}
        >
          {busy ? "Asking again…" : `Raise budget to ${formatPrice(nextBudget)}`}
        </button>
        <Link href="/brief" className={`${button} flex items-center justify-center border border-line text-ink hover:bg-sage-tint`}>
          Edit brief
        </Link>
      </div>
      <p className="sr-only">Current budget {formatPrice(budget)}.</p>
    </article>
  );
}
