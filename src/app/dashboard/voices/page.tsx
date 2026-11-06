import Link from "next/link";
import { VoiceCommentPanel } from "@/components/dashboard/VoiceCommentPanel";
import { VoicesChart } from "@/components/dashboard/VoicesChart";
import { getVoicesPage } from "@/lib/voicesDb";

export const dynamic = "force-dynamic";

/** 湯の声：御湯印で集める「湯への評価とひとこと」を、その日の浴槽温度と並べて見る（サンプル＝模擬データ） */
export default function VoicesPage() {
  const v = getVoicesPage();
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 pb-16">
      <header className="space-y-1">
        <Link href="/dashboard" className="text-xs text-sky-700 underline">← ダッシュボード</Link>
        <h1 className="text-xl font-bold">
          湯の声 <span className="ml-1 align-middle rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">サンプル（模擬データ）</span>
        </h1>
        <p className="text-sm text-stone-600">
          御湯印で集める「湯への評価（1〜5）とひとこと」を、その日の浴槽温度と並べて見る画面です。
          予約サイトのレビューは宿泊全体への評価ですが、ここでは湯だけの声を見ます。
        </p>
        {v && (
          <p className="text-sm text-stone-600">
            {v.facility}・直近60日（{v.period.from}〜{v.period.to}）　声 {v.totals.voices} 件（{v.totals.days} 日）
            評価平均 {v.totals.ratingAvg ?? "—"}　うち浴槽別に入らない声 {v.totals.unassigned} 件
          </p>
        )}
      </header>

      <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
        <p className="font-bold">この画面はサンプル（模擬データ）と将来の運用案です</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>湯の声（評価とひとこと）は、実際の利用者の声ではありません。御湯印から声を集める機能は構想段階です。</li>
          <li>男湯・女湯の浴槽温度は<strong>将来の運用案</strong>です。今は浴槽ごとに測っていないため、湯日誌の浴槽温度（これも模擬データ）を基準に作った値です。</li>
          <li>浴槽は利用者に聞かず、性別と浴槽の対応表（男性→男湯、女性→女湯）で決めます。性別が未回答・その他の声は、全体にだけ入れます。</li>
          <li>温度と評価を並べていますが、両者の関係を確かめたものではありません。</li>
        </ul>
      </section>

      {!v ? (
        <p className="rounded-lg border bg-white p-4 text-sm text-stone-600">施設が未登録です。npm run seed を実行してください。</p>
      ) : v.totals.voices === 0 && v.series.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-sm text-stone-600">この期間の声がありません。npm run sim:voices → npm run seed で模擬データを入れられます。</p>
      ) : (
        <>
          <VoicesChart series={v.series} voices={v.voices} period={v.period} />
          <VoiceCommentPanel latest={v.latestComment} />
        </>
      )}
    </main>
  );
}
