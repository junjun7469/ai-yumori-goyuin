// 設備メンテナンス記録フォームの検証（クライアント・API で共通）
export const MAINTENANCE_LABEL = {
  pipe_cleaning: "引湯管の清掃",
  tank_cleaning: "貯湯槽の清掃",
  inspection: "点検",
  repair: "修理",
  other: "その他",
} as const;
export type MaintenanceType = keyof typeof MAINTENANCE_LABEL;

export type MaintenanceInput = { eventType: MaintenanceType; eventDate: string; vendor: string; note: string };

/** today は YYYY-MM-DD（日本時間）。未来日は弾く */
export function parseMaintenanceInput(body: unknown, today: string):
  { ok: true; value: MaintenanceInput } | { ok: false; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof b.eventType !== "string" || !(b.eventType in MAINTENANCE_LABEL)) errors.push("種別を選んでください");
  const date = typeof b.eventDate === "string" ? b.eventDate : "";
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!valid) errors.push("日付を入力してください");
  else if (date > today) errors.push("日付が未来になっています");
  const vendor = typeof b.vendor === "string" ? b.vendor.trim() : "";
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (vendor.length > 100) errors.push("業者は 100 文字以内にしてください");
  if (note.length > 300) errors.push("メモは 300 文字以内にしてください");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { eventType: b.eventType as MaintenanceType, eventDate: date, vendor, note } };
}
