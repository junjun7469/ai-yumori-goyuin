import Link from "next/link";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { getTrend } from "@/lib/trendData";

export const dynamic = "force-dynamic";

/** D3 推移と変化検知：直近60日のチャンバー温度・浴槽温度・湯量と、検知（様子見・要確認）の印 */
export default function TrendPage() {
  const trend = getTrend(60);
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 pb-16">
      <header className="space-y-1">
        <Link href="/dashboard" className="text-xs text-sky-700 underline">← ダッシュボード</Link>
        <h1 className="text-xl font-bold">推移と変化検知</h1>
        {trend ? (
          <p className="text-sm text-stone-600">
            丸正旅館・直近60日　記録 {trend.counts.logs} 件（模擬データ {trend.counts.simulated}・入力した記録 {trend.counts.real}）　
            平常 {trend.counts.normal}・様子見 {trend.counts.watch}・要確認 {trend.counts.check}
            {trend.counts.none > 0 && `・検知なし ${trend.counts.none}`}
          </p>
        ) : (
          <p className="text-sm text-stone-600">施設が未登録です。npm run seed を実行してください。</p>
        )}
      </header>

      {trend && trend.points.length > 0 ? (
        <TrendChart trend={trend} />
      ) : trend ? (
        <p className="rounded-lg border bg-white p-4 text-sm text-stone-600">この期間の記録がありません。</p>
      ) : null}

      <p className="text-xs leading-relaxed text-stone-500">
        模擬データは分析書（2014年）を基準に生成したもので、実測値ではありません。検知は AI（Claude）による参考情報で、湯の管理は管理者の判断が前提です。
        点の印は、塗りつぶし＝模擬データ、白抜き＝入力した記録です。
      </p>
    </main>
  );
}
