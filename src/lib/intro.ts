// 起動演出を出すかどうか（localStorage の読み書きは画面側。ここは判定だけ）
export const INTRO_SEEN_KEY = "goyuin_intro_seen";

/** 初めてのとき、または URL に ?intro=1 があるとき（撮影用）だけ出す */
export function shouldShowIntro(search: string, seen: boolean): boolean {
  return new URLSearchParams(search).get("intro") === "1" || !seen;
}

export const INTRO_TITLE = "御湯印図鑑";
export const CHAR_INTERVAL_MS = 250;
/** 画面が点灯してから最初の1文字が出るまで */
export const LIGHT_UP_MS = 700;

/** 演出の各場面が始まる時刻（ms）。文字 → 湯けむり → 「はじめる」の順 */
export function introTimeline(titleLength = INTRO_TITLE.length) {
  const charsDone = LIGHT_UP_MS + CHAR_INTERVAL_MS * titleLength;
  return { charAt: (i: number) => LIGHT_UP_MS + CHAR_INTERVAL_MS * i, smokeAt: charsDone + 200, startAt: charsDone + 1400 };
}
