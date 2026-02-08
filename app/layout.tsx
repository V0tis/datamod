import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers";
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
    <html lang="ko">
      <body
        className={`${inter.variable} font-sans antialiased text-foreground`}
      >
        <AuthProvider>
          <Sidebar />
          <main className="min-h-screen bg-[#F8F9FA] pl-0 lg:pl-[240px] overflow-auto transition-[padding]">
            <ErrorBoundary>
              <PageTransition>{children}</PageTransition>
            </ErrorBoundary>
          </main>
          <ErrorToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
