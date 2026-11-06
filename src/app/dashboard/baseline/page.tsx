import Link from "next/link";
import { getBaselineView } from "@/lib/baselineDb";
import type { ComponentGroup, Item } from "@/lib/baselineView";

export const dynamic = "force-dynamic";

const Flag = () => (
  <span className="ml-1 inline-flex items-center rounded border border-amber-400 bg-amber-50 px-1.5 text-[11px] font-bold text-amber-800">
    △ 要確認
  </span>
);

function ItemTable({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="mb-2 font-bold">{title}</h2>
      <dl className="divide-y text-sm">
        {items.map((i) => (
          <div key={i.label} className="grid grid-cols-[10rem_1fr] gap-2 py-1.5">
            <dt className="text-stone-500">{i.label}</dt>
            <dd>
              <span className="font-medium">{i.value}</span>
              {i.needsVerification && <Flag />}
              {i.note && <p className="text-xs text-stone-500">{i.note}</p>}
              {i.usedAsBaseline && <p className="text-xs text-sky-800">◆ {i.usedAsBaseline}</p>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GroupTable({ g }: { g: ComponentGroup }) {
  const hasMval = g.rows.some((r) => r.mval !== null) || g.totalMval !== null;
  const fmt = (v: number | string | null) => (v === null ? "記載なし" : String(v));
  return (
    <table className="w-full text-sm">
      <caption className="pb-1 text-left font-bold">{g.title}</caption>
      <thead className="text-xs text-stone-500">
        <tr className="border-b">
          <th className="py-1 text-left font-normal">成分</th>
          <th className="py-1 text-right font-normal">mg/kg</th>
          {hasMval && <th className="py-1 text-right font-normal">mval</th>}
        </tr>
      </thead>
      <tbody>
        {g.rows.map((r) => (
          <tr key={r.key} className="border-b border-stone-100">
            <td className="py-1">{r.label}</td>
            <td className={`py-1 text-right tabular-nums ${r.mg === null ? "text-stone-400" : ""}`}>{fmt(r.mg)}</td>
            {hasMval && <td className="py-1 text-right tabular-nums">{r.mval ?? "—"}</td>}
          </tr>
        ))}
        {(g.totalMg !== null || g.totalMval !== null) && (
          <tr className="font-medium">
            <td className="py-1">計</td>
            <td className="py-1 text-right tabular-nums">{g.totalMg ?? "—"}</td>
            {hasMval && <td className="py-1 text-right tabular-nums">{g.totalMval ?? "—"}</td>}
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** D1 基準値（分析書）：丸正旅館の温泉分析書（2014年）の転記と、要確認の項目、分析からの経過 */
export default function BaselinePage() {
  const v = getBaselineView();
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 pb-16">
      <header className="space-y-1">
        <Link href="/dashboard" className="text-xs text-sky-700 underline">← ダッシュボード</Link>
        <h1 className="text-xl font-bold">基準値（温泉分析書）</h1>
        {v && (
          <p className="text-sm text-stone-600">
            {v.facility}　{v.sourceName}　分析日 {v.analyzedAt}
            {v.certificateNo && `　${v.certificateNo}`}
          </p>
        )}
      </header>

      {!v ? (
        <p className="rounded-lg border bg-white p-4 text-sm text-stone-600">分析書が未登録です。npm run seed を実行してください。</p>
      ) : (
        <>
          <section className="rounded-lg border bg-white p-4">
            <p className="text-xs text-stone-500">泉質</p>
            <p className="text-2xl font-bold">{v.springType}</p>
            {v.springTypeOld && <p className="text-xs text-stone-500">旧泉質名：{v.springTypeOld}</p>}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {v.classification.map((c) => (
                <span key={c.label} className="rounded-full border px-2 py-0.5">{c.label}：{c.value}</span>
              ))}
            </div>
          </section>

          {v.elapsed && (
            <section className={`rounded-lg border p-4 text-sm ${v.elapsed.overGuide ? "border-amber-400 bg-amber-50" : "bg-white"}`}>
              <p className="font-bold">{v.elapsed.overGuide ? "△ 再分析の時期（要確認）" : "再分析の時期"}</p>
              <p>{v.elapsed.message}</p>
            </section>
          )}

          {v.needsVerification.length > 0 && (
            <section className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm">
              <h2 className="font-bold">△ 要確認の項目（{v.needsVerification.length}件）</h2>
              <p className="mb-2 text-xs text-stone-600">分析書の読み取りで食い違いが見つかった箇所です。数値は直さず、原本で確認するまで印を付けています。</p>
              <ul className="list-disc space-y-1 pl-5">
                {v.needsVerification.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </section>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <ItemTable title="現地試験" items={v.field} />
            <ItemTable title="試験室試験" items={v.labResults} />
          </div>

          <section className="space-y-4 rounded-lg border bg-white p-4">
            <h2 className="font-bold">成分（温泉水 1kg 中）</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {v.groups.map((g) => <GroupTable key={g.title} g={g} />)}
            </div>
            {v.therapeuticNote && <p className="text-xs text-stone-600">分析書の下段の記載：{v.therapeuticNote}</p>}
          </section>

          <section className="rounded-lg border bg-white p-4 text-xs leading-relaxed text-stone-600">
            <p>
              分析：{v.lab ?? "記載なし"}　採水 {v.sampledAt ?? "記載なし"}／分析 {v.analyzedAt}
              {v.sourceLocation && `　源泉所在地：${v.sourceLocation}`}
            </p>
            {v.sourceNote && <p>分析書の注記：{v.sourceNote}</p>}
            <p>
              この画面の値は温泉分析書の転記で、模擬データではありません。転記：{v.digitizedFrom ?? "記載なし"}
              {v.digitizedAt && `（${v.digitizedAt}）`}。
              ◆ の付いた値は、湯日誌の変化検知で基準に使っています（浴槽の値とは別の、源泉の値です）。
            </p>
          </section>
        </>
      )}
    </main>
  );
}
