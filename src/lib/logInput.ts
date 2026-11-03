// 湯日誌フォーム入力の検証（クライアント・API で共通）
export const CLARITY = { clear: "透明", slightly_cloudy: "やや濁り", cloudy: "濁り" } as const;
export const SMELL = { normal: "いつも通り", stronger: "やや強い", different: "いつもと違う" } as const;
export const WEATHER = { sunny: "晴れ", rain: "雨", heavy_rain: "大雨", snow: "雪" } as const;

// 基準は分析書（2014-02）。画面の入力欄のヒントに使う
export const BASELINE_HINT = { chamberC: 91.5, flowLPerMin: 185.7 } as const;

/** 作業欄に引湯管の清掃が書かれているか。メンテナンス記録への登録を促す判定に使う */
export function mentionsPipeCleaning(actions: string): boolean {
  return actions.includes("引湯管") && /清掃|掃除|洗浄/.test(actions);
}

export type MaintenanceSuggestion = { eventType: "pipe_cleaning"; eventDate: string };

export type LogInput = {
  tempChamberC: number | null;
  tempBathC: number | null;
  flowLPerMin: number | null;
  clarity: keyof typeof CLARITY;
  smell: keyof typeof SMELL;
  actions: string;
  note: string;
  weather: keyof typeof WEATHER | null;
  loggedAt: Date;
};

const oneOf = <T extends string>(v: unknown, map: Record<T, string>): v is T =>
  typeof v === "string" && v in map;

/** 空欄は null。入力があれば min〜max の数字であること */
function optionalNumber(v: unknown, label: string, min: number, max: number, errors: string[]): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n) || n < min || n > max) {
    errors.push(`${label}は ${min}〜${max} の数字で入力してください`);
    return null;
  }
  return n;
}

export function parseLogInput(body: unknown, now = new Date()):
  { ok: true; value: LogInput } | { ok: false; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const tempChamberC = optionalNumber(b.tempChamberC, "チャンバー温度", 0, 110, errors);
  const tempBathC = optionalNumber(b.tempBathC, "浴槽温度", 0, 60, errors);
  const flowLPerMin = optionalNumber(b.flowLPerMin, "湯量", 0, 1000, errors);
  if (!errors.length && tempChamberC === null && tempBathC === null && flowLPerMin === null) {
    errors.push("チャンバー温度・浴槽温度・湯量のどれか1つは入力してください");
  }

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
      tempChamberC, tempBathC, flowLPerMin,
      clarity: b.clarity as LogInput["clarity"], smell: b.smell as LogInput["smell"],
      actions, note, weather: weather as LogInput["weather"], loggedAt,
    },
  };
}
