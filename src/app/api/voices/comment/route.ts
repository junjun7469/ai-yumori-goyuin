import { NextResponse } from "next/server";
import { VoiceCommentError } from "@/lib/voiceComment";
import { createVoiceComment } from "@/lib/voicesDb";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 湯の声と湯の状態の突き合わせコメントを作り、入力と出力を保存する（ボタンで呼ぶ。以前のものは残る） */
export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "APIキー（ANTHROPIC_API_KEY）が未設定のため、コメントを作れません" }, { status: 503 });
  }
  try {
    const r = await createVoiceComment();
    if (r === "busy") return NextResponse.json({ error: "いま別のコメントを作成中です。終わるまでお待ちください" }, { status: 409 });
    if (r === "no-facility") return NextResponse.json({ error: "施設が未登録です。npm run seed を実行してください" }, { status: 500 });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    console.error("[voices/comment] failed:", e);
    const msg = e instanceof VoiceCommentError ? e.message : "コメントの作成に失敗しました（通信またはAPIのエラー）。しばらくして再度お試しください";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
