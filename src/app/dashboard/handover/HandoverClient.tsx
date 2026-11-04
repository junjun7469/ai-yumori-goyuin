"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** メモの生成・再生成ボタン。生成には1分ほどかかる */
export function HandoverClient({ hasNote }: { hasNote: boolean }) {
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
    if (hasNote && !window.confirm("新しい版のメモを作ります。以前の版は残ります。よろしいですか？")) return;
    setBusy(true); setSec(0); setError(null);
    try {
      const res = await fetch("/api/handover", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "生成に失敗しました"); return; }
      router.push("/dashboard/handover");
      router.refresh();
    } catch {
      setError("通信に失敗しました。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={generate} disabled={busy} className="rounded-lg bg-sky-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
        {busy ? `メモを作っています…（${sec}秒。1分ほどかかります）` : hasNote ? "再生成する" : "メモを作る"}
      </button>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </div>
  );
}
