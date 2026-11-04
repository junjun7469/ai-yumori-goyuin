import { NextResponse } from "next/server";
import { listAreas } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** 47温泉地の一覧 */
export function GET() {
  return NextResponse.json({ areas: listAreas() });
}
