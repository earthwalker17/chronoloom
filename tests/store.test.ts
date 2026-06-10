import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newSession } from "../server/sim/newSession";
import { SessionStore, StateCorruptError } from "../server/store/sessionStore";

let dir: string;
let store: SessionStore;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "chronoloom-store-"));
  store = new SessionStore(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("SessionStore", () => {
  it("round-trips a session losslessly", async () => {
    const state = newSession("copyist", "scripted");
    await store.save(state);
    const loaded = await store.load(state.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.player.nameZh).toBe(state.player.nameZh);
    expect(loaded?.eventQueue).toHaveLength(state.eventQueue.length);
  });

  it("returns null for unknown sessions", async () => {
    expect(await store.load("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("rejects corrupt files with StateCorruptError", async () => {
    const state = newSession("scholar", "scripted");
    await store.save(state);
    writeFileSync(path.join(dir, `${state.id}.json`), "{\"not\": \"a session\"}", "utf8");
    await expect(store.load(state.id)).rejects.toThrow(StateCorruptError);
  });

  it("refuses to write invalid state (write-after-validate)", async () => {
    const state = newSession("scholar", "scripted");
    // @ts-expect-error deliberately corrupt
    state.player.money = "rich";
    await expect(store.save(state)).rejects.toThrow();
  });

  it("leaves no temp files behind after save", async () => {
    const state = newSession("interpreter", "scripted");
    await store.save(state);
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toHaveLength(0);
  });

  it("rejects path-like session ids", async () => {
    await expect(store.load("../../evil")).rejects.toThrow();
  });

  it("serializes writes per session id", async () => {
    const state = newSession("apprentice", "scripted");
    const order: number[] = [];
    await Promise.all([
      store.withLock(state.id, async () => {
        await new Promise((r) => setTimeout(r, 30));
        order.push(1);
      }),
      store.withLock(state.id, async () => {
        order.push(2);
      }),
    ]);
    expect(order).toEqual([1, 2]);
  });
});
