import { parseMarkdown, type Inline } from "@/lib/markdown";

const inline = (xs: Inline[]) => xs.map((x, i) => (x.bold ? <strong key={i}>{x.text}</strong> : <span key={i}>{x.text}</span>));

/** parseMarkdown の結果を React の要素で描く。文字はすべてテキストとして出るので、タグは実行されない */
export function Markdown({ md }: { md: string }) {
  const blocks = parseMarkdown(md);
  return (
    <div className="space-y-3 text-sm leading-7 text-stone-800">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return b.level === 2
              ? <h2 key={i} className="mt-6 border-b border-stone-300 pb-1 text-lg font-bold text-stone-900">{inline(b.inline)}</h2>
              : <h3 key={i} className="mt-4 text-base font-bold text-stone-900">{inline(b.inline)}</h3>;
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={`space-y-1 pl-6 ${b.ordered ? "list-decimal" : "list-disc"}`}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    {inline(it.inline)}
                    {it.children.length > 0 && (
                      <ul className="mt-1 list-[circle] space-y-1 pl-5">{it.children.map((c, k) => <li key={k}>{inline(c.inline)}</li>)}</ul>
                    )}
                  </li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return <blockquote key={i} className="border-l-4 border-stone-300 pl-3 text-xs text-stone-600">{inline(b.inline)}</blockquote>;
          case "hr":
            return <hr key={i} className="border-stone-300" />;
          default:
            return <p key={i}>{inline(b.inline)}</p>;
        }
      })}
    </div>
  );
}
