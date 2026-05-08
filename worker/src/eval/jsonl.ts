import { appendFile } from "node:fs/promises";
import type { RunRecord } from "@afia/shared";

export async function writeRunRecord(path: string, rec: RunRecord): Promise<void> {
  await appendFile(path, JSON.stringify(rec) + "\n", "utf8");
}
