/** Provider/engine resolution from env keys. */
import { describe, expect, it } from "vitest";
import { loadConfig } from "../server/config";

const base = { PORT: "0" };

describe("loadConfig engine resolution", () => {
  it("scripted when no keys at all", () => {
    expect(loadConfig({ ...base }).engine).toBe("scripted");
  });

  it("claude when an anthropic key exists", () => {
    const c = loadConfig({ ...base, ANTHROPIC_API_KEY: "k" });
    expect(c.engine).toBe("claude");
    expect(c.apiKey).toBe("k");
  });

  it("openai when only an openai key exists", () => {
    expect(loadConfig({ ...base, OPENAI_API_KEY: "k" }).engine).toBe("openai");
  });

  it("deepseek when only a deepseek key exists", () => {
    expect(loadConfig({ ...base, DEEPSEEK_API_KEY: "k" }).engine).toBe("deepseek");
  });

  it("claude outranks openai outranks deepseek", () => {
    expect(
      loadConfig({ ...base, ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "b", DEEPSEEK_API_KEY: "c" }).engine,
    ).toBe("claude");
    expect(loadConfig({ ...base, OPENAI_API_KEY: "b", DEEPSEEK_API_KEY: "c" }).engine).toBe("openai");
  });

  it("explicit CHRONOLOOM_ENGINE wins over keys", () => {
    expect(
      loadConfig({ ...base, ANTHROPIC_API_KEY: "a", CHRONOLOOM_ENGINE: "scripted" }).engine,
    ).toBe("scripted");
    expect(loadConfig({ ...base, CHRONOLOOM_ENGINE: "deepseek" }).engine).toBe("deepseek");
  });

  it("whitespace-only keys count as absent", () => {
    expect(loadConfig({ ...base, ANTHROPIC_API_KEY: "  " }).engine).toBe("scripted");
  });

  it("model defaults are overridable", () => {
    const c = loadConfig({
      ...base,
      CHRONOLOOM_OPENAI_MODEL: "gpt-x",
      CHRONOLOOM_DEEPSEEK_MODEL: "ds-y",
    });
    expect(c.openaiModel).toBe("gpt-x");
    expect(c.deepseekModel).toBe("ds-y");
  });
});
