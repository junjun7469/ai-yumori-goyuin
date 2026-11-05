// 湯の子の保存：QR着地（claimVisit）と一緒に育つ。一時的な SQLite を使う。API は呼ばない
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const KEY = "yunoko-user-key-0123456789";
let m: { db: typeof import("@/db"); visit: typeof import("./visitDb"); y: typeof import("./yunokoDb") };

const day = (d: number, h = 3) => new Date(Date.UTC(2026, 10, d, h)); // 11月d日（日本時間では同じ日の昼ごろ）

beforeAll(async () => {
  process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "yumori-yunoko-")), "t.db");
  const dbm = await import("@/db");
  (await import("@/db/migrate")).runMigrations();
  for (const [code, name, cls, type] of [["43", "杖立温泉", "chloride", "ナトリウム塩化物温泉"], ["06", "蔵王温泉", "sulfur", "酸性・含硫黄泉"], ["44", "別府温泉", "simple", "単純温泉"]] as const) {
    dbm.db.insert(dbm.schema.onsenArea).values({ code, prefecture: "テスト県", name, reading: "てすと", springType: type, springTypeClass: cls, whyFamous: "テスト", sourceStatus: "unverified" }).run();
  }
  m = { db: dbm, visit: await import("./visitDb"), y: await import("./yunokoDb") };
});

describe("湯の子の育成（QR着地と連動）", () => {
  it("最初の入浴で通い始め（1回）、同じ日に同じ温泉地をもう一度押しても増えない", () => {
    const a = m.visit.claimVisit(KEY, "43", day(1))!;
    expect(a.yunoko).toMatchObject({ grew: true, evolved: false, stage: 1, visits: 1, boundCode: "43", tone: "orange" });
    const again = m.visit.claimVisit(KEY, "43", day(1, 9))!;
    expect(again.already).toBe(true);
    expect(again.yunoko).toMatchObject({ grew: false, visits: 1 });
  });

  it("別の温泉地に入っても回数は増えない（その御湯印は普通にもらえる）", () => {
    const b = m.visit.claimVisit(KEY, "44", day(2))!;
    expect(b.already).toBe(false); // 御湯印はもらえる
    expect(b.yunoko).toMatchObject({ grew: false, visits: 1, boundCode: "43" });
  });

  it("別の日に通うと 2 回→3 回。3回目でなりかわり、新しい湯の子（たまご）がすぐ生まれる", () => {
    const second = m.visit.claimVisit(KEY, "43", day(3))!;
    expect(second.yunoko).toMatchObject({ grew: true, evolved: false, stage: 2, visits: 2 });
    const third = m.visit.claimVisit(KEY, "43", day(4))!;
    expect(third.yunoko).toMatchObject({ grew: true, evolved: true, stage: 3, visits: 3 });

    const v = m.y.getYunokoView(KEY, day(4));
    expect(v.history).toHaveLength(1);
    expect(v.history[0]).toMatchObject({ code: "43", name: "杖立温泉" });
    expect(v.active).toMatchObject({ boundCode: null, visits: 0, stage: 0 }); // 新しいたまご
    expect(m.y.evolutionsOf(KEY)).toEqual({ count: 1, codes: ["43"] });
  });

  it("新しい湯の子は、次に入った温泉地に通い始める（なりかわり済みの記録は残る）", () => {
    const r = m.visit.claimVisit(KEY, "06", day(5))!;
    expect(r.yunoko).toMatchObject({ grew: true, stage: 1, boundCode: "06", tone: "lavender" });
    const rows = m.db.db.select().from(m.db.schema.yunoko).all().filter((x) => x.userKey === KEY);
    expect(rows).toHaveLength(2);
    expect(rows.filter((x) => x.evolvedAt).length).toBe(1);
  });

  it("端末ごとに別の湯の子（他の端末の記録は混ざらない）", () => {
    expect(m.y.getYunokoView("other-key-0123456789abcd", day(6)).history).toHaveLength(0);
    expect(m.y.evolutionsOf("other-key-0123456789abcd").count).toBe(0);
  });
});
