import { NextResponse } from "next/server";
import { isValidUserKey } from "@/lib/gachaLogic";
import { listAreas, maskAreas, ownedVariantsOf } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/**
 * 47温泉地の一覧：GET /api/areas?user_key=…
 * 未所持の温泉地は code と都道府県名だけ（名前・画像・泉質などはレスポンスに含めない）。キーが無い・不正なら全部未所持として返す
 */
export function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("user_key");
  const owned = ownedVariantsOf(isValidUserKey(key) ? key : null);
  return NextResponse.json({ areas: maskAreas(listAreas(), owned) });
}
