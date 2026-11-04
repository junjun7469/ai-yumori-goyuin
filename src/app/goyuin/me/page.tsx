import { MeClient } from "@/components/goyuin/MeClient";
import { listAreas } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** わたし：レベルと称号、統計、実績バッジ。サーバーが渡すのは都道府県だけ（地域ごとの合計を数えるため） */
export default function MePage() {
  return <MeClient base={listAreas().map(({ code, prefecture }) => ({ code, prefecture }))} />;
}
