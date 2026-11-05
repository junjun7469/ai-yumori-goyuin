// npm run demo-seed [user_key] ：撮影用に、取得記録を消して6温泉地を所持にする
import { runMigrations } from "../src/db/migrate";
import { demoSeed, latestUserKey } from "../src/lib/demoSeed";

runMigrations();
const key = process.argv[2] ?? latestUserKey();
if (!key) {
  console.error("user_key が分かりません。ブラウザの localStorage の yumori_user_key を引数に渡してください：npm run demo-seed -- <user_key>");
  process.exit(1);
}
const r = demoSeed(key);
console.log(`取得記録 ${r.removed} 件を消し、${r.owned} 温泉地（記録 ${r.added} 件）を所持にしました（user_key: ${key}）`);
console.log("湯の子：杖立に2回通った湯の精（2/3）と、なりかわり済みの蔵王を入れました。/visit/43 を取ると、3回目でなりかわります。");
console.log("杖立の「今日の湯」は npm run sim の日誌が元です。写真は public/memories/43/ に置くと杖立のカードに出ます。");
