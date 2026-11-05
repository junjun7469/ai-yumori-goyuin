// 思い出の写真（上限2枚・縮小・EXIF除去・鍵の照合）と、demo-seed。一時的な SQLite とフォルダを使う。API は呼ばない
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

const KEY = "test-user-key-0123456789";
const OTHER = "other-user-key-0123456789";

let dbm: typeof import("@/db");
let photos: typeof import("./photos");
let demo: typeof import("./demoSeed");
let tmp: string;

/** 位置情報つきの EXIF を持つ、大きな JPEG */
const bigJpeg = (w = 3200, h = 2400) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#b5543a" } })
    .withExif({ IFD0: { Copyright: "テスト" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "35/1 0/1 0/1" } })
    .jpeg().toBuffer();

const AREAS: [string, string][] = [["01", "登別"], ["02", "酸ヶ湯"], ["03", "花巻"], ["04", "鳴子"], ["06", "蔵王"], ["43", "杖立"], ["44", "別府"]];

beforeAll(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "yumori-photos-"));
  process.env.DB_PATH = path.join(tmp, "t.db");
  process.env.PHOTO_DIR = path.join(tmp, "photos");
  process.env.MEMORIES_DIR = path.join(tmp, "memories");
  dbm = await import("@/db");
  (await import("@/db/migrate")).runMigrations();
  for (const [code, name] of AREAS) {
    dbm.db.insert(dbm.schema.onsenArea).values({
      code, prefecture: "テスト県", name: `${name}温泉`, reading: "てすと", springType: "単純温泉", springTypeClass: "simple", whyFamous: "テスト", sourceStatus: "unverified",
    }).run();
  }
  photos = await import("./photos");
  demo = await import("./demoSeed");
});

const areaId = (code: string) => dbm.db.select().from(dbm.schema.onsenArea).all().find((a) => a.code === code)!.id;
const addRow = (key: string, code: string) =>
  dbm.db.insert(dbm.schema.goyuin).values({ userKey: key, onsenAreaId: areaId(code), obtainedVia: "visit", obtainedAt: new Date() }).returning().get();
const count = (id: number) => dbm.db.select().from(dbm.schema.goyuin).all().find((r) => r.id === id)!.photoCount;

describe("思い出の写真", () => {
  it("アップロードすると長辺1600pxに縮み、EXIF（位置情報など）が取り除かれる", async () => {
    const row = addRow(KEY, "44");
    const src = await bigJpeg();
    expect((await sharp(src).metadata()).exif).toBeDefined(); // 入力にはある
    await photos.addPhoto(KEY, row.id, src);
    const saved = await photos.readPhoto(KEY, row.id, "1");
    const meta = await sharp(saved!).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
    expect(meta.exif).toBeUndefined();
    expect(existsSync(path.join(process.env.PHOTO_DIR!, `${row.id}_1.jpg`))).toBe(true);
    expect(count(row.id)).toBe(1);
  });

  it("1御湯印につき最大2枚。3枚目は断られ、1枚消すとまた足せる（詰め直す）", async () => {
    const row = addRow(KEY, "01");
    await photos.addPhoto(KEY, row.id, await bigJpeg(800, 600));
    await photos.addPhoto(KEY, row.id, await bigJpeg(800, 600));
    expect(count(row.id)).toBe(2);
    await expect(photos.addPhoto(KEY, row.id, await bigJpeg(800, 600))).rejects.toMatchObject({ code: "limit" });
    expect(readdirSync(process.env.PHOTO_DIR!).filter((f) => f.startsWith(`${row.id}_`))).toHaveLength(2);

    const after = photos.removePhoto(KEY, row.id, 1);
    expect(after.photos.map((p) => p.slot)).toEqual(["1"]); // 2枚目が1番に詰まる
    expect(after.canAdd).toBe(true);
    expect(count(row.id)).toBe(1);
    await photos.addPhoto(KEY, row.id, await bigJpeg(800, 600));
    expect(count(row.id)).toBe(2);
  });

  it("画像でないファイルは断る。他の端末のキーでは読めず、足せず、消せない", async () => {
    const row = addRow(KEY, "02");
    await expect(photos.addPhoto(KEY, row.id, Buffer.from("not an image"))).rejects.toMatchObject({ code: "bad_image" });
    await photos.addPhoto(KEY, row.id, await bigJpeg(800, 600));
    expect(await photos.readPhoto(OTHER, row.id, "1")).toBeNull();
    await expect(photos.addPhoto(OTHER, row.id, await bigJpeg(800, 600))).rejects.toMatchObject({ code: "not_found" });
    expect(() => photos.removePhoto(OTHER, row.id, 1)).toThrow();
  });

  it("写真が付くのは最初に取った行。同じ温泉地を別の日に取っても写真は動かない", async () => {
    const first = addRow(KEY, "03");
    const second = addRow(KEY, "03");
    await expect(photos.addPhoto(KEY, second.id, await bigJpeg(800, 600))).rejects.toMatchObject({ code: "not_found" });
    await photos.addPhoto(KEY, first.id, await bigJpeg(800, 600));
    expect(photos.photoSummary(KEY, "03")!.goyuinId).toBe(first.id);
    expect(photos.codesWithPhotos(KEY)).toContain("03");
  });

  it("public/memories/<code>/ のデモ写真は、アップロードと同じ形（縮小・EXIFなし）で配信され、上限2枚に数える。消せない", async () => {
    mkdirSync(path.join(process.env.MEMORIES_DIR!, "06"), { recursive: true });
    writeFileSync(path.join(process.env.MEMORIES_DIR!, "06", "zao_01.jpg"), await bigJpeg());
    const row = addRow(KEY, "06");
    const s = photos.photoSummary(KEY, "06")!;
    expect(s.photos).toEqual([{ slot: "d1", demo: true }]);
    const served = await sharp((await photos.readPhoto(KEY, row.id, "d1"))!).metadata();
    expect(Math.max(served.width!, served.height!)).toBe(1600);
    expect(served.exif).toBeUndefined();
    await photos.addPhoto(KEY, row.id, await bigJpeg(800, 600)); // 1+1=2
    await expect(photos.addPhoto(KEY, row.id, await bigJpeg(800, 600))).rejects.toMatchObject({ code: "limit" });
    expect(() => photos.removePhoto(KEY, row.id, 1 as 1 | 2)).not.toThrow(); // アップロード分は消せる
    expect(photos.photoSummary(KEY, "06")!.photos[0]).toEqual({ slot: "d1", demo: true });
  });
});

