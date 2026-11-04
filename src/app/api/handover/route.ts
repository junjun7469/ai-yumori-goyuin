import { NextResponse } from "next/server";
import { HandoverError } from "@/lib/handover";
import { createHandoverNote, listHandoverNotes } from "@/lib/handoverDb";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 生成に1分前後かかる

/** 引き継ぎメモを生成して保存する（再生成も同じ。新しい版が増え、以前の版は残る） */
export async function POST() {
  if (process.env.HANDOVER === "off") {
    return NextResponse.json({ error: "引き継ぎメモの生成は停止中です（環境変数 HANDOVER=off）" }, { status: 503 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "APIキー（ANTHROPIC_API_KEY）が未設定のため、メモを生成できません" }, { status: 503 });
  }
  try {
    const r = await createHandoverNote();
    if (r === "busy") return NextResponse.json({ error: "いま別のメモを生成中です。終わるまでお待ちください" }, { status: 409 });
    if (r === "no-facility") return NextResponse.json({ error: "施設が未登録です。npm run seed を実行してください" }, { status: 500 });
    return NextResponse.json({ note: r.note, repairs: r.run.repairs, usage: r.run.usage }, { status: 201 });
  } catch (e) {
    console.error("[handover] failed:", e);
    const msg = e instanceof HandoverError ? e.message : "メモの生成に失敗しました（通信またはAPIのエラー）。しばらくして再度お試しください";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** 保存済みの版の一覧（新しい順） */
export function GET() {
  return NextResponse.json({ notes: listHandoverNotes() });
}
