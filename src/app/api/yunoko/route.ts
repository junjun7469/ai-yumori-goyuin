import { NextResponse } from "next/server";
import { isValidUserKey } from "@/lib/gachaLogic";
import { getYunokoView } from "@/lib/yunokoDb";

export const dynamic = "force-dynamic";

/** 湯の子の様子：GET /api/yunoko?user_key=…（いまの湯の子と、なりかわった湯の子の一覧）。通った温泉地の名前だけを返す */
export function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("user_key");
  if (!isValidUserKey(key)) return NextResponse.json({ error: "user_key が正しくありません" }, { status: 400 });
  return NextResponse.json(getYunokoView(key));
}
