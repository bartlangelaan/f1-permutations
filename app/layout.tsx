import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "F1 Championship Permutations",
  description: "Who can still win the F1 championship after any race since 2010?",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-zinc-950 text-zinc-100 min-h-screen">
        <header className="border-b border-zinc-800 px-6 py-4">
          <a href="/" className="text-lg font-bold tracking-tight text-white hover:text-red-400 transition-colors">
            F1 Permutations
          </a>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
