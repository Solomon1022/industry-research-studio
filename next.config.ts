import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本应用为本地优先（IndexedDB）的纯客户端应用，无需服务端缓存组件与预渲染
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
