import { ZukanClient } from "@/components/goyuin/ZukanClient";
import { listAreas } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** 御湯印図鑑：取得した御湯印／御湯印を探す（地図）。サーバーが画面に渡すのは都道府県だけで、名前や絵は所持を確かめた API から届く */
export default function ZukanPage() {
  return <ZukanClient base={listAreas().map(({ code, prefecture }) => ({ code, prefecture }))} />;
}
