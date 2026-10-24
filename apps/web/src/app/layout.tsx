import "./globals.css";
import type { Metadata } from "next";
import { AppHeader } from "../components/app-header";

export const metadata: Metadata = {
  title: "TaskForge",
  description: "A focused project management workspace for software teams.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="tf-app-shell">
          <AppHeader />
          <div className="tf-app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
