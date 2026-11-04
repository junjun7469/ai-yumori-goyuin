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
            御湯印図鑑（温泉地でQRを読んで集める）
          </Link>
        </li>
      </ul>
    </main>
  );
}
