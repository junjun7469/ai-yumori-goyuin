import { PageTitle, YumoriShell } from "@/components/dashboard/YumoriShell";
import { TrendView } from "@/components/dashboard/TrendView";
import { getTrend } from "@/lib/trendData";

export const dynamic = "force-dynamic";

/** D3 推移と変化検知：直近60日のチャンバー温度・浴槽温度・湯量と、検知（様子見・要確認）の印 */
export default function TrendPage() {
  const trend = getTrend(60);
  return (
    <YumoriShell back wide current="/dashboard/trend">
      {trend ? (
        <TrendView trend={trend} summary={
          <p className="text-sm text-stone-600">
            直近60日　記録 {trend.counts.logs} 件（模擬データ {trend.counts.simulated}・入力した記録 {trend.counts.real}）　
            平常 {trend.counts.normal}・様子見 {trend.counts.watch}・要確認 {trend.counts.check}
            {trend.counts.none > 0 && `・検知なし ${trend.counts.none}`}
          </p>
        } />
      ) : (
        <PageTitle>湯の状態</PageTitle>
      )}
      {!trend && <p className="text-sm text-stone-600">施設が未登録です。npm run seed を実行してください。</p>}

      <p className="text-xs leading-relaxed text-stone-500">
        模擬データは分析書（2014年）を基準に生成したもので、実測値ではありません。検知は AI（Claude）による参考情報で、湯の管理は管理者の判断が前提です。
        点の印は、塗りつぶし＝模擬データ、白抜き＝入力した記録です。
      </p>
    </YumoriShell>
  );
}
