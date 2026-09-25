import Link from "next/link";
import { docGroups } from "@/features/docs/registry";

export const dynamic = "force-static";

/** Portada de la documentación: todas las guías, por grupo. */
export default function DocsIndexPage() {
  return (
    <article className="docs-article">
      <h1>Documentación</h1>
      <p className="docs-lede">
        Todo lo que necesitas para vender por WhatsApp con Trimmo: desde conectar
        tu número hasta integrar el CRM con tu sistema.
      </p>
      {docGroups().map((g) => (
        <section key={g.group} className="docs-index__group">
          <h2>{g.group}</h2>
          <div className="docs-index__grid">
            {g.items.map((d) => (
              <Link key={d.slug} href={`/docs/${d.slug}`} className="docs-card">
                <strong>{d.title}</strong>
                <span>{d.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
