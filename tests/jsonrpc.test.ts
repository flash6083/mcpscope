import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import { createFrameParser } from "../src/jsonrpc/parser.js";

describe("jsonrpc parser", () => {
  it("parses complete frames", async () => {
    const frames: any[] = [];
    const parser = createFrameParser((f) => frames.push(f));

    const stream = Readable.from([
      Buffer.from('{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"test"}}\n'),
    ]);

    await new Promise((resolve) => {
      stream.pipe(parser);
      stream.on("end", resolve);
    });

    expect(frames).toHaveLength(1);
    expect(frames[0].method).toBe("tools/call");
  });

  it("handles partial chunks", async () => {
    const frames: any[] = [];
    const parser = createFrameParser((f) => frames.push(f));

    const stream = Readable.from([
      Buffer.from('{"jsonrpc":"2.0",'),
      Buffer.from('"id":1,"method":"test"}\n'),
    ]);

    await new Promise((resolve) => {
      stream.pipe(parser);
      stream.on("end", resolve);
    });

    expect(frames).toHaveLength(1);
    expect(frames[0].id).toBe(1);
  });

  it("skips malformed frames", async () => {
    const frames: any[] = [];
    const parser = createFrameParser((f) => frames.push(f));

    const stream = Readable.from([
      Buffer.from('not json\n'),
      Buffer.from('{"jsonrpc":"2.0","id":1,"method":"test"}\n'),
    ]);

    await new Promise((resolve) => {
      stream.pipe(parser);
      stream.on("end", resolve);
    });

    expect(frames).toHaveLength(1);
    expect(frames[0].id).toBe(1);
  });
});
