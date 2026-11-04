import { notFound } from "next/navigation";
import { VisitEntry } from "@/components/goyuin/VisitClient";
import { getArea, getFacilityName } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** G5 QR 着地ページ。例：/visit/43 → 杖立・丸正旅館。撮影用に ?reset=1 で端末キーを作り直せる */
export default async function VisitPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const area = /^\d{2}$/.test(code) ? getArea(code) : null;
  if (!area) notFound();
  return <VisitEntry area={area} facility={getFacilityName(code)} />;
}
