export type CaptureLevel = "none" | "truncated" | "full";

export const captureLevel: CaptureLevel =
  (process.env.MCPSCOPE_CAPTURE_PAYLOADS as CaptureLevel) ?? "none";

export function maybeCapture(payload: unknown): string | undefined {
  if (captureLevel === "none") return undefined;
  const s = JSON.stringify(payload);
  if (captureLevel === "truncated") return s.slice(0, 1024);
  return s;
}
