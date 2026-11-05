// 御湯印図鑑の下タブ4つと、画面ごとのタブ色の決め方（retro テーマの見出し帯・罫線・選択色に使う）
export const TAB_IDS = ["zukan", "qr", "yunoko", "today", "me"] as const;
export type TabId = (typeof TAB_IDS)[number];

export const TAB_LABEL: Record<TabId, string> = { zukan: "図鑑", qr: "QR", yunoko: "湯の子", today: "今日の湯", me: "わたし" };

/** URL の道筋から、いまの画面がどのタブの色か。図鑑・ガチャ・詳細は図鑑、QR着地は QR */
export function tabOf(pathname: string): TabId {
  if (pathname.startsWith("/goyuin/qr") || pathname.startsWith("/visit/")) return "qr";
  if (pathname.startsWith("/goyuin/yunoko")) return "yunoko";
  if (pathname.startsWith("/goyuin/today")) return "today";
  if (pathname.startsWith("/goyuin/me")) return "me";
  return "zukan";
}

/** 画面上部の見出し帯に出す言葉 */
export function bandLabel(pathname: string): string {
  if (pathname.startsWith("/visit/")) return "QR　到着";
  if (pathname.startsWith("/goyuin/gacha")) return "図鑑　ガチャ（構想）";
  if (/^\/goyuin\/\d{2}$/.test(pathname)) return "図鑑　くわしく";
  return { zukan: "図鑑", qr: "QR読み取り", yunoko: "湯の子", today: "今日の湯", me: "わたし" }[tabOf(pathname)];
}
