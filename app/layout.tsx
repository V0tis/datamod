import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { PageTransition } from "@/components/common/PageTransition";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorToastProvider } from "@/components/error-toast-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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
        className={`${inter.variable} font-sans antialiased text-foreground bg-background dark:bg-[#15171a] dark:text-[#e1e3e6] transition-colors duration-300`}
      >
        <ThemeProvider>
          <AuthProvider>
            <Sidebar />
            <main className="min-h-screen bg-[#F8F9FA] dark:bg-[#15171a] pl-0 lg:pl-[240px] overflow-auto transition-[padding] transition-colors duration-300">
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
