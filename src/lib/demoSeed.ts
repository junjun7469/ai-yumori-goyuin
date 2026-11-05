// 撮影用のデモ状態（サーバー側専用）。実データを消すので、撮影用の端末・DB でだけ使う。
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTodayYu } from "./goyuinData";
import { isValidUserKey } from "./gachaLogic";
import type { Variant } from "./goyuinVariant";
import { clearAllPhotos } from "./photos";

/** キャラ画像のある6温泉地。daysAgo は今日からさかのぼる日数、柄は4種が混ざるようにしてある */
export const DEMO_STAMPS: { code: string; daysAgo: number; hour: number; variant: Variant; via: "gacha" | "visit" }[] = [
  { code: "01", daysAgo: 58, hour: 10, variant: "washi", via: "visit" }, // 登別
  { code: "02", daysAgo: 46, hour: 15, variant: "asayu", via: "visit" }, // 酸ヶ湯
  { code: "03", daysAgo: 33, hour: 9, variant: "yuuyu", via: "gacha" }, // 花巻
  { code: "04", daysAgo: 21, hour: 17, variant: "asayu", via: "visit" }, // 鳴子
  // 蔵王：3回通ってなりかわり済み（これまでの湯の子）
  { code: "06", daysAgo: 40, hour: 11, variant: "washi", via: "visit" },
  { code: "06", daysAgo: 24, hour: 14, variant: "asayu", via: "visit" },
  { code: "06", daysAgo: 9, hour: 11, variant: "washi", via: "visit" },
  // 杖立：2回通った（湯の精 2/3）。今日ではなく数日前にしてあるので、次に /visit/43 を取ると3回目でなりかわる
  { code: "43", daysAgo: 12, hour: 16, variant: "washi", via: "visit" },
  { code: "43", daysAgo: 3, hour: 10, variant: "yukimi", via: "visit" },
];

const DAY = 24 * 60 * 60 * 1000;

/** 取得記録を全部消す（写真のファイルも）。消した行数を返す */
export function demoReset(): number {
  const n = db.delete(schema.goyuin).run().changes;
  db.delete(schema.yunoko).run(); // 湯の子は取得記録から育つので、いっしょに消す
  clearAllPhotos();
  return n;
}

/** 引数が無いときに使う「直近のキー」：記録の最後の行のキー。何も無ければ null */
export function latestUserKey(): string | null {
  return db.select().from(schema.goyuin).orderBy(desc(schema.goyuin.id)).limit(1).get()?.userKey ?? null;
}

/** 記録を消したうえで、デモの6温泉地を userKey の所持にする */
export function demoSeed(userKey: string, now: Date = new Date()): { removed: number; added: number; owned: number } {
  if (!isValidUserKey(userKey)) throw new Error("user_key が正しくありません（16〜64文字の英数字・_・-）");
  const codeToId = new Map(db.select().from(schema.onsenArea).all().map((a) => [a.code, a.id]));
  const missing = DEMO_STAMPS.filter((s) => !codeToId.has(s.code));
  if (missing.length) throw new Error(`温泉地 ${missing.map((m) => m.code).join(",")} が DB にありません。先に npm run seed を実行してください`);

  const removed = demoReset();
  for (const s of DEMO_STAMPS) {
    const at = s.daysAgo === 0 ? now : new Date(now.getTime() - s.daysAgo * DAY + (s.hour - 12) * 3600 * 1000);
    // 杖立の最新の1枚は、取得時点の「今日の湯」（一言つき・模擬データのフラグつき）を残す。日誌が無ければ null のまま
    const snapshot = s.code === "43" && s.variant === "yukimi" ? getTodayYu("43") : null;
    db.insert(schema.goyuin).values({
      userKey, onsenAreaId: codeToId.get(s.code)!, obtainedVia: s.via, obtainedAt: at, variant: s.variant,
      snapshot: snapshot ? (snapshot as unknown as Record<string, unknown>) : null,
    }).run();
  }
  // 湯の子：杖立に2回通った湯の精（2/3）と、なりかわり済みの蔵王（これまでの湯の子）
  db.insert(schema.yunoko).values([
    { userKey, boundOnsenCode: "06", visits: 3, stage: 3, bornAt: new Date(now.getTime() - 41 * DAY), evolvedAt: new Date(now.getTime() - 9 * DAY), evolvedOnsenCode: "06" },
    { userKey, boundOnsenCode: "43", visits: 2, stage: 2, bornAt: new Date(now.getTime() - 9 * DAY) },
  ]).run();
  return { removed, added: DEMO_STAMPS.length, owned: new Set(DEMO_STAMPS.map((s) => s.code)).size };
}
