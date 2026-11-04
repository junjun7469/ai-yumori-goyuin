import { ZukanClient } from "@/components/goyuin/ZukanClient";
import { listAreas } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** G2 図鑑 */
export default function ZukanPage() {
  const areas = listAreas().map(({ code, name, prefecture, characterImage, springTypeClass }) => ({
    code, name, prefecture, characterImage, springTypeClass,
  }));
  return <ZukanClient areas={areas} />;
}
