import type { Metadata } from "next";
import { Noto_Sans, Noto_Serif } from "next/font/google";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { SettingsHydrator } from "@/components/shared/settings-hydrator";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/constants";
import "./globals.css";

// Pretendard 에는 빠알리 글자(ā ṃ ṭ …)가 없다. 빠알리 본문과, 다른 글 속의 빠진 글자를 이 글꼴로 채운다.
const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-noto-sans",
  display: "swap",
});

// 빠알리 원문은 명조로 — 경전다운 느낌 (2026-11-13 디자인)
const notoSerif = Noto_Serif({
  subsets: ["latin", "latin-ext"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: SERVICE_NAME,
    template: `%s | ${SERVICE_NAME}`,
  },
  description: `${SERVICE_TAGLINE} — 빠알리 원문과 여러 번역을 문장마다 나란히 놓고 읽습니다.`,
  // 시험 사이트는 검색 엔진에 나오지 않게 한다. 사이트를 올리는 곳에서 NEXT_PUBLIC_NOINDEX=1 로 켠다.
  ...(process.env.NEXT_PUBLIC_NOINDEX === "1" ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning className={`h-full ${notoSans.variable} ${notoSerif.variable}`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider>
            <div className="flex w-full flex-1">
              <Sidebar />
              <main className="w-full min-w-0 flex-1 pb-24 lg:pb-10 print:p-0">{children}</main>
            </div>
            <BottomTabBar />
          </TooltipProvider>
          <Toaster position="top-center" />
          <SettingsHydrator />
        </ThemeProvider>
      </body>
    </html>
  );
}