describe("demo-seed / demo-reset", () => {
  it("記録を消したうえで、6温泉地を所持にする。杖立は今日・雪見。何度やっても6", async () => {
    const DEMO = "demo-user-key-0123456789";
    addRow(DEMO, "44"); // 消えるはずの既存の記録
    const now = new Date("2026-11-05T03:00:00Z");
    const r = demo.demoSeed(DEMO, now);
    expect(r.added).toBe(6);
    const rows = dbm.db.select().from(dbm.schema.goyuin).all();
    expect(rows).toHaveLength(6); // 別の端末・古い記録も消えている
    expect(new Set(rows.map((x) => x.onsenAreaId)).size).toBe(6);
    expect(rows.every((x) => x.userKey === DEMO)).toBe(true);

    const idToCode = new Map(dbm.db.select().from(dbm.schema.onsenArea).all().map((a) => [a.id, a.code]));
    const tsuetate = rows.find((x) => idToCode.get(x.onsenAreaId) === "43")!;
    expect(tsuetate.variant).toBe("yukimi");
    expect(tsuetate.obtainedAt.toISOString()).toBe(now.toISOString());
    expect(new Set(rows.map((x) => x.variant)).size).toBe(4); // 4種が混ざる
    const oldest = Math.min(...rows.map((x) => x.obtainedAt.getTime()));
    expect(now.getTime() - oldest).toBeLessThanOrEqual(62 * 24 * 3600 * 1000); // 過去2か月以内

    expect(demo.demoSeed(DEMO, now).added).toBe(6);
    expect(dbm.db.select().from(dbm.schema.goyuin).all()).toHaveLength(6);
    expect(demo.latestUserKey()).toBe(DEMO);
  });

  it("「わたし」の計算に載せると、レベル・称号・実績が点灯する", async () => {
    const { summarizePoints, computeProgress } = await import("./progress");
    const idToCode = new Map(dbm.db.select().from(dbm.schema.onsenArea).all().map((a) => [a.id, a.code]));
    const records = dbm.db.select().from(dbm.schema.goyuin).all().map((r) => ({ code: idToCode.get(r.onsenAreaId)!, variant: r.variant, obtainedAt: r.obtainedAt.toISOString() }));
    const p = summarizePoints(records);
    expect(p.points).toBe(650); // 6枚×100 + 雪見50
    expect(p.level).toBe(3);
    const areas = AREAS.map(([code]) => ({ code, prefecture: "テスト県" }));
    const prog = computeProgress(records, areas);
    expect(prog.ownedCount).toBe(6);
    expect(prog.badges.find((b) => b.id === "first")!.achieved).toBe(true); // 「はじめの湯」が点灯
    expect(prog.badges.find((b) => b.id === "ten")!.achieved).toBe(false); // 10か所には届かない
  });

  it("demo-reset は取得記録と写真を全部消す", () => {
    expect(demo.demoReset()).toBe(6);
    expect(dbm.db.select().from(dbm.schema.goyuin).all()).toHaveLength(0);
    expect(readdirSync(process.env.PHOTO_DIR!).filter((f) => f.endsWith(".jpg"))).toHaveLength(0);
  });
});
