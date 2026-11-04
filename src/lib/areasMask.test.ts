// 未所持の温泉地は、APIのレスポンスに名前・画像パス・泉質などを含めない（画面で隠すだけではない）。
// 一時的な SQLite を使い、API のハンドラを直接呼ぶ。外部 API は呼ばない。
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const MINE = "mask-test-mine-0123456789";
const OTHER = "mask-test-other-0123456789";
const SECRETS = ["ひみつ登別", "ひみつ酸ヶ湯", "/characters/01_secret.png", "/characters/02_secret.png", "ひみつの泉質", "ひみつの特徴", "のぼりべつ"];

let areasGET: (req: Request) => Response | Promise<Response>;
let detailGET: (req: Request, ctx: { params: Promise<{ code: string }> }) => Response | Promise<Response>;
let goyuinGET: (req: Request) => Response | Promise<Response>;

beforeAll(async () => {
  process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "yumori-mask-")), "t.db");
  const { db, schema } = await import("@/db");
  (await import("@/db/migrate")).runMigrations();
  const base = { reading: "のぼりべつ", springType: "ひみつの泉質", springTypeClass: "simple" as const, whyFamous: "ひみつの特徴", sourceStatus: "unverified" as const };
  const a1 = db.insert(schema.onsenArea).values({ ...base, code: "01", prefecture: "北海道", name: "ひみつ登別", characterImage: "/characters/01_secret.png" }).returning().get();
  db.insert(schema.onsenArea).values({ ...base, code: "02", prefecture: "青森県", name: "ひみつ酸ヶ湯", characterImage: "/characters/02_secret.png" }).run();
  db.insert(schema.onsenArea).values({ ...base, code: "03", prefecture: "岩手県", name: "所持している湯", reading: "しょじ", springType: "見える泉質", whyFamous: "見える特徴", characterImage: null }).run();
  const a3 = db.select().from(schema.onsenArea).all().find((a) => a.code === "03")!;
  void a1;
  db.insert(schema.goyuin).values({ userKey: MINE, onsenAreaId: a3.id, obtainedVia: "visit", obtainedAt: new Date(), variant: "yuuyu" }).run();

  areasGET = (await import("@/app/api/areas/route")).GET;
  detailGET = (await import("@/app/api/areas/[code]/route")).GET;
  goyuinGET = (await import("@/app/api/goyuin/route")).GET;
});

const url = (p: string, key?: string) => `http://localhost${p}${key ? `?user_key=${key}` : ""}`;
const expectNoSecrets = (text: string) => { for (const s of SECRETS) expect(text, s).not.toContain(s); };

describe("未所持は秘密（APIのレスポンスに含めない）", () => {
  it("/api/areas：未所持は code と都道府県名だけ。所持している温泉地は中身が見える", async () => {
    const text = await (await areasGET(new Request(url("/api/areas", MINE)))).text();
    expectNoSecrets(text);
    const { areas } = JSON.parse(text) as { areas: Record<string, unknown>[] };
    expect(areas.find((a) => a.code === "01")).toEqual({ owned: false, code: "01", prefecture: "北海道" });
    expect(areas.find((a) => a.code === "02")).toEqual({ owned: false, code: "02", prefecture: "青森県" });
    expect(areas.find((a) => a.code === "03")).toMatchObject({ owned: true, name: "所持している湯", variants: ["yuuyu"] });
  });

  it("/api/areas：キーが無い・他人のキー・不正なキーでも、全部未所持として返す", async () => {
    for (const u of [url("/api/areas"), url("/api/areas", OTHER), url("/api/areas", "bad")]) {
      const text = await (await areasGET(new Request(u))).text();
      expectNoSecrets(text);
      expect(text).not.toContain("所持している湯");
      expect((JSON.parse(text).areas as { owned: boolean }[]).every((a) => a.owned === false)).toBe(true);
    }
  });

  it("/api/areas/[code]：未所持は code と都道府県名だけ。所持していれば中身が見える。存在しない code は 404", async () => {
    const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
    const un = await detailGET(new Request(url("/api/areas/01", MINE)), ctx("01"));
    const unText = await un.text();
    expectNoSecrets(unText);
    expect(JSON.parse(unText)).toEqual({ owned: false, code: "01", prefecture: "北海道" });

    const noKey = await (await detailGET(new Request(url("/api/areas/03")), ctx("03"))).text();
    expect(noKey).not.toContain("所持している湯");

    const mine = await (await detailGET(new Request(url("/api/areas/03", MINE)), ctx("03"))).json();
    expect(mine).toMatchObject({ owned: true, area: { name: "所持している湯" } });

    expect((await detailGET(new Request(url("/api/areas/99", MINE)), ctx("99"))).status).toBe(404);
  });

  it("/api/goyuin：自分の取得の記録だけ（温泉地名・画像は含めない）", async () => {
    const text = await (await goyuinGET(new Request(url("/api/goyuin", MINE)))).text();
    expectNoSecrets(text);
    expect(JSON.parse(text).items).toEqual([expect.objectContaining({ code: "03", variant: "yuuyu" })]);
  });
});
