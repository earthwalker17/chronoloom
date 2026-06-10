import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Atomic file write: serialize → temp file → rename. Node's fs.rename maps to
 * MoveFileExW(MOVEFILE_REPLACE_EXISTING) on Windows, so the swap is atomic and
 * a crash mid-write can never leave a half-written session on disk.
 */
export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, filePath);
}
