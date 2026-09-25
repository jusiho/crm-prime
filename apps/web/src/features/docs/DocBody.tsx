"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";

/** Id de ancla a partir del texto de un título ("Copilot y Autopilot" → "copilot-y-autopilot"). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function textOf(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (children && typeof children === "object" && "props" in children) {
    return textOf((children as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

/** Markdown de la documentación con anclas en los títulos y enlaces externos en pestaña nueva. */
export function DocBody({ markdown }: { markdown: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1>{children}</h1>,
        h2: ({ children }) => {
          const id = slugify(textOf(children));
          return (
            <h2 id={id}>
              <a href={`#${id}`} className="docs-anchor">
                {children}
              </a>
            </h2>
          );
        },
        h3: ({ children }) => {
          const id = slugify(textOf(children));
          return (
            <h3 id={id}>
              <a href={`#${id}`} className="docs-anchor">
                {children}
              </a>
            </h3>
          );
        },
        a: ({ href, children }) => {
          const external = !!href && /^https?:\/\//.test(href);
          return (
            <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
              {children}
            </a>
          );
        },
        table: ({ children }) => (
          <div className="docs-table">
            <table>{children}</table>
          </div>
        ),
      }}
    >
      {markdown}
    </Markdown>
  );
}
