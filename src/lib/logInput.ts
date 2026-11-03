// 湯日誌フォーム入力の検証（クライアント・API で共通）
export const POINTS = { source: "湯口（源泉）", bath: "浴槽" } as const;
export const FLOW = { more: "多め", normal: "いつも通り", less: "少なめ" } as const;
export const CLARITY = { clear: "透明", slightly_cloudy: "やや濁り", cloudy: "濁り" } as const;
export const SMELL = { normal: "いつも通り", stronger: "やや強い", different: "いつもと違う" } as const;
export const WEATHER = { sunny: "晴れ", rain: "雨", heavy_rain: "大雨", snow: "雪" } as const;

export type LogInput = {
  tempC: number | null;
  point: keyof typeof POINTS;
  flowLevel: keyof typeof FLOW;
  clarity: keyof typeof CLARITY;
  smell: keyof typeof SMELL;
  actions: string;
  note: string;
  weather: keyof typeof WEATHER | null;
  loggedAt: Date;
};

const oneOf = <T extends string>(v: unknown, map: Record<T, string>): v is T =>
  typeof v === "string" && v in map;

export function parseLogInput(body: unknown, now = new Date()):
  { ok: true; value: LogInput } | { ok: false; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  let tempC: number | null = null;
  if (b.tempC !== null && b.tempC !== undefined && b.tempC !== "") {
    const n = Number(b.tempC);
    if (!Number.isFinite(n) || n < 0 || n > 110) errors.push("温度は 0〜110 の数字で入力してください");
    else tempC = n;
  }
  if (!oneOf(b.point, POINTS)) errors.push("測った場所を選んでください");
  if (!oneOf(b.flowLevel, FLOW)) errors.push("湯量の目安を選んでください");
  if (!oneOf(b.clarity, CLARITY)) errors.push("見た目を選んでください");
  if (!oneOf(b.smell, SMELL)) errors.push("匂いを選んでください");
  const weather = b.weather === null || b.weather === undefined || b.weather === "" ? null : b.weather;
  if (weather !== null && !oneOf(weather, WEATHER)) errors.push("天候の値が正しくありません");

  const actions = typeof b.actions === "string" ? b.actions.trim() : "";
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (actions.length > 300) errors.push("作業内容は 300 文字以内にしてください");
  if (note.length > 300) errors.push("一言メモは 300 文字以内にしてください");

  let loggedAt = now;
  if (typeof b.loggedAt === "string" && b.loggedAt !== "") {
    const d = new Date(b.loggedAt);
    if (Number.isNaN(d.getTime())) errors.push("記録日時が正しくありません");
    else if (d.getTime() > now.getTime() + 5 * 60 * 1000) errors.push("記録日時が未来になっています");
    else loggedAt = d;
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      tempC, point: b.point as LogInput["point"], flowLevel: b.flowLevel as LogInput["flowLevel"],
      clarity: b.clarity as LogInput["clarity"], smell: b.smell as LogInput["smell"],
      actions, note, weather: weather as LogInput["weather"], loggedAt,
    },
  };
}
