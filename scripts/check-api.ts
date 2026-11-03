// Claude API への接続確認（1回だけ小さく呼ぶ）。キーの中身は表示しない。
//   npm run check:api
import Anthropic from "@anthropic-ai/sdk";
import { DETECTION_MODEL } from "../src/lib/models";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY が読み込めていません（.env を確認してください）");
  process.exit(1);
}

async function main() {
const client = new Anthropic({ maxRetries: 0 });
try {
  const res = await client.messages.create({
    model: DETECTION_MODEL,
    max_tokens: 200,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "接続テストです。「OK」とだけ返してください。" }],
  });
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  console.log("接続OK");
  console.log("モデル:", res.model, "/ stop_reason:", res.stop_reason);
  console.log("返答:", text.slice(0, 40));
  console.log("トークン: 入力", res.usage.input_tokens, "/ 出力", res.usage.output_tokens);
} catch (e) {
  if (e instanceof Anthropic.AuthenticationError) console.error("認証エラー：キーが無効です (401)");
  else if (e instanceof Anthropic.PermissionDeniedError) console.error("権限エラー (403)：", e.message);
  else if (e instanceof Anthropic.RateLimitError) console.error("レート制限 (429)：しばらくして再実行");
  else if (e instanceof Anthropic.APIError) console.error(`API エラー ${e.status}：`, e.message);
  else console.error("通信エラー：", (e as Error).message);
  process.exit(1);
}
}

main();
