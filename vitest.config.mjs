import path from "node:path";
import { defineConfig } from "vitest/config";

// tsconfig の paths（@/ → src/）をテストでも使えるようにする
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
