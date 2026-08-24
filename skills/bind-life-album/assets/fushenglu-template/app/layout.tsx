import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "浮生录｜人生票根藏本",
  description: "一本悬于云海仙阁之上的人生票根收藏册，循往昔而行，向未来而去。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
