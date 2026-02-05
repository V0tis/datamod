import type { Metadata } from "next";
import { Nunito, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers";
import { Sidebar } from "@/components/sidebar";
import { PageTransition } from "@/components/common/PageTransition";
import { Toaster } from "sonner";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${nunito.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AuthProvider>
          <Sidebar />
          <main className="min-h-screen bg-background pl-56">
            <PageTransition>{children}</PageTransition>
          </main>
          <Toaster richColors position="bottom-right" closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
