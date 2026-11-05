import { describe, expect, it } from "vitest";
import { bandLabel, tabOf } from "./tabs";

describe("画面ごとのタブ色", () => {
  it("URL から、図鑑・QR・今日の湯・わたしのどの色かを決める", () => {
    expect(tabOf("/goyuin")).toBe("zukan");
    expect(tabOf("/goyuin/43")).toBe("zukan");
    expect(tabOf("/goyuin/gacha")).toBe("zukan");
    expect(tabOf("/goyuin/qr")).toBe("qr");
    expect(tabOf("/visit/43")).toBe("qr");
    expect(tabOf("/goyuin/yunoko")).toBe("yunoko");
    expect(tabOf("/goyuin/today")).toBe("today");
    expect(tabOf("/goyuin/me")).toBe("me");
  });
  it("見出し帯の言葉", () => {
    expect(bandLabel("/goyuin")).toBe("図鑑");
    expect(bandLabel("/goyuin/43")).toBe("図鑑　くわしく");
    expect(bandLabel("/goyuin/today")).toBe("今日の湯");
    expect(bandLabel("/goyuin/yunoko")).toBe("湯の子");
    expect(bandLabel("/visit/43")).toBe("QR　到着");
  });
});
