"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FEATURE_LABELS, planWithFeature, type PlanFeature } from "@crm/shared";
import { NavIcon } from "@/components/NavIcons";
import { fetchMyPlan } from "@/lib/bff";

export const MY_PLAN_KEY = ["plan", "me"] as const;

/** El plan de mi empresa: límites, uso y catálogo. En instalación propia, `saas: false`. */
export function useMyPlan() {
  return useQuery({ queryKey: MY_PLAN_KEY, queryFn: fetchMyPlan, staleTime: 60_000 });
}

/**
 * Aviso cuando una característica no está en el plan. No bloquea nada por sí
 * mismo (la API ya lo rechaza): explica el porqué antes de chocar con el error.
 * En instalación propia, o si el plan la incluye, no pinta nada.
 */
export function PlanGate({ feature, children }: { feature: PlanFeature; children?: React.ReactNode }) {
  const { data } = useMyPlan();
  if (!data?.saas || data.plan.features[feature]) return null;
  const needed = planWithFeature(feature);
  return (
    <div className="plan-gate" role="note">
      <span className="plan-gate__icon" aria-hidden="true">
        <NavIcon name="lock" size={15} />
      </span>
      <span className="plan-gate__text">
        <strong>{FEATURE_LABELS[feature]}</strong> no está en tu plan {data.plan.name}.
        {needed ? ` Está disponible a partir del plan ${needed.name}.` : ""}
        {children ? <> {children}</> : null}
      </span>
      <Link href="/settings?tab=plan" className="btn btn-ghost btn-sm">
        Ver planes
      </Link>
    </div>
  );
}
