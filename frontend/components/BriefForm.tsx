"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, ValidationError, createBrief, uploadPhoto } from "@/lib/api";
import { saveBrief } from "@/lib/briefStore";
import type { FieldErrors } from "@/lib/types";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png"];

const inputClass =
  "w-full rounded-field border border-line bg-surface px-3 py-2.5 text-body text-ink placeholder:text-muted";
const labelClass = "text-small font-medium text-ink";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-small text-danger">
      {message}
    </p>
  );
}

export function BriefForm() {
  const router = useRouter();
  const uid = useId();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [text, setText] = useState("");
  const [budget, setBudget] = useState("");
  const [occasion, setOccasion] = useState("");
  const [topSize, setTopSize] = useState("");
  const [bottomSize, setBottomSize] = useState("");
  const [keepDraft, setKeepDraft] = useState("");
  const [keep, setKeep] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

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
  }

  function addKeep() {
    const value = keepDraft.trim();
    if (value && !keep.includes(value)) setKeep([...keep, value]);
    setKeepDraft("");
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!photo) found.photo = "Add a full-body photo of yourself.";
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
    if (Object.keys(found).length > 0 || !photo) return;

    setSubmitting(true);
    try {
      const { photoId } = await uploadPhoto(photo);
      const response = await createBrief({
        photoId,
        text: text.trim(),
        budget: Number(budget),
        occasion: occasion.trim(),
        sizes: bottomSize ? { top: topSize, bottom: bottomSize } : { top: topSize },
        keep,
      });
      saveBrief(response);
      router.push(`/proposals/${response.briefId}`);
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.fields);
      else if (err instanceof ApiError) setFormError(err.message);
      else setFormError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  const id = (name: string) => `${uid}-${name}`;
  const describedBy = (name: string) => (errors[name] ? id(`${name}-error`) : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className={labelClass}>Your photo</span>
        <label
          htmlFor={id("photo")}
          className="flex min-h-64 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-card border border-dashed border-line bg-surface text-center"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your uploaded photo" className="max-h-96 w-full object-contain" />
          ) : (
            <span className="flex flex-col gap-1 px-6 py-10">
              <span className="text-body font-medium text-ink">Add a full-body photo</span>
              <span className="text-small text-muted">JPG or PNG, up to 10 MB. Stand facing the camera.</span>
            </span>
          )}
        </label>
        <input
          id={id("photo")}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          aria-describedby={describedBy("photo")}
          onChange={(e) => onPhotoChange(e.target.files?.[0])}
        />
        {preview && (
          <label htmlFor={id("photo")} className="cursor-pointer self-start text-small font-medium text-sage underline">
            Change photo
          </label>
        )}
        <FieldError id={id("photo-error")} message={errors.photo} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex min-h-11 items-start gap-3 text-body text-ink">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              clearError("consent");
            }}
            aria-describedby={describedBy("consent")}
            className="mt-1 size-5 accent-sage"
          />
          <span>
            I agree to send this photo to YouCam to create try-on previews. It is deleted within an hour.
          </span>
        </label>
        <FieldError id={id("consent-error")} message={errors.consent} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={id("text")} className={labelClass}>
          The look you want
        </label>
        <textarea
          id={id("text")}
          rows={3}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            clearError("text");
          }}
          placeholder="Silver-and-black concert look, under $120. Keep my boots."
          aria-describedby={describedBy("text")}
          className={inputClass}
        />
        <FieldError id={id("text-error")} message={errors.text} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={id("budget")} className={labelClass}>
            Budget (USD)
          </label>
          <input
            id={id("budget")}
            type="number"
            inputMode="numeric"
            min={1}
            value={budget}
            onChange={(e) => {
              setBudget(e.target.value);
              clearError("budget");
            }}
            placeholder="120"
            aria-describedby={describedBy("budget")}
            className={inputClass}
          />
          <FieldError id={id("budget-error")} message={errors.budget} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={id("occasion")} className={labelClass}>
            Occasion <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id={id("occasion")}
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="Concert"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={id("topSize")} className={labelClass}>
            Top or jacket size
          </label>
          <select
            id={id("topSize")}
            value={topSize}
            onChange={(e) => {
              setTopSize(e.target.value);
              clearError("topSize");
            }}
            aria-describedby={describedBy("topSize")}
            className={inputClass}
          >
            <option value="">Choose a size</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <FieldError id={id("topSize-error")} message={errors.topSize} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={id("bottomSize")} className={labelClass}>
            Bottoms size <span className="font-normal text-muted">(optional)</span>
          </label>
          <select
            id={id("bottomSize")}
            value={bottomSize}
            onChange={(e) => setBottomSize(e.target.value)}
            className={inputClass}
          >
            <option value="">No bottoms</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={id("keep")} className={labelClass}>
          Pieces you already own and want to keep <span className="font-normal text-muted">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            id={id("keep")}
            value={keepDraft}
            onChange={(e) => setKeepDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeep();
              }
            }}
            placeholder="Black boots"
            className={inputClass}
          />
          <button
            type="button"
            onClick={addKeep}
            className="min-h-11 shrink-0 rounded-full border border-line px-5 text-small font-medium text-ink hover:bg-sage-tint"
          >
            Add
          </button>
        </div>
        {keep.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Pieces to keep">
            {keep.map((piece) => (
              <li key={piece} className="flex items-center gap-1 rounded-full bg-sand py-1 pr-1 pl-3 text-small text-on-sand">
                {piece}
                <button
                  type="button"
                  onClick={() => setKeep(keep.filter((p) => p !== piece))}
                  aria-label={`Remove ${piece}`}
                  className="flex size-7 items-center justify-center rounded-full hover:bg-surface/60"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-field border border-danger/40 bg-surface px-4 py-3 text-small text-danger">
          {formError}
        </p>
      )}

      <button
        type="submit"
        aria-busy={submitting}
        className="min-h-12 w-full rounded-full bg-sage px-6 text-body font-medium text-on-sage hover:bg-sage-hover"
      >
        {submitting ? "Getting proposals…" : "Get proposals"}
      </button>
    </form>
  );
}
