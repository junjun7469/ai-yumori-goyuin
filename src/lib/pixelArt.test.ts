import { describe, expect, it } from "vitest";
import { PIXEL_GRID, PIXEL_ICONS } from "./pixelArt";

describe("ドット絵アイコン", () => {
  it("どの絵も16マス幅で、16行以内、塗り（#）と空き（.）だけでできている", () => {
    for (const [name, rows] of Object.entries(PIXEL_ICONS)) {
      expect(rows.length, name).toBeLessThanOrEqual(PIXEL_GRID);
      for (const r of rows) { expect(r.length, `${name}: ${r}`).toBe(PIXEL_GRID); expect(r, name).toMatch(/^[.#]+$/); }
      expect(rows.join("").includes("#"), name).toBe(true);
    }
  });
});
