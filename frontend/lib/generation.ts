// Backend windows are 180/900 seconds. Allow a final-read grace period in the browser.
export const PREVIEW_TIMEOUT_MS = 195_000;
export const VIDEO_TIMEOUT_MS = 915_000;

export function generationProgress(phase?: string): string {
  switch (phase) {
    case "preparing":
    case "downloading": return "Preparing your image…";
    case "uploading": return "Sending your image for generation…";
    case "submitting": return "Starting generation…";
    default: return "Waiting for your result…";
  }
}

export function elapsedLabel(seconds = 0): string {
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s elapsed`;
}
