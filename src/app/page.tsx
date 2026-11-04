import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">AI湯守 × 御湯印</h1>
      <ul className="space-y-3">
        <li>
          <Link className="text-sky-700 underline" href="/dashboard/log">
            湯日誌を入力する（AI湯守）
          </Link>
        </li>
        <li>
          <Link className="text-sky-700 underline" href="/goyuin">
            御湯印ガチャ（1日1回・無料）
          </Link>
          <span className="mx-2 text-stone-400">／</span>
          <Link className="text-sky-700 underline" href="/goyuin/zukan">図鑑</Link>
        </li>
      </ul>
    </main>
  );
}
