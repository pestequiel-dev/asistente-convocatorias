import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Nav, BrandMark } from "@/components/nav";
import { FontScale } from "@/components/font-scale";
import { QuickAdd } from "@/components/quick-add";

export const metadata: Metadata = {
  title: "Convocatorias · Mehmiro",
  description: "Panel de convocatorias, aceleradoras y premios para Mehmiro",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var f=localStorage.getItem('fs');if(f)document.documentElement.style.setProperty('--fs',f);}catch(e){}",
          }}
        />
        <div className="shell">
          <aside className="sidebar">
            <Link href="/" className="brand">
              <BrandMark />
              <div>
                <div className="brand-name">Convocatorias</div>
                <div className="brand-sub">Mehmiro</div>
              </div>
            </Link>
            <Nav />
            <FontScale />
            <div className="sidebar-foot">
              Cada dato del panel viene con su cita y su fuente.
              <br />
              <Link href="/ajustes" style={{ color: "var(--accent)", fontWeight: 500 }}>
                Conectar DeepSeek →
              </Link>
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
        <QuickAdd />
      </body>
    </html>
  );
}
