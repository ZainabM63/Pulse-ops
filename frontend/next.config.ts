import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // <-- Tells Next.js to build static HTML/CSS/JS into the /out folder
  images: {
    unoptimized: true, // <-- Required for static export
  },
};

export default nextConfig;
