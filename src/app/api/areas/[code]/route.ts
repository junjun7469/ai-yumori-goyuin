import { NextResponse } from "next/server";
import { getArea, getTodayYu } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** 詳細。AI湯守を導入した施設がある温泉地（今は杖立）だけ today（今日の湯）を含む */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const area = /^\d{2}$/.test(code) ? getArea(code) : null;
  if (!area) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  return NextResponse.json({ area, today: getTodayYu(code) });
}
