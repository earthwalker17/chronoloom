import { promises as fs } from "node:fs";
import path from "node:path";
import { SessionStateSchema } from "@shared/schemas";
import type { SessionState } from "@shared/types";
import { atomicWriteFile } from "./atomicWrite";

export class StateCorruptError extends Error {
  constructor(id: string, cause: unknown) {
    super(`session ${id} failed validation on read`);
    this.name = "StateCorruptError";
    this.cause = cause;
  }
}

/**
 * Whole-state JSON persistence with validate-on-read AND write-after-validate:
 * a session file on disk is always a schema-valid SessionState.
 */
export class SessionStore {
  /** Per-session promise chain — serializes concurrent writes to one session. */
  private locks = new Map<string, Promise<unknown>>();

  constructor(private readonly dir: string) {}

  private fileFor(id: string): string {
    // Session ids are server-generated UUIDs; reject anything path-like.
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new StateCorruptError(id, "invalid session id");
    return path.join(this.dir, `${id}.json`);
  }

  async load(id: string): Promise<SessionState | null> {
    let raw: string;
    try {
      raw = await fs.readFile(this.fileFor(id), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    try {
      return SessionStateSchema.parse(JSON.parse(raw));
    } catch (err) {
      throw new StateCorruptError(id, err);
    }
  }

  async save(state: SessionState): Promise<void> {
    const valid = SessionStateSchema.parse(state); // never write invalid bytes
    await atomicWriteFile(this.fileFor(valid.id), JSON.stringify(valid, null, 2));
  }

  /** Run `fn` exclusively for this session id (FIFO). */
  withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(id) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.locks.set(
      id,
      next.catch(() => undefined),
    );
    return next;
  }
}
