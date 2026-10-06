import type { Metadata } from "next";
import Script from "next/script";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PULSE//OPS",
  description: "Enterprise Incident Response Platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-canvas text-fg-primary flex flex-col font-mono" suppressHydrationWarning>
        <Script id="strip-extension-attrs" strategy="beforeInteractive">
          {`(function(){var a=document.querySelectorAll("[bis_skin_checked]");for(var i=0;i<a.length;i++)a[i].removeAttribute("bis_skin_checked");var o=new MutationObserver(function(m){for(var j=0;j<m.length;j++)if(m[j].type==="attributes"&&m[j].attributeName==="bis_skin_checked")m[j].target.removeAttribute("bis_skin_checked")});o.observe(document.documentElement,{attributes:true,subtree:true})})();`}
        </Script>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
