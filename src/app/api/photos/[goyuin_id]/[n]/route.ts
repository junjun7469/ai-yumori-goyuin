import { NextResponse } from "next/server";
import { isValidUserKey } from "@/lib/gachaLogic";
import { PhotoError, readPhoto, removePhoto } from "@/lib/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ goyuin_id: string; n: string }> };

/** 写真を返す：GET /api/photos/{goyuin_id}/{n}?user_key=…（n は 1 | 2。デモの初期写真は d1 | d2）。端末のキーが一致しなければ 404 */
export async function GET(req: Request, ctx: Ctx) {
  const { goyuin_id, n } = await ctx.params;
  const key = new URL(req.url).searchParams.get("user_key");
  const id = Number(goyuin_id);
  if (!isValidUserKey(key) || !Number.isInteger(id)) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  const buf = await readPhoto(key, id, n);
  if (!buf) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store" } });
}

/** 写真を消す：DELETE /api/photos/{goyuin_id}/{n}?user_key=…（アップロードした 1 | 2 だけ） */
export function DELETE(req: Request, ctx: Ctx) {
  return (async () => {
    const { goyuin_id, n } = await ctx.params;
    const key = new URL(req.url).searchParams.get("user_key");
    const id = Number(goyuin_id);
    if (!isValidUserKey(key) || !Number.isInteger(id) || (n !== "1" && n !== "2")) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    try {
      return NextResponse.json(removePhoto(key, id, Number(n) as 1 | 2));
    } catch (e) {
      if (e instanceof PhotoError) return NextResponse.json({ error: e.message }, { status: 404 });
      throw e;
    }
  })();
}
