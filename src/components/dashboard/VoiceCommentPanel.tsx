"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { VoiceCommentView } from "@/lib/voicesDb";

type Out = {
  summary?: string;
  observations?: { days: string; bath: string; voices: string; bath_state: string }[];
  check_items?: string[];
};


/** Claude のコメント（湯の声と湯の状態の突き合わせ）。ボタンで作る。結果は保存され、最新のものを出す */
export function VoiceCommentPanel({ latest }: { latest: VoiceCommentView | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sec, setSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function generate() {
    setBusy(true); setSec(0); setError(null);
    try {
      const res = await fetch("/api/voices/comment", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "作成に失敗しました"); return; }
      router.refresh();
    } catch {
      setError("通信に失敗しました。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  }

  const o = (latest?.output ?? {}) as Out;
  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Claude のコメント（声と湯の状態の突き合わせ）</h2>
        <button onClick={generate} disabled={busy} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy ? `作っています…（${sec}秒）` : latest ? "作り直す" : "コメントを作る"}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      {!latest ? (
        <p className="text-stone-500">まだありません。ボタンを押すと、上の集計とひとことを Claude に渡して、声と湯の状態が並んで見える箇所をまとめます。</p>
      ) : (
        <div className="space-y-3">
          {o.summary && <p>{o.summary}</p>}
          {o.observations && o.observations.length > 0 && (
            <ul className="space-y-2">
              {o.observations.map((x, i) => (
                <li key={i} className="rounded border border-stone-200 p-2">
                  <p className="font-medium">{x.days}　{x.bath}</p>
                  <p>声：{x.voices}</p>
                  <p className="text-stone-600">湯の状態：{x.bath_state}</p>
                </li>
              ))}
            </ul>
          )}
          {o.check_items && o.check_items.length > 0 && (
            <div>
              <p className="font-medium">確認するとよいこと（要確認）</p>
              <ul className="list-disc pl-5">{o.check_items.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
          <p className="text-sm text-stone-600">AI（Claude）の参考情報です。判断は湯守が行います</p>
        </div>
      )}
    </section>
  );
}
