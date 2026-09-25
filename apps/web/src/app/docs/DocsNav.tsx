"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { DocEntry } from "@/features/docs/registry";

/** Índice lateral. En móvil se pliega en un botón. */
export function DocsNav({ groups }: { groups: { group: string; items: DocEntry[] }[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((g) => g.items).find((d) => pathname === `/docs/${d.slug}`);

  return (
    <aside className="docs-nav" data-open={open}>
      <button className="docs-nav__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{current ? current.title : "Índice"}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      <nav className="docs-nav__list">
        {groups.map((g) => (
          <div key={g.group} className="docs-nav__group">
            <div className="docs-nav__label">{g.group}</div>
            {g.items.map((d) => {
              const active = pathname === `/docs/${d.slug}`;
              return (
                <Link
                  key={d.slug}
                  href={`/docs/${d.slug}`}
                  className={`docs-nav__item${active ? " is-active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  {d.title}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
