// 撮影用のデモ状態（サーバー側専用）。実データを消すので、撮影用の端末・DB でだけ使う。
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTodayYu } from "./goyuinData";
import { isValidUserKey } from "./gachaLogic";
import type { Variant } from "./goyuinVariant";
import { clearAllPhotos } from "./photos";

/** キャラ画像のある6温泉地。daysAgo は今日からさかのぼる日数、柄は4種が混ざるようにしてある（杖立は今日・雪見） */
export const DEMO_STAMPS: { code: string; daysAgo: number; hour: number; variant: Variant; via: "gacha" | "visit" }[] = [
  { code: "01", daysAgo: 58, hour: 10, variant: "washi", via: "visit" }, // 登別
  { code: "02", daysAgo: 46, hour: 15, variant: "asayu", via: "visit" }, // 酸ヶ湯
  { code: "03", daysAgo: 33, hour: 9, variant: "yuuyu", via: "gacha" }, // 花巻
  { code: "04", daysAgo: 21, hour: 17, variant: "asayu", via: "visit" }, // 鳴子
  { code: "06", daysAgo: 9, hour: 11, variant: "washi", via: "visit" }, // 蔵王
  { code: "43", daysAgo: 0, hour: 0, variant: "yukimi", via: "visit" }, // 杖立（今日）
];

const DAY = 24 * 60 * 60 * 1000;

/** 取得記録を全部消す（写真のファイルも）。消した行数を返す */
export function demoReset(): number {
  const n = db.delete(schema.goyuin).run().changes;
  clearAllPhotos();
  return n;
}

/** 引数が無いときに使う「直近のキー」：記録の最後の行のキー。何も無ければ null */
export function latestUserKey(): string | null {
  return db.select().from(schema.goyuin).orderBy(desc(schema.goyuin.id)).limit(1).get()?.userKey ?? null;
}

/** 記録を消したうえで、デモの6温泉地を userKey の所持にする */
export function demoSeed(userKey: string, now: Date = new Date()): { removed: number; added: number } {
  if (!isValidUserKey(userKey)) throw new Error("user_key が正しくありません（16〜64文字の英数字・_・-）");
  const codeToId = new Map(db.select().from(schema.onsenArea).all().map((a) => [a.code, a.id]));
  const missing = DEMO_STAMPS.filter((s) => !codeToId.has(s.code));
  if (missing.length) throw new Error(`温泉地 ${missing.map((m) => m.code).join(",")} が DB にありません。先に npm run seed を実行してください`);

  const removed = demoReset();
  for (const s of DEMO_STAMPS) {
    const at = s.daysAgo === 0 ? now : new Date(now.getTime() - s.daysAgo * DAY + (s.hour - 12) * 3600 * 1000);
    // 杖立は取得時点の「今日の湯」（一言つき・模擬データのフラグつき）を残す。日誌が無ければ null のまま
    const snapshot = s.code === "43" ? getTodayYu("43") : null;
    db.insert(schema.goyuin).values({
      userKey, onsenAreaId: codeToId.get(s.code)!, obtainedVia: s.via, obtainedAt: at, variant: s.variant,
      snapshot: snapshot ? (snapshot as unknown as Record<string, unknown>) : null,
    }).run();
  }
  return { removed, added: DEMO_STAMPS.length };
}
