// 御湯印の「思い出の写真」（サーバー側専用）。1御湯印につき最大2枚。
// 保存先は data/photos/<goyuin_id>_<1|2>.jpg（git に入れない）。公開・共有はせず、端末の匿名キーが一致する行だけ読み書きできる。
// デモ用の初期写真は public/memories/<code>/ に置く。アップロードと同じ経路で縮小・EXIF除去して配信する。
import fs from "node:fs";
import path from "node:path";
import { and, asc, eq } from "drizzle-orm";
import sharp from "sharp";
import { db, schema } from "@/db";

export const MAX_PHOTOS = 2;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_EDGE_PX = 1600;

const photoDir = () => process.env.PHOTO_DIR ?? "data/photos";
const memoriesDir = () => process.env.MEMORIES_DIR ?? "public/memories";
const slotFile = (goyuinId: number, n: 1 | 2) => path.join(photoDir(), `${goyuinId}_${n}.jpg`);

export class PhotoError extends Error {
  constructor(public code: "not_found" | "limit" | "bad_image" | "too_large" | "forbidden", message: string) {
    super(message);
  }
}

/**
 * 長辺1600pxに縮め、向きを反映し、JPEG にし直す。
 * sharp は withMetadata を呼ばない限りメタデータ（EXIF・位置情報）を出力に引き継がない。
 */
export async function normalizePhoto(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input).rotate().resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    throw new PhotoError("bad_image", "画像として読み込めませんでした");
  }
}

/** public/memories/<code>/ の初期写真（最大2枚。ファイル名順） */
export function demoPhotoFiles(code: string): string[] {
  const dir = path.join(memoriesDir(), code);
  if (!/^\d{2}$/.test(code) || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort().slice(0, MAX_PHOTOS).map((f) => path.join(dir, f));
}

/** 写真が付く行：その端末がその温泉地を最初に取得した行（あとから同じ温泉地を取っても写真が動かない） */
function primaryRow(userKey: string, code: string) {
  const area = db.select().from(schema.onsenArea).where(eq(schema.onsenArea.code, code)).get();
  if (!area) return null;
  return db.select().from(schema.goyuin)
    .where(and(eq(schema.goyuin.userKey, userKey), eq(schema.goyuin.onsenAreaId, area.id)))
    .orderBy(asc(schema.goyuin.id)).limit(1).get() ?? null;
}

/** goyuin_id から、鍵が一致する行と温泉地コードを引く。写真の行でなければ null */
function ownedPhotoRow(userKey: string, goyuinId: number) {
  const row = db.select().from(schema.goyuin).where(eq(schema.goyuin.id, goyuinId)).get();
  if (!row || row.userKey !== userKey) return null;
  const area = db.select().from(schema.onsenArea).where(eq(schema.onsenArea.id, row.onsenAreaId)).get();
  if (!area) return null;
  const primary = primaryRow(userKey, area.code);
  if (!primary || primary.id !== row.id) return null;
  return { row, code: area.code };
}

export type PhotoRef = { slot: string; demo: boolean };

/** 表示順は、デモの初期写真 → アップロードした写真。slot は API の n（"1" "2" "d1" "d2"） */
export function photosOf(goyuinId: number, code: string): PhotoRef[] {
  const demo = demoPhotoFiles(code).map((_, i) => ({ slot: `d${i + 1}`, demo: true }));
  const mine = ([1, 2] as const).filter((n) => fs.existsSync(slotFile(goyuinId, n))).map((n) => ({ slot: String(n), demo: false }));
  return [...demo, ...mine].slice(0, MAX_PHOTOS);
}

export type PhotoSummary = { goyuinId: number; photos: PhotoRef[]; canAdd: boolean };

/** 詳細画面用。その端末が持っていなければ null */
export function photoSummary(userKey: string, code: string): PhotoSummary | null {
  const row = primaryRow(userKey, code);
  if (!row) return null;
  const photos = photosOf(row.id, code);
  return { goyuinId: row.id, photos, canAdd: photos.length < MAX_PHOTOS };
}

/** 図鑑カードのカメラ印用：写真がある温泉地コードの集合 */
export function codesWithPhotos(userKey: string): string[] {
  const rows = db.select().from(schema.goyuin).where(eq(schema.goyuin.userKey, userKey)).orderBy(asc(schema.goyuin.id)).all();
  const idToCode = new Map(db.select().from(schema.onsenArea).all().map((a) => [a.id, a.code]));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const code = idToCode.get(r.onsenAreaId);
    if (!code || seen.has(code)) continue;
    seen.add(code); // 最初の行だけが対象
    if (photosOf(r.id, code).length > 0) out.push(code);
  }
  return out;
}

