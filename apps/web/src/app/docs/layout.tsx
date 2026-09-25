import Link from "next/link";
import { docGroups } from "@/features/docs/registry";
import { DocsNav } from "./DocsNav";
import "./docs.css";

export const metadata = {
  title: { default: "Documentación — Trimmo", template: "%s — Documentación Trimmo" },
  description: "Guías de Trimmo: conectar WhatsApp, agentes de IA, flujos, embudos, API pública y webhooks.",
};

/**
 * Documentación pública: sin sesión, en el dominio raíz. Barra superior con
 * el acceso, índice lateral por grupos y el contenido en Markdown.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const groups = docGroups();
  return (
    <div className="docs">
      <header className="docs-top">
        <div className="docs-top__inner">
          <Link href="/" className="docs-brand">
            Trimmo
          </Link>
          <span className="docs-top__sep">/</span>
          <Link href="/docs" className="docs-top__title">
            Documentación
          </Link>
          <span style={{ flex: 1 }} />
          <a
            href="https://github.com/jusiho/crm-prime"
            target="_blank"
            rel="noopener noreferrer"
            className="docs-top__link"
          >
            GitHub
          </a>
          <Link href="/login" className="docs-top__link">
            Iniciar sesión
          </Link>
          <Link href="/register" className="btn btn-primary btn-sm">
            Empezar gratis
          </Link>
        </div>
      </header>

      <div className="docs-body">
        <DocsNav groups={groups} />
        <main className="docs-main">{children}</main>
      </div>
    </div>
  );
}
