import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "투자 대시보드",
  description: "미국채 10년물, 브렌트유, 달러지수, 코스피, BTC, 미국 지표, 연준 발언, 금리일정을 한눈에",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
