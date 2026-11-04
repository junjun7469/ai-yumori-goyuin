// 引き継ぎメモ用の小さな Markdown パーサ。見出し(##/###)・箇条書き(入れ子1段)・番号つき箇条書き・段落・区切り線・引用・太字だけ対応。
// HTML は通さない（画面側で React の文字として描くので、タグはそのまま文字になる）。

export type Inline = { text: string; bold: boolean };
export type Block =
  | { type: "heading"; level: 2 | 3; inline: Inline[] }
  | { type: "list"; ordered: boolean; items: { inline: Inline[]; children: { inline: Inline[] }[] }[] }
  | { type: "paragraph"; inline: Inline[] }
  | { type: "quote"; inline: Inline[] }
  | { type: "hr" };

/** **太字** を分ける（閉じていない ** は文字のまま） */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out.length ? out : [{ text: "", bold: false }];
}

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", inline: parseInline(para.join(" ")) });
    para = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") { flush(); continue; }

    const h = /^(#{2,3})\s+(.+)$/.exec(line);
    if (h) { flush(); blocks.push({ type: "heading", level: h[1].length as 2 | 3, inline: parseInline(h[2]) }); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flush(); blocks.push({ type: "hr" }); continue; }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) { flush(); blocks.push({ type: "quote", inline: parseInline(q[1]) }); continue; }

    const li = /^(\s*)([-*]|\d+[.)])\s+(.+)$/.exec(line);
    if (li) {
      flush();
      const nested = li[1].length >= 2;
      const ordered = /\d/.test(li[2]);
      const last = blocks[blocks.length - 1];
      if (nested && last?.type === "list" && last.items.length) {
        last.items[last.items.length - 1].children.push({ inline: parseInline(li[3]) });
      } else if (last?.type === "list" && last.ordered === ordered && !nested) {
        last.items.push({ inline: parseInline(li[3]), children: [] });
      } else {
        blocks.push({ type: "list", ordered, items: [{ inline: parseInline(li[3]), children: [] }] });
      }
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}
