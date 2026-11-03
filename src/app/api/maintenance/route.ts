import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { parseMaintenanceInput } from "@/lib/maintenanceInput";

export const dynamic = "force-dynamic";

const jstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function maruso() {
  return db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
}

/** 設備メンテナンス記録を保存する（引湯管の清掃など） */
export async function POST(req: Request) {
  const parsed = parseMaintenanceInput(await req.json().catch(() => null), jstToday());
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  const facility = maruso();
  if (!facility) return NextResponse.json({ errors: ["施設が未登録です。npm run seed を実行してください"] }, { status: 500 });
  const v = parsed.value;
  const row = db.insert(schema.maintenanceEvent)
    .values({ facilityId: facility.id, eventType: v.eventType, eventDate: v.eventDate, vendor: v.vendor, note: v.note })
    .returning().get();
  return NextResponse.json({ event: row }, { status: 201 });
}

/** 一覧：GET /api/maintenance */
export function GET() {
  const facility = maruso();
  if (!facility) return NextResponse.json({ events: [] });
  const events = db.select().from(schema.maintenanceEvent)
    .where(eq(schema.maintenanceEvent.facilityId, facility.id))
    .orderBy(desc(schema.maintenanceEvent.eventDate)).all();
  return NextResponse.json({ events });
}
