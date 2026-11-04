import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("parseInline", () => {
  it("太字を分ける。閉じていない ** は文字のまま", () => {
    expect(parseInline("前 **太** 後")).toEqual([{ text: "前 ", bold: false }, { text: "太", bold: true }, { text: " 後", bold: false }]);
    expect(parseInline("**未完")).toEqual([{ text: "**未完", bold: false }]);
  });
});

describe("parseMarkdown", () => {
  it("見出し・段落・箇条書き（入れ子1段）・番号つき・区切り線・引用", () => {
    const b = parseMarkdown("## 見出し\n\n本文 **強調**\n続き\n\n- 一つ目\n  - 入れ子\n- 二つ目\n\n1. 手順1\n2. 手順2\n\n---\n\n> 注記");
    expect(b.map((x) => x.type)).toEqual(["heading", "paragraph", "list", "list", "hr", "quote"]);
    const ul = b[2] as Extract<(typeof b)[number], { type: "list" }>;
    expect(ul.ordered).toBe(false);
    expect(ul.items).toHaveLength(2);
    expect(ul.items[0].children).toHaveLength(1);
    const ol = b[3] as Extract<(typeof b)[number], { type: "list" }>;
    expect(ol.ordered).toBe(true);
    expect(ol.items).toHaveLength(2);
    // 段落の改行は1つの段落にまとまる
    expect((b[1] as { inline: { text: string }[] }).inline.map((i) => i.text).join("")).toBe("本文 強調続き".replace("強調続き", "強調 続き"));
  });
  it("HTML タグは解釈せず文字のまま（画面では React のテキストとして描かれる）", () => {
    const b = parseMarkdown("<script>alert(1)</script>");
    expect(b).toHaveLength(1);
    expect(b[0].type).toBe("paragraph");
    expect((b[0] as { inline: { text: string }[] }).inline[0].text).toBe("<script>alert(1)</script>");
  });
  it("空の入力は空", () => {
    expect(parseMarkdown("")).toEqual([]);
  });
});
