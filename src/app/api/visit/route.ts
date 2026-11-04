import { NextResponse } from "next/server";
import { isValidUserKey } from "@/lib/gachaLogic";
import { claimVisit } from "@/lib/visitDb";

export const dynamic = "force-dynamic";

/** QR 着地：POST { code, user_key }。温泉地は code で決まり、柄だけ決める。同じ日・同じ温泉地は同じ結果を返す */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { code?: unknown; user_key?: unknown } | null;
  if (!isValidUserKey(body?.user_key)) return NextResponse.json({ error: "user_key が正しくありません" }, { status: 400 });
  if (typeof body?.code !== "string" || !/^\d{2}$/.test(body.code)) return NextResponse.json({ error: "code が正しくありません" }, { status: 400 });

  const r = claimVisit(body.user_key, body.code);
  if (!r) return NextResponse.json({ error: "その温泉地は見つかりません" }, { status: 404 });
  return NextResponse.json(r, { status: r.already ? 200 : 201 });
}
