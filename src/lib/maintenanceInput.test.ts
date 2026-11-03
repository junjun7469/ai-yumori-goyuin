import { describe, expect, it } from "vitest";
import { parseMaintenanceInput } from "./maintenanceInput";

const today = "2026-11-03";
const ok = { eventType: "pipe_cleaning", eventDate: "2026-08-01", vendor: "〇〇設備", note: "" };

describe("parseMaintenanceInput", () => {
  it("種別・日付があれば受け付ける（業者・メモは空でもよい）", () => {
    expect(parseMaintenanceInput(ok, today).ok).toBe(true);
    expect(parseMaintenanceInput({ eventType: "repair", eventDate: today }, today).ok).toBe(true);
  });
  it("種別なし・日付の形式違い・存在しない日付・未来日を弾く", () => {
    expect(parseMaintenanceInput({ ...ok, eventType: "x" }, today).ok).toBe(false);
    expect(parseMaintenanceInput({ ...ok, eventDate: "2026/08/01" }, today).ok).toBe(false);
    expect(parseMaintenanceInput({ ...ok, eventDate: "2026-02-31" }, today).ok).toBe(false);
    expect(parseMaintenanceInput({ ...ok, eventDate: "2026-11-04" }, today).ok).toBe(false);
  });
});
