import { NextResponse } from "next/server";
import { getVisitsFor } from "@/lib/visitsDb";
import { LEVELS, isDate, type Level } from "@/lib/visitStats";

export const dynamic = "force-dynamic";

/** 来客と売上の集計（棒グラフと都道府県）。?level=month|week|day&from=YYYY-MM-DD&to=YYYY-MM-DD。範囲は全体の期間に収める */
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const level = q.get("level") as Level;
  const from = q.get("from");
  const to = q.get("to");
  if (!LEVELS.includes(level) || !isDate(from) || !isDate(to)) {
    return NextResponse.json({ error: "level は month / week / day、from と to は YYYY-MM-DD で指定してください" }, { status: 400 });
  }
  const r = getVisitsFor(level, { from, to });
  if (!r) return NextResponse.json({ error: "施設が未登録か、期間が範囲外です" }, { status: 404 });
  return NextResponse.json(r);
}
