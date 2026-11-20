import type { Metadata } from "next";
import "./globals.css";
import "./modules.css";
import "./module-extra.css";
import "./theme-light.css";
import "katex/dist/katex.min.css";
import { ThemeProvider } from "@/lib/theme";
import { themeInitScript } from "@/lib/theme-script";

export const metadata: Metadata = {
  title: "TKS Society — Learning workspace",
  description: "A focused learning and experimentation workspace for the TKS ML & AI Society.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
