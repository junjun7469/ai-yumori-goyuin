// 「湯の個性」のキャッシュ（DB）。サーバー側専用。画面・API は読むだけ。
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import type { PersonalityFacts } from "./facts";
import type { Generated } from "./pipeline";

export type PersonalityView = { body: string; citation: string; kind: "analysis" | "class_only" };

/** 画面に出す分。生成前は null */
export function getPersonality(code: string): PersonalityView | null {
  const r = db.select().from(schema.onsenPersonality).where(eq(schema.onsenPersonality.code, code)).get();
  return r ? { body: r.body, citation: r.citation, kind: r.kind } : null;
}

export function hasPersonality(code: string): boolean {
  return !!db.select({ code: schema.onsenPersonality.code }).from(schema.onsenPersonality).where(eq(schema.onsenPersonality.code, code)).get();
}

export function savePersonality(facts: PersonalityFacts, g: Generated, models: string) {
  const row = {
    code: facts.code, body: g.body, citation: g.citation, kind: facts.kind, models,
    rewrites: g.rewrites, log: g.rounds, costUsd: g.costUsd,
  };
  db.insert(schema.onsenPersonality).values(row).onConflictDoUpdate({ target: schema.onsenPersonality.code, set: { ...row, updatedAt: new Date() } }).run();
}
