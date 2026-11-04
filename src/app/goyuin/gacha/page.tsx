import { GachaClient } from "@/components/goyuin/GachaClient";
import { listAreas } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** G1 ランダムガチャ（構想として残している）。下タブからは外した。取得の本筋は、現地でQRを読む /visit/[code] */
export default function GachaPage() {
  return (
    <>
      <p className="mx-4 mt-4 rounded-sm border border-amber-400 bg-amber-100 px-3 py-2 text-xs leading-relaxed text-amber-900">
        これは構想として残している「ランダムガチャ」です。御湯印図鑑の本筋は、温泉地でQRを読んで取得する形です。
      </p>
      <GachaClient total={listAreas().length} />
    </>
  );
}
