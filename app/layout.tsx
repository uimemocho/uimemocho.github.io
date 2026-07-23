import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
