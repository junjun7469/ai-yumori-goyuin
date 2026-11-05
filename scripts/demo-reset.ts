// npm run demo-reset ：取得記録（と思い出の写真）だけ全削除する
import { runMigrations } from "../src/db/migrate";
import { demoReset } from "../src/lib/demoSeed";

runMigrations();
console.log(`取得記録 ${demoReset()} 件を削除しました`);
