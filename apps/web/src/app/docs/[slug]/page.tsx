import Link from "next/link";
import { notFound } from "next/navigation";
import { DOCS, findDoc, readDoc } from "@/features/docs/registry";
import { DocBody } from "@/features/docs/DocBody";

// Se prerenderizan todas en el build (el Markdown se lee entonces); una ruta
// desconocida es un 404, no una lectura en caliente.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = findDoc(slug);
  return doc ? { title: doc.title, description: doc.summary } : {};
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = findDoc(slug);
  if (!doc) notFound();
  const markdown = readDoc(doc);
  const i = DOCS.findIndex((d) => d.slug === slug);
  const prev = i > 0 ? DOCS[i - 1] : null;
  const next = i < DOCS.length - 1 ? DOCS[i + 1] : null;

  return (
    <article className="docs-article">
      <div className="docs-crumb">{doc.group}</div>
      <DocBody markdown={markdown} />
      <nav className="docs-pager">
        {prev ? (
          <Link href={`/docs/${prev.slug}`} className="docs-pager__link">
            <span>Anterior</span>
            <strong>← {prev.title}</strong>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/docs/${next.slug}`} className="docs-pager__link docs-pager__link--next">
            <span>Siguiente</span>
            <strong>{next.title} →</strong>
          </Link>
        )}
      </nav>
    </article>
  );
}
