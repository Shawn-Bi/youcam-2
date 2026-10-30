import { BriefForm } from "@/components/BriefForm";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10 md:py-14">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-h1 font-semibold text-ink md:text-display">Post a look brief</h1>
        <p className="text-body text-muted">
          Describe the look you want. Two stores answer with outfits you can try on your own photo.
        </p>
      </div>
      <BriefForm />
    </main>
  );
}
