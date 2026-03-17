import type { Metadata } from "next";
import "@fontsource/pretendard";
import "./globals.css";
import { AuthProvider } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { ErrorToastProvider } from "@/components/error-toast-provider";
import { ApiKeyValidationProvider } from "@/components/api-key-validation-provider";
import { RootErrorBoundary } from "@/components/root-error-boundary";

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
      <head>
        {/* 한글 포함 Pretendard (npm 패키지는 latin만 포함) */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="font-sans antialiased text-foreground bg-background transition-colors duration-300">
        <ThemeProvider>
          <AuthProvider>
            <RootErrorBoundary>
              <AppShell>{children}</AppShell>
              <ErrorToastProvider />
              <ApiKeyValidationProvider />
            </RootErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
