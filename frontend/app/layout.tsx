import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinPath",
  description: "AI 금융 네비게이터 FinPath",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
