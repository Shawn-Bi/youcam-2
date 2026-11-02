"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, ValidationError, createBrief, uploadPhoto } from "@/lib/api";
import { loadLatestBrief, saveBrief } from "@/lib/briefStore";
import { SIZES, getCatalogItem, getStore } from "@/lib/catalog";
import { ProductImage } from "./ProductImage";
import { formatPrice } from "@/lib/format";
import { parseBrief } from "@/lib/parseBrief";
import type { BriefInput, FieldErrors } from "@/lib/types";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
// Fields with their own error line; any other field error from the API shows above the button.
const SHOWN_FIELDS = ["photo", "consent", "text", "budget", "topSize"];
const PHOTO_TYPES = ["image/jpeg", "image/png"];

const inputClass =
  "w-full rounded-field border border-line bg-surface px-5 py-4 text-body text-ink placeholder:text-muted";
const smallLabel = "text-body font-medium text-ink";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-small text-danger">
      {message}
    </p>
  );
}

/** The style brief: a full-body photo on the left; the look, budget and sizes on the right. */
export function BriefForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = useId();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [text, setText] = useState("");
  const [budget, setBudget] = useState("");
  const [topSize, setTopSize] = useState("");
  const [bottomSize, setBottomSize] = useState("");
  // Once the shopper sets a field by hand, the sentence stops filling it in.
  const [budgetSetByHand, setBudgetSetByHand] = useState(false);
  const [sizeSetByHand, setSizeSetByHand] = useState(false);
  const [keepDraft, setKeepDraft] = useState("");
  const [keep, setKeep] = useState<string[]>([]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Photo already uploaded for an earlier brief in this tab; reused unless a new one is chosen.
  const [storedPhotoId, setStoredPhotoId] = useState<string | null>(null);

  // Coming back via "Edit brief": refill the form from the last brief.
  useEffect(() => {
    const latest = loadLatestBrief();
    if (!latest) return;
    const { input } = latest;
    setStoredPhotoId(input.photoId);
    setConsent(true);
    setText(input.text);
    // Tolerate briefs saved by an older version of this form.
    setBudget(input.budget ? String(input.budget) : "");
    setTopSize(input.sizes?.top ?? "");
    setBottomSize(input.sizes?.bottom ?? "");
    // Restored values are the shopper's own choices: editing the sentence must not overwrite them.
    setBudgetSetByHand(Boolean(input.budget));
    setSizeSetByHand(Boolean(input.sizes?.top));
    setKeep(input.keep);
    setItemId(input.itemId ?? null);
  }, []);

  // Coming from a product page: start the brief around that piece and size.
  useEffect(() => {
    const item = getCatalogItem(searchParams.get("item") ?? "");
    if (!item) return;
    const store = getStore(item.storeId);
    const size = searchParams.get("size");
    setText(`Build a look around the ${item.name} from ${store?.name ?? "the store"}.`);
    setItemId(item.itemId);
    if (size && SIZES.includes(size)) {
      if (item.category === "bottom") setBottomSize(size);
      else if (item.category !== "bag") {
        setTopSize(size);
        // Picked on the product page, so the sentence must not change it.
        setSizeSetByHand(true);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // A size or budget mentioned in the sentence fills in its field, until the shopper edits that field.
  function onTextChange(value: string) {
    setText(value);
    clearError("text");
    const details = parseBrief(value);
    if (details.budget && !budgetSetByHand) {
      setBudget(String(details.budget));
      clearError("budget");
    }
    if (details.size && !sizeSetByHand) {
      setTopSize(details.size);
      clearError("topSize");
    }
  }

  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  function onPhotoChange(file: File | undefined) {
    clearError("photo");
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, photo: "Use a JPG or PNG photo." }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((prev) => ({ ...prev, photo: "That photo is over 10 MB. Choose a smaller one." }));
      return;
    }
    setPhoto(file);
    setConsent(false);
  }

  function addKeep() {
    const value = keepDraft.trim();
    if (value && !keep.includes(value)) setKeep([...keep, value]);
    setKeepDraft("");
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!photo && !storedPhotoId) found.photo = "Add a full-body photo of yourself.";
    if (!consent) found.consent = "Agree to send your photo for try-on to continue.";
    if (!text.trim()) found.text = "Describe the look you want.";
    const amount = Number(budget);
    if (!budget || !Number.isFinite(amount) || amount <= 0) found.budget = "Enter a budget in dollars.";
    if (!topSize) found.topSize = "Choose your top or jacket size.";
    return found;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const photoId = photo ? (await uploadPhoto(photo)).photoId : storedPhotoId!;
      // Send the piece only while the sentence still names it, so a rewritten brief isn't tied to it.
      const piece = itemId ? getCatalogItem(itemId) : undefined;
      const named = piece && text.toLowerCase().includes(piece.name.toLowerCase()) ? piece.itemId : undefined;
      const input: BriefInput = {
        photoId,
        text: text.trim(),
        budget: Number(budget),
        sizes: bottomSize ? { top: topSize, bottom: bottomSize } : { top: topSize },
        keep,
        ...(named && { itemId: named }),
      };
      const response = await createBrief(input);
      saveBrief(input, response);
      router.push(`/proposals/${response.briefId}`);
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(err.fields);
        // The earlier photo expired on the server: ask for a new one instead of claiming we still have it.
        if (err.fields.photo && !photo) setStoredPhotoId(null);
        // A field this form doesn't show must still reach the shopper.
        const unshown = Object.entries(err.fields).filter(([field]) => !SHOWN_FIELDS.includes(field));
        if (unshown.length > 0) setFormError(unshown.map(([, message]) => message).join(" "));
      }
      else if (err instanceof ApiError) setFormError(err.message);
      else setFormError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  const id = (name: string) => `${uid}-${name}`;
  const describedBy = (name: string) => (errors[name] ? id(`${name}-error`) : undefined);

  const chosen = itemId ? getCatalogItem(itemId) : undefined;
  const chosenPiece = chosen && text.toLowerCase().includes(chosen.name.toLowerCase()) ? chosen : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-x-10 lg:gap-y-6">
      <div className="flex min-w-0 flex-col gap-6 rounded-card bg-surface p-4 md:p-6 lg:col-start-2 lg:row-start-1">
        <div className="flex flex-col gap-2">
          <label htmlFor={id("text")} className="font-display text-h2 font-medium text-ink">The look you want</label>
          <textarea id={id("text")} rows={3} value={text} onChange={(e) => onTextChange(e.target.value)}
            placeholder="Silver-and-black concert look in size S, under $120."
            aria-describedby={`${id("text-hint")}${errors.text ? ` ${id("text-error")}` : ""}`}
            className={`${inputClass} resize-y`} />
          <FieldError id={id("text-error")} message={errors.text} />
          <p id={id("text-hint")} className="text-small text-muted">Mention a size or budget and it fills in below.</p>
        </div>
        <fieldset aria-describedby={describedBy("topSize")} className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-body font-medium text-ink">Top or jacket size</legend>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((size) => <label key={size} className="cursor-pointer">
              <input type="radio" name={id("topSize")} value={size} checked={topSize === size}
                onChange={() => { setTopSize(size); setSizeSetByHand(true); clearError("topSize"); }} className="peer sr-only" />
              <span className="flex min-h-12 min-w-11 items-center justify-center rounded-full border border-line px-2 text-small font-medium text-ink peer-checked:border-sage peer-checked:bg-sage peer-checked:text-on-sage peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sage">{size}</span>
            </label>)}
          </div>
          <FieldError id={id("topSize-error")} message={errors.topSize} />
        </fieldset>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor={id("budget")} className={smallLabel}>Budget (USD)</label>
            <input id={id("budget")} type="number" inputMode="numeric" min={1} value={budget}
              onChange={(e) => { setBudget(e.target.value); setBudgetSetByHand(true); clearError("budget"); }}
              placeholder="120" aria-describedby={describedBy("budget")} className={inputClass} />
            <FieldError id={id("budget-error")} message={errors.budget} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={id("bottomSize")} className={smallLabel}>Bottoms size <span className="font-normal text-muted">(optional)</span></label>
            <select id={id("bottomSize")} value={bottomSize} onChange={(e) => setBottomSize(e.target.value)} className={inputClass}>
              <option value="">No bottoms</option>
              {SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:row-span-2">
        {chosenPiece && <div className="flex items-center gap-4 rounded-card bg-surface p-4">
          <div className="w-20 shrink-0"><ProductImage src={chosenPiece.imageUrl} alt={chosenPiece.name} category={chosenPiece.category} /></div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-small text-muted">Styling around</p>
            <Link href={chosenPiece.productUrl} className="text-body font-medium text-ink underline">{chosenPiece.name}</Link>
            <p className="text-price tabular-nums text-ink">{formatPrice(chosenPiece.price)}</p>
          </div>
        </div>}
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4 md:p-6">
          <h2 className="font-display text-h2 font-medium text-ink">Your try-on photo</h2>
          <label htmlFor={id("photo")} className={`relative flex w-full cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-photo border border-dashed border-line bg-stone text-center hover:border-sage has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-sage ${preview ? "aspect-[3/4]" : "min-h-40 p-4 md:min-h-48"}`}>
            {preview ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Your uploaded photo" className="absolute inset-0 size-full object-contain" />
              <span className="absolute right-3 bottom-3 rounded-full bg-surface px-4 py-2 text-small font-medium text-sage underline">Change photo</span>
            </> : <>
              <span className="text-body font-medium text-ink">{storedPhotoId ? "Using your earlier photo" : "Add a full-body photo"}</span>
              <span className="text-small text-muted">{storedPhotoId ? "Choose a new photo to replace it." : "Stand facing the camera. JPG or PNG, up to 10 MB."}</span>
              <span className="inline-flex min-h-11 items-center rounded-full border border-sage px-5 text-small font-medium text-sage">{storedPhotoId ? "Change photo" : "Choose photo"}</span>
            </>}
            <input id={id("photo")} type="file" accept="image/jpeg,image/png" className="sr-only" aria-describedby={describedBy("photo")} onChange={(e) => onPhotoChange(e.target.files?.[0])} />
          </label>
          <FieldError id={id("photo-error")} message={errors.photo} />
          <label className="flex min-h-11 items-start gap-3 text-small text-ink">
            <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); clearError("consent"); }} aria-describedby={describedBy("consent")} className="mt-0.5 size-5 shrink-0 accent-sage" />
            <span>I agree to send this photo for try-on. It&apos;s deleted within an hour.</span>
          </label>
          <FieldError id={id("consent-error")} message={errors.consent} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-2">
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4 md:p-6">
          <label htmlFor={id("keep")} className={smallLabel}>Keep something you own <span className="font-normal text-muted">(optional)</span></label>
          <div className="flex gap-2">
            <input id={id("keep")} value={keepDraft} onChange={(e) => setKeepDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeep(); } }} placeholder="Black boots" className={`${inputClass} min-w-0`} />
            <button type="button" onClick={addKeep} className="min-h-11 shrink-0 rounded-full border border-line px-5 text-small font-medium text-ink hover:bg-sage-tint">Add</button>
          </div>
          {keep.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Pieces to keep">
              {keep.map((piece) => (
                <li key={piece} className="flex items-center gap-1 rounded-full bg-sand py-1 pr-1 pl-4 text-small text-on-sand">
                  {piece}
                  <button
                    type="button"
                    onClick={() => setKeep(keep.filter((p) => p !== piece))}
                    aria-label={`Remove ${piece}`}
                    className="-my-1 flex size-11 items-center justify-center rounded-full hover:bg-surface/60"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {formError && <p role="alert" className="rounded-field border border-danger/40 bg-surface px-4 py-3 text-small text-danger">{formError}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <button type="submit" aria-busy={submitting} disabled={submitting} className="min-h-12 rounded-full bg-sage px-8 text-body font-medium text-on-sage hover:bg-sage-hover disabled:cursor-wait">{submitting ? "Getting proposals…" : "Get proposals"}</button>
          <Link href="/example" className="inline-flex min-h-11 items-center self-center text-small font-medium text-sage underline">See an example</Link>
        </div>
      </div>
    </form>
  );
}
