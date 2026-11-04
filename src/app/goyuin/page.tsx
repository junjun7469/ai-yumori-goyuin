import { GachaClient } from "@/components/goyuin/GachaClient";
import { listAreas } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** G1 ガチャ */
export default function GachaPage() {
  return <GachaClient total={listAreas().length} />;
}
