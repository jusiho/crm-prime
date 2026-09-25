"use client";

import { useEffect, useState } from "react";
import { NavIcon } from "./NavIcons";

/**
 * Hamburguesa que abre el menú lateral en pantallas estrechas. El estado va
 * en una clase del body para que el menú (que pinta el servidor) no tenga
 * que saber nada: ver .side-nav en globals.css.
 */
export function MobileMenuButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  // Si el menú se cierra desde un enlace (quita la clase), el botón se entera.
  useEffect(() => {
    const obs = new MutationObserver(() => setOpen(document.body.classList.contains("nav-open")));
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <button
        type="button"
        className="icon-btn mobile-menu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú"
        aria-expanded={open}
      >
        <NavIcon name={open ? "x" : "filter"} size={18} />
      </button>
      {open && <div className="mobile-nav-backdrop" onClick={() => setOpen(false)} />}
    </>
  );
}
