/** /goyuin/[code]（所持分）の「湯の個性」。src/agents/ が書いて DB にキャッシュした説明文を出す（画面を開いても API は呼ばない） */
export type PersonalityData = { body: string; citation: string; kind: "analysis" | "class_only" };

export function PersonalitySection({ data }: { data: PersonalityData | null }) {
  if (!data) return null; // 生成前は何も出さない
  return (
    <section aria-label="湯の個性" className="goshuin-card space-y-3 p-5">
      <h3 className="text-sm font-bold">湯の個性</h3>
      <p className="text-sm leading-relaxed">{data.body}</p>
      <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">
        {data.citation}
        {data.kind === "class_only" && (
          <span className="ml-1.5 rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">要確認</span>
        )}
      </p>
      <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">AI（Claude）が、上の出典の情報だけをもとに書いた説明です。医療上の効能を示すものではありません。</p>
    </section>
  );
}
