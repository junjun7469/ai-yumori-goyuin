import { describe, expect, it } from "vitest";
import { applyTheme, loadTheme, parseTheme, THEME_INIT_SCRIPT, THEME_KEY } from "./theme";

const fakeStorage = (init: Record<string, string> = {}) => {
  const m = { ...init };
  return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; }, m };
};

describe("テーマの切り替え", () => {
  it("既定は retro。washi だけが保存値として有効で、変な値は retro に戻る", () => {
    expect(parseTheme(null)).toBe("retro");
    expect(parseTheme("washi")).toBe("washi");
    expect(parseTheme("neon")).toBe("retro");
    expect(loadTheme(null)).toBe("retro");
  });
  it("data-theme が保存され、読み直すと復元される", () => {
    const st = fakeStorage();
    const root = { dataset: {} as Record<string, string | undefined> };
    applyTheme("washi", root, st);
    expect(root.dataset.theme).toBe("washi");
    expect(st.m[THEME_KEY]).toBe("washi");
    expect(loadTheme(st)).toBe("washi");
    applyTheme("retro", root, st);
    expect(loadTheme(st)).toBe("retro");
  });
  it("保存できない端末（例外）でも見た目は切り替わり、落ちない", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const root = { dataset: {} as Record<string, string | undefined> };
    expect(() => applyTheme("washi", root, broken)).not.toThrow();
    expect(root.dataset.theme).toBe("washi");
    expect(loadTheme(broken)).toBe("retro");
  });
  it("初期化スクリプトは、保存済みの washi を html に反映し、無ければ retro にする", () => {
    const run = (stored: string | null) => {
      const doc = { documentElement: { dataset: {} as Record<string, string | undefined> } };
      new Function("localStorage", "document", THEME_INIT_SCRIPT)({ getItem: () => stored }, doc);
      return doc.documentElement.dataset.theme;
    };
    expect(run("washi")).toBe("washi");
    expect(run(null)).toBe("retro");
    expect(run("x")).toBe("retro");
  });
});
