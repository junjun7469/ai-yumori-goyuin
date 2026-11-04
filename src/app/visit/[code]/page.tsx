import { notFound } from "next/navigation";
import { VisitEntry } from "@/components/goyuin/VisitClient";
import { getPrefecture } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/**
 * G5 QR 着地ページ。例：/visit/43。着くまで温泉地名・キャラは伏せ、取得した瞬間に初めて見せる。
 * 撮影用に ?reset=1 で端末キーを作り直せる
 */
export default async function VisitPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const prefecture = /^\d{2}$/.test(code) ? getPrefecture(code) : null;
  if (!prefecture) notFound();
  return <VisitEntry code={code} prefecture={prefecture} />;
}
