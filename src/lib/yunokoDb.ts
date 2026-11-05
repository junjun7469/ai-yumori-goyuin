// 湯の子の保存と読み出し（サーバー側専用）。判定は yunoko.ts
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { applyVisit, spiritTone, stageOf, type SpiritTone, type Stage } from "./yunoko";

type Row = typeof schema.yunoko.$inferSelect;

const areaOf = (code: string | null) =>
  code ? db.select().from(schema.onsenArea).where(eq(schema.onsenArea.code, code)).get() ?? null : null;

/** いま育てている湯の子。無ければ（初めて・なりかわった直後）たまごを生む */
function activeOf(userKey: string, now: Date): Row {
  const row = db.select().from(schema.yunoko)
    .where(and(eq(schema.yunoko.userKey, userKey), isNull(schema.yunoko.evolvedAt))).orderBy(desc(schema.yunoko.id)).limit(1).get();
  return row ?? db.insert(schema.yunoko).values({ userKey, visits: 0, stage: 0, bornAt: now }).returning().get();
}

export type YunokoGrowth = {
  grew: boolean; // 今回の入浴で育ったか
  evolved: boolean; // 今回、なりかわったか
  stage: Stage; // 育ったあとの段階（なりかわったときは 3）
  visits: number;
  boundCode: string | null;
  tone: SpiritTone | null; // 湯の精の色（通い始めた温泉地の泉質から）
};

const toneOf = (code: string | null): SpiritTone | null => {
  const a = areaOf(code);
  return a ? spiritTone(a.springTypeClass, a.springType) : null;
};

/** 入浴1回ぶん湯の子を育てる（claimVisit が、新しく御湯印を取れたときだけ呼ぶ。同じ日の2回目は呼ばれない） */
export function growYunoko(userKey: string, code: string, now: Date = new Date()): YunokoGrowth {
  const row = activeOf(userKey, now);
  const out = applyVisit({ boundCode: row.boundOnsenCode, visits: row.visits }, code);
  if (!out.grew) return { grew: false, evolved: false, stage: out.stage, visits: row.visits, boundCode: row.boundOnsenCode, tone: toneOf(row.boundOnsenCode) };

  db.transaction((tx) => {
    tx.update(schema.yunoko).set({
      boundOnsenCode: out.state.boundCode, visits: out.state.visits, stage: out.stage,
      ...(out.evolved ? { evolvedAt: now, evolvedOnsenCode: code } : {}),
    }).where(eq(schema.yunoko.id, row.id)).run();
    if (out.evolved) tx.insert(schema.yunoko).values({ userKey, visits: 0, stage: 0, bornAt: now }).run(); // 新しい湯の子がすぐ生まれる
  });
  return { grew: true, evolved: out.evolved, stage: out.stage, visits: out.state.visits, boundCode: out.state.boundCode, tone: toneOf(out.state.boundCode) };
}

/** 育たなかったとき（同じ日の再訪など）に返す、いまの様子 */
export function currentYunoko(userKey: string, now: Date = new Date()): YunokoGrowth {
  const row = activeOf(userKey, now);
  return { grew: false, evolved: false, stage: stageOf(row.visits), visits: row.visits, boundCode: row.boundOnsenCode, tone: toneOf(row.boundOnsenCode) };
}

export type YunokoView = {
  active: { boundCode: string | null; boundName: string | null; visits: number; stage: Stage; tone: SpiritTone | null };
  history: { code: string; name: string; prefecture: string; characterImage: string | null; springTypeClass: string; evolvedAt: string }[];
};

/** /goyuin/yunoko 用：いまの湯の子と、これまでになりかわった湯の子 */
export function getYunokoView(userKey: string, now: Date = new Date()): YunokoView {
  const row = activeOf(userKey, now);
  const bound = areaOf(row.boundOnsenCode);
  const done = db.select().from(schema.yunoko)
    .where(and(eq(schema.yunoko.userKey, userKey), isNotNull(schema.yunoko.evolvedAt))).orderBy(desc(schema.yunoko.evolvedAt), desc(schema.yunoko.id)).all();
  return {
    active: { boundCode: row.boundOnsenCode, boundName: bound?.name ?? null, visits: row.visits, stage: stageOf(row.visits), tone: bound ? spiritTone(bound.springTypeClass, bound.springType) : null },
    history: done.flatMap((r) => {
      const a = areaOf(r.evolvedOnsenCode);
      return a && r.evolvedAt ? [{ code: a.code, name: a.name, prefecture: a.prefecture, characterImage: a.characterImage, springTypeClass: a.springTypeClass, evolvedAt: r.evolvedAt.toISOString() }] : [];
    }),
  };
}

/** なりかわった温泉地（通い湯バッジ）と回数（ポイント・実績） */
export function evolutionsOf(userKey: string): { count: number; codes: string[] } {
  const done = db.select().from(schema.yunoko)
    .where(and(eq(schema.yunoko.userKey, userKey), isNotNull(schema.yunoko.evolvedAt))).orderBy(asc(schema.yunoko.id)).all();
  return { count: done.length, codes: [...new Set(done.map((r) => r.evolvedOnsenCode).filter((c): c is string => !!c))] };
}
