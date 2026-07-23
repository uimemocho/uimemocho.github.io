import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "uimemocho — Tools & Games",
  description:
    "小さなツールとゲームを集めた、個人制作のプレイグラウンド。",
  openGraph: {
    title: "uimemocho — Tools & Games",
    description:
      "小さなツールとゲームを集めた、個人制作のプレイグラウンド。",
    type: "website",
    locale: "ja_JP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
