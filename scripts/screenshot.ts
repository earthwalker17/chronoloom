/**
 * CDP-driven headless-Edge screenshot tool (more reliable than
 * --virtual-time-budget, which stalls on continuous-RAF pages, and it can
 * click into the scene first).
 *
 * Usage:
 *   npx tsx scripts/screenshot.ts --url <url> --out <absolute.png>
 *     [--wait 9000] [--width 1600] [--height 900]
 *     [--click x,y --wait-after-click 2500]...
 *
 * Clicks dispatch real mouse events (pointerdown/up), so scene picking and
 * popovers behave exactly as for a user.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const PORT = 9333;

interface Click {
  x?: number;
  y?: number;
  /** Click N px below the nameplate whose text matches (figure body). */
  npc?: { name: string; below: number };
  /** Click the first <button> containing this text. */
  text?: string;
  waitAfter: number;
}

interface Args {
  url: string;
  out: string;
  wait: number;
  width: number;
  height: number;
  clicks: Click[];
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { url: "", out: "", wait: 9000, width: 1600, height: 900, clicks: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i] ?? "";
    if (a === "--url") args.url = next();
    else if (a === "--out") args.out = next();
    else if (a === "--wait") args.wait = Number(next());
    else if (a === "--width") args.width = Number(next());
    else if (a === "--height") args.height = Number(next());
    else if (a === "--click") {
      const [x, y] = next().split(",").map(Number);
      args.clicks.push({ x: x ?? 0, y: y ?? 0, waitAfter: 2500 });
    } else if (a === "--click-npc") {
      // e.g. --click-npc 裴衡,40 → 40px below that nameplate's center
      const [name, below] = next().split(",");
      args.clicks.push({ npc: { name: name ?? "", below: Number(below ?? 40) }, waitAfter: 2500 });
    } else if (a === "--click-text") {
      // click the center of the first button containing this text
      args.clicks.push({ text: next(), waitAfter: 2500 });
    } else if (a === "--wait-after-click") {
      const last = args.clicks[args.clicks.length - 1];
      if (last) last.waitAfter = Number(next());
    }
  }
  if (!args.url || !args.out) {
    console.error("usage: screenshot.ts --url <url> --out <abs.png> [--wait ms] [--click x,y]...");
    process.exit(1);
  }
  return args;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  private nextId = 1;
  private pending = new Map<number, (v: unknown) => void>();
  constructor(private readonly ws: WebSocket) {
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown };
      if (msg.id !== undefined) this.pending.get(msg.id)?.(msg.result);
    });
  }
  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve) => {
      this.pending.set(id, (v) => resolve(v as T));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const edge = EDGE_PATHS.find((p) => existsSync(p));
  if (!edge) throw new Error("Edge not found");

  const profile = mkdtempSync(path.join(tmpdir(), "edge-cdp-"));
  let child: ChildProcess | null = null;
  try {
    child = spawn(
      edge,
      [
        "--headless=new",
        "--disable-gpu",
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${profile}`,
        `--window-size=${args.width},${args.height}`,
        "--no-first-run",
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    // Wait for the devtools endpoint + a page target.
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(300);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const list = (await res.json()) as { type: string; webSocketDebuggerUrl: string }[];
        target = list.find((t) => t.type === "page");
      } catch {
        /* not up yet */
      }
    }
    if (!target) throw new Error("no CDP page target");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    const cdp = new Cdp(ws);

    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: args.width,
      height: args.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Page.navigate", { url: args.url });
    await sleep(args.wait);

    for (const click of args.clicks) {
      let { x, y } = click;
      if (click.text) {
        const expr = `(() => {
          const el = [...document.querySelectorAll("button")].find(b => b.textContent.includes(${JSON.stringify(click.text)}));
          if (!el) return "";
          const r = el.getBoundingClientRect();
          return (r.left + r.width / 2) + "," + (r.top + r.height / 2);
        })()`;
        const res = await cdp.send<{ result: { value?: string } }>("Runtime.evaluate", {
          expression: expr,
          returnByValue: true,
        });
        const v = res.result.value ?? "";
        if (!v) {
          console.warn(`button "${click.text}" not found — click skipped`);
          continue;
        }
        const [px, py] = v.split(",").map(Number);
        x = px;
        y = py;
        console.log(`clicking button "${click.text}" at ${x?.toFixed(0)},${y?.toFixed(0)}`);
      }
      if (click.npc) {
        // Resolve via the live nameplate DOM — exact even while figures drift.
        const expr = `(() => {
          const el = [...document.querySelectorAll(".nameplate")].find(n => n.textContent.includes(${JSON.stringify(click.npc.name)}));
          if (!el) return "";
          const r = el.getBoundingClientRect();
          return (r.left + r.width / 2) + "," + (r.bottom + ${click.npc.below});
        })()`;
        const res = await cdp.send<{ result: { value?: string } }>("Runtime.evaluate", {
          expression: expr,
          returnByValue: true,
        });
        const v = res.result.value ?? "";
        if (!v) {
          console.warn(`nameplate "${click.npc.name}" not found — click skipped`);
          continue;
        }
        const [px, py] = v.split(",").map(Number);
        x = px;
        y = py;
        console.log(`clicking ${click.npc.name} at ${x?.toFixed(0)},${y?.toFixed(0)}`);
      }
      for (const type of ["mousePressed", "mouseReleased"] as const) {
        await cdp.send("Input.dispatchMouseEvent", {
          type,
          x: x ?? 0,
          y: y ?? 0,
          button: "left",
          clickCount: 1,
          pointerType: "mouse",
        });
      }
      await sleep(click.waitAfter);
    }

    const shot = await cdp.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
    writeFileSync(args.out, Buffer.from(shot.data, "base64"));
    console.log(`written ${args.out}`);
    ws.close();
  } finally {
    child?.kill();
    await sleep(400);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* profile dir may lag behind the process exit on Windows */
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