/** 写真を1枚足す。上限2枚（デモの初期写真も数える） */
export async function addPhoto(userKey: string, goyuinId: number, input: Buffer): Promise<PhotoSummary> {
  if (input.length > MAX_UPLOAD_BYTES) throw new PhotoError("too_large", "写真が大きすぎます");
  const target = ownedPhotoRow(userKey, goyuinId);
  if (!target) throw new PhotoError("not_found", "対象の御湯印が見つかりません");
  const before = photosOf(goyuinId, target.code);
  if (before.length >= MAX_PHOTOS) throw new PhotoError("limit", `思い出の写真は${MAX_PHOTOS}枚までです`);
  const jpeg = await normalizePhoto(input);
  const n = ([1, 2] as const).find((k) => !fs.existsSync(slotFile(goyuinId, k)));
  if (!n) throw new PhotoError("limit", `思い出の写真は${MAX_PHOTOS}枚までです`);
  fs.mkdirSync(photoDir(), { recursive: true });
  fs.writeFileSync(slotFile(goyuinId, n), jpeg);
  syncCount(goyuinId);
  return photoSummary(userKey, target.code)!;
}

/** アップロードした写真を消す（デモの初期写真は消せない）。2枚目が残るときは1枚目に詰める */
export function removePhoto(userKey: string, goyuinId: number, n: 1 | 2): PhotoSummary {
  const target = ownedPhotoRow(userKey, goyuinId);
  if (!target || !fs.existsSync(slotFile(goyuinId, n))) throw new PhotoError("not_found", "写真が見つかりません");
  fs.rmSync(slotFile(goyuinId, n));
  if (n === 1 && fs.existsSync(slotFile(goyuinId, 2))) fs.renameSync(slotFile(goyuinId, 2), slotFile(goyuinId, 1));
  syncCount(goyuinId);
  return photoSummary(userKey, target.code)!;
}

/** 配信する写真（JPEG）。鍵が一致しなければ null */
export async function readPhoto(userKey: string, goyuinId: number, slot: string): Promise<Buffer | null> {
  const target = ownedPhotoRow(userKey, goyuinId);
  if (!target) return null;
  const d = /^d([12])$/.exec(slot);
  if (d) {
    const file = demoPhotoFiles(target.code)[Number(d[1]) - 1];
    return file ? normalizePhoto(fs.readFileSync(file)) : null;
  }
  if (slot !== "1" && slot !== "2") return null;
  const f = slotFile(goyuinId, Number(slot) as 1 | 2);
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
}

/** photo_count をファイルの実数に合わせる（アップロード分だけ数える） */
function syncCount(goyuinId: number) {
  const count = ([1, 2] as const).filter((n) => fs.existsSync(slotFile(goyuinId, n))).length;
  db.update(schema.goyuin).set({ photoCount: count }).where(eq(schema.goyuin.id, goyuinId)).run();
}

/** data/photos の写真をすべて消す（demo-reset 用） */
export function clearAllPhotos() {
  if (fs.existsSync(photoDir())) {
    for (const f of fs.readdirSync(photoDir())) if (/^\d+_[12]\.jpg$/.test(f)) fs.rmSync(path.join(photoDir(), f));
  }
}
