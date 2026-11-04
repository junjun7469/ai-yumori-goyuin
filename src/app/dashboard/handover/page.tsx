import Link from "next/link";
import { Markdown } from "@/components/dashboard/Markdown";
import { listHandoverNotes } from "@/lib/handoverDb";
import { HandoverClient } from "./HandoverClient";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** D4 引き継ぎメモ：最新の版を表示し、再生成できる。過去の版も見られる */
export default async function HandoverPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const notes = listHandoverNotes(20);
  const current = notes.find((n) => String(n.id) === id) ?? notes[0] ?? null;

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-16">
      <header className="space-y-1">
        <Link href="/dashboard" className="text-xs text-sky-700 underline">← ダッシュボード</Link>
        <h1 className="text-xl font-bold">引き継ぎメモ</h1>
        <p className="text-sm text-stone-600">
          直近60日の湯日誌・検知結果・湯守の判断基準・メンテナンス記録から、AI（Claude）が作る<strong>下書き</strong>です。湯守が確認し、自分の言葉に直して使います。
        </p>
      </header>

      <HandoverClient hasNote={!!current} />

      {current ? (
        <article className="space-y-3 rounded-lg border bg-white p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
            <span className="rounded bg-stone-100 px-1.5 py-0.5 font-bold">下書き</span>
            <span>期間 {current.periodFrom}〜{current.periodTo}</span>
            <span>作成 {fmt.format(current.createdAt)}</span>
            <span>{current.model}</span>
            {current.id !== notes[0].id && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900">過去の版</span>}
          </div>
          <Markdown md={current.bodyMd} />
        </article>
      ) : (
        <p className="rounded-lg border bg-white p-5 text-sm text-stone-600">まだメモがありません。「メモを作る」を押すと、1分ほどで下書きができます。</p>
      )}

      {notes.length > 1 && (
        <section aria-label="過去の版" className="space-y-2">
          <h2 className="text-sm font-bold text-stone-700">保存済みの版（新しい順）</h2>
          <ul className="divide-y rounded-lg border bg-white text-sm">
            {notes.map((n) => (
              <li key={n.id}>
                <Link href={`/dashboard/handover?id=${n.id}`} className={`flex items-center gap-3 p-3 no-underline ${n.id === current?.id ? "bg-stone-50 font-bold" : ""}`} style={{ color: "inherit" }}>
                  <span className="tabular-nums">{fmt.format(n.createdAt)}</span>
                  <span className="text-stone-500">期間 {n.periodFrom}〜{n.periodTo}</span>
                  <span className="ml-auto text-xs text-stone-500">{n.model}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs leading-relaxed text-stone-500">
        丸正旅館の日次計測値は模擬データを含みます。メモの根拠は末尾に件数で示します。AI は湯守の判断を置き換えません。
      </p>
    </main>
  );
}
