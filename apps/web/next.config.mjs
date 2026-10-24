/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.TASKFORGE_E2E === "1" ? ".next-e2e" : ".next",
};
export default nextConfig;
