import { notFound } from "next/navigation";
import { DetailClient } from "@/components/goyuin/DetailClient";
import { getPrefecture } from "@/lib/goyuinData";
import { regionOf } from "@/lib/regions";

export const dynamic = "force-dynamic";

/** G3 御湯印の詳細。サーバーが画面に渡すのは都道府県だけ。所持していれば中身は API から届く */
export default async function DetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const prefecture = /^\d{2}$/.test(code) ? getPrefecture(code) : null;
  if (!prefecture) notFound();
  return <DetailClient code={code} prefecture={prefecture} regionLabel={regionOf(prefecture)?.label ?? ""} />;
}
