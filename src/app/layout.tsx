import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { Header } from "@/components/layout/header";
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

export const metadata: Metadata = {
  title: {
    default: SERVICE_NAME,
    template: `%s | ${SERVICE_NAME}`,
  },
  description: `${SERVICE_TAGLINE} — 빠알리 원문과 여러 번역을 문장마다 나란히 놓고 읽습니다.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning className={`h-full ${notoSans.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider>
            <div className="flex min-h-screen w-full">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <Header />
                <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 lg:px-6 print:max-w-none print:p-0">
                  {children}
                </main>
              </div>
            </div>
          </TooltipProvider>
          <Toaster position="top-center" />
          <SettingsHydrator />
        </ThemeProvider>
      </body>
    </html>
  );
}
