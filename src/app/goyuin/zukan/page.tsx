import { ZukanClient } from "@/components/goyuin/ZukanClient";
import { listAreas } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** G2 図鑑（探す）。サーバーが画面に渡すのは都道府県だけ。名前や絵は、所持を確かめた API から届く */
export default function ZukanPage() {
  return <ZukanClient base={listAreas().map(({ code, prefecture }) => ({ code, prefecture }))} />;
}
