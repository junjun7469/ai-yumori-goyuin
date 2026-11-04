// G5：variant の保存と、同日・同温泉地の再取得（一時的な SQLite を使う。API は呼ばない）
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const KEY = "test-user-key-0123456789";

type Mods = { db: typeof import("@/db"); visit: typeof import("./visitDb") };
let m: Mods;

beforeAll(async () => {
  process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "yumori-visit-")), "t.db");
  const dbm = await import("@/db");
  (await import("@/db/migrate")).runMigrations();
  const a = dbm.db.insert(dbm.schema.onsenArea).values({
    code: "43", prefecture: "熊本県", name: "杖立温泉", reading: "つえたて", springType: "単純温泉", springTypeClass: "simple", whyFamous: "テスト", sourceStatus: "unverified",
  }).returning().get();
  dbm.db.insert(dbm.schema.onsenArea).values({
    code: "44", prefecture: "大分県", name: "テスト温泉", reading: "てすと", springType: "単純温泉", springTypeClass: "simple", whyFamous: "テスト", sourceStatus: "unverified",
  }).run();
  dbm.db.insert(dbm.schema.facility).values({ onsenAreaId: a.id, name: "丸正旅館", hasAiYumori: true }).run();
  m = { db: dbm, visit: await import("./visitDb") };
});

describe("G5 QR着地", () => {
  it("柄（variant）が goyuin に保存され、取得方法は visit になる。乱数で4種を選べる", () => {
    const r = m.visit.claimVisit(KEY, "43", new Date("2026-11-04T01:00:00Z"), () => 0.8)!;
    expect(r.already).toBe(false);
    expect(r.variant).toBe("yukimi"); // 0.8 → 4種の4番目
    expect(r.facility).toBe("丸正旅館");
    const rows = m.db.db.select().from(m.db.schema.goyuin).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userKey: KEY, obtainedVia: "visit", variant: "yukimi" });
  });

  it("同じ日に同じ温泉地をもう一度押すと、その日の結果をそのまま返し、記録は増えない。別の温泉地・翌日は新しく取れる", () => {
    const again = m.visit.claimVisit(KEY, "43", new Date("2026-11-04T12:00:00Z"), () => 0)!; // 別の乱数でも柄は変わらない
    expect(again.already).toBe(true);
    expect(again.variant).toBe("yukimi");
    expect(m.db.db.select().from(m.db.schema.goyuin).all()).toHaveLength(1);

    expect(m.visit.claimVisit(KEY, "44", new Date("2026-11-04T12:00:00Z"), () => 0)!.already).toBe(false); // 温泉地ごとの判定
    // 日本時間 11/5 0:00 を過ぎたら、同じ温泉地でも新しく取れる
    expect(m.visit.claimVisit(KEY, "43", new Date("2026-11-04T15:00:00Z"), () => 0)!.already).toBe(false);
  });

  it("存在しない温泉地は null", () => {
    expect(m.visit.claimVisit(KEY, "99")).toBeNull();
  });
});
