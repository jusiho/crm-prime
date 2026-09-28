"use client";

import Link from "next/link";
import { NavIcon } from "@/components/NavIcons";
import { useT } from "@/i18n/I18nProvider";
import { ProgressRing } from "./ProgressRing";
import { useOnboarding } from "./useOnboarding";

/**
 * Tarjeta de Primeros pasos en el menú lateral. Solo la ven los
 * administradores (la configuración es cosa suya) y desaparece cuando la
 * empresa la oculta desde la propia página.
 */
export function OnboardingNavCard({ collapsed, active }: { collapsed: boolean; active: boolean }) {
  const t = useT();
  const { data } = useOnboarding();
  if (!data || data.dismissedAt) return null;

  const complete = data.done >= data.total;
  const pct = data.total ? data.done / data.total : 0;
  const pending = data.total - data.done;
  const title = complete ? t("onboarding.navDone") : t("onboarding.navTitle");
  const sub = complete
    ? t("onboarding.navSummary")
    : pending === 1
      ? t("onboarding.navPendingOne")
      : t("onboarding.navPending", { n: pending });

  return (
    <Link
      href="/getting-started"
      className={`nav-card${active ? " active" : ""}${complete ? " is-complete" : ""}${collapsed ? " is-collapsed" : ""}`}
      title={collapsed ? `${title} · ${data.done}/${data.total}` : undefined}
      aria-label={`${title}: ${sub}`}
      data-tour="onboarding-card"
      onClick={() => document.body.classList.remove("nav-open")}
    >
      <ProgressRing pct={pct} size={collapsed ? 30 : 34} stroke={3}>
        {complete ? (
          <span style={{ color: "var(--positive)", display: "flex" }}>
            <NavIcon name="check" size={13} />
          </span>
        ) : (
          <span className="nav-card__num">{data.done}</span>
        )}
      </ProgressRing>
      {!collapsed && (
        <span className="nav-card__text">
          <strong>{title}</strong>
          <span>{sub}</span>
          {!complete && (
            <span className="nav-card__bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${pct})` }} />
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
