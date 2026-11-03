/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 はネイティブモジュールなのでバンドルしない
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
