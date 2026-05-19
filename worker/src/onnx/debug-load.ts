import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ort from "onnxruntime-web";

async function main() {
  const p = resolve("src/onnx/models/constant.onnx");
  const b = readFileSync(p);
  console.log("Buffer size:", b.length);
  console.log("Buffer byteLength:", b.byteLength);
  console.log("ArrayBuffer byteLength:", b.buffer.byteLength);

  try {
    // Buffer is a Uint8Array — pass directly, not b.buffer
    const s = await ort.InferenceSession.create(b);
    console.log("Session created!");
    const r = await s.run({});
    console.log("Output keys:", Object.keys(r));
    console.log("Output values:", Object.values(r).map(v => Array.from(v.data as Float32Array)));
  } catch (e) {
    console.error("Error:", (e as Error).message);
  }
}

main();
