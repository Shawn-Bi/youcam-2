import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Proposal } from "@/lib/types";
import { ProductImage } from "./ProductImage";

const chip = "rounded-full bg-sand px-3 py-1 text-label font-medium text-on-sand";
const button =
  "min-h-11 flex-1 rounded-full border px-5 text-small font-medium transition-colors disabled:cursor-wait";

type Props = {
  proposal: Proposal;
  busy: boolean;
  onPreview: () => void;
  onPick: () => void;
};

export function ProposalCard({ proposal, busy, onPreview, onPick }: Props) {
  const headingId = `store-${proposal.id}`;
  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-5 rounded-card border border-line bg-surface p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="font-display text-h2 font-medium text-ink">
          {proposal.storeName}
        </h2>
        <p className="text-small text-muted">{proposal.rationale}</p>
      </div>

      <ul className="grid grid-cols-2 gap-3 md:gap-4">
        {proposal.items.map((item) => (
          <li key={item.itemId} className="flex min-w-0 flex-col gap-2">
            <ProductImage src={item.imageUrl} alt={item.name} category={item.category} />
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-small font-medium text-ink">{item.name}</p>
              <p className="text-small font-medium tabular-nums text-ink">{formatPrice(item.price)}</p>
            </div>
            <span className={`${chip} self-start`}>{item.size ? `Size ${item.size}` : "One size"}</span>
          </li>
        ))}
      </ul>

      {proposal.kept.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Pieces you're keeping">
          {proposal.kept.map((piece) => (
            <li key={piece} className={chip}>
              Kept: {piece}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-col gap-4 border-t border-line pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-small text-muted">Subtotal</span>
          <span className="text-price font-medium tabular-nums text-ink">{formatPrice(proposal.subtotal)}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onPreview}
            disabled={busy}
            className={`${button} border-sage text-sage hover:bg-sage-tint`}
          >
            Preview on me
          </button>
          <button
            type="button"
            onClick={onPick}
            disabled={busy}
            className={`${button} border-line text-ink hover:bg-sage-tint`}
          >
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
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="font-display text-h2 font-medium text-ink">
          {proposal.storeName}
        </h2>
        <p className="text-body text-ink">No match for this brief.</p>
        <p className="text-small text-muted">{proposal.rationale}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRaiseBudget}
          disabled={busy}
          className={`${button} border-line text-ink hover:bg-sage-tint`}
        >
          {busy ? "Asking again…" : `Raise budget to ${formatPrice(nextBudget)}`}
        </button>
        <Link href="/" className={`${button} flex items-center justify-center border-line text-ink hover:bg-sage-tint`}>
          Edit brief
        </Link>
      </div>
      <p className="sr-only">Current budget {formatPrice(budget)}.</p>
    </article>
  );
}
