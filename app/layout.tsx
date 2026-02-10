import type { Metadata } from "next";
import "@fontsource/pretendard";
import "./globals.css";
import { AuthProvider } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { PageTransition } from "@/components/common/PageTransition";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorToastProvider } from "@/components/error-toast-provider";

export const metadata: Metadata = {
  title: "Rin-AI",
  description: "이메일 인증 기반 시장 리서치",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className="font-sans antialiased text-foreground bg-background dark:bg-[#0f1113] dark:text-[#e1e3e6] transition-colors duration-300"
      >
        <ThemeProvider>
          <AuthProvider>
            <Sidebar />
            <main className="min-h-screen bg-[#F8F9FA] dark:bg-[#0f1113] pl-0 lg:pl-[240px] overflow-auto transition-[padding] transition-colors duration-300">
              <ErrorBoundary>
                <PageTransition>{children}</PageTransition>
              </ErrorBoundary>
            </main>
            <ErrorToastProvider />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
