import Link from "next/link";

export default function DashboardHome() {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-xl font-bold">AI湯守ダッシュボード</h1>
      <ul className="space-y-2 text-sm">
        <li><Link className="text-sky-700 underline" href="/dashboard/log">D2 湯日誌の入力</Link></li>
        <li className="text-stone-400">D1 基準値（分析書）— 準備中</li>
        <li><Link className="text-sky-700 underline" href="/dashboard/trend">D3 推移と変化検知</Link></li>
        <li><Link className="text-sky-700 underline" href="/dashboard/handover">D4 引き継ぎメモ</Link></li>
      </ul>
    </main>
  );
}
