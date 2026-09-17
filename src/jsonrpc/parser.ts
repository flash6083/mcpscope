import { Transform } from "node:stream";

export type FrameCallback = (frame: unknown) => void;

export function createFrameParser(onFrame: FrameCallback): Transform {
  let buffer = Buffer.alloc(0);

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      buffer = Buffer.concat([buffer, chunk]);
      const text = buffer.toString("utf8");
      const lines = text.split("\n");
      buffer = Buffer.from(lines.pop() ?? "");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          onFrame(parsed);
        } catch {
          // malformed frame: skip silently
        }
      }

      this.push(chunk);
      callback();
    },
  });
}
