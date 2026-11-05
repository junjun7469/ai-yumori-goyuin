import { NextResponse } from "next/server";
import { isValidUserKey } from "@/lib/gachaLogic";
import { addPhoto, PhotoError } from "@/lib/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = { not_found: 404, limit: 409, bad_image: 400, too_large: 413, forbidden: 403 } as const;

/** 写真を足す：POST /api/photos/{goyuin_id}（multipart: user_key, photo）。1御湯印につき2枚まで */
export async function POST(req: Request, ctx: { params: Promise<{ goyuin_id: string }> }) {
  const { goyuin_id } = await ctx.params;
  const id = Number(goyuin_id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "送信の形式が正しくありません" }, { status: 400 }); }
  const key = form.get("user_key");
  const file = form.get("photo");
  if (!isValidUserKey(key)) return NextResponse.json({ error: "user_key が正しくありません" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "写真が選ばれていません" }, { status: 400 });
  try {
    const summary = await addPhoto(key, id, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(summary);
  } catch (e) {
    if (e instanceof PhotoError) return NextResponse.json({ error: e.message }, { status: STATUS[e.code] });
    throw e;
  }
}
