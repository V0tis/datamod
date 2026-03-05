import type { Metadata } from "next";
import "@fontsource/pretendard";
import "./globals.css";
import { AuthProvider } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { ErrorToastProvider } from "@/components/error-toast-provider";
import { ApiKeyValidationProvider } from "@/components/api-key-validation-provider";

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
    <html lang="ko" suppressHydrationWarning className="light">
      <body className="font-sans antialiased text-foreground bg-background transition-colors duration-300">
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
            <ErrorToastProvider />
            <ApiKeyValidationProvider />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
