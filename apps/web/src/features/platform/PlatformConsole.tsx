"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PLANS, PLAN_KEYS, planFor, type PlatformOrg, type UpdatePlatformOrgInput } from "@crm/shared";
import { NavIcon } from "@/components/NavIcons";
import { confirmDialog } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import { fetchPlatformOrgs, fetchPlatformOverview, updatePlatformOrg } from "@/lib/bff";

type SortKey = "created" | "activity" | "messages" | "name";

/**
 * Consola del operador del SaaS: cuántas empresas hay, cuántas se dan de alta,
 * cuáles están vivas, y el plan de cada una. Las cifras vienen agregadas de la
 * API; aquí solo se ordenan y se pintan.
 */
export function PlatformConsole({ myOrgSlug }: { myOrgSlug?: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("created");

  const overview = useQuery({
    queryKey: ["platform", "overview"],
    queryFn: fetchPlatformOverview,
    refetchOnWindowFocus: true,
  });
  const orgs = useQuery({
    queryKey: ["platform", "orgs", search],
    queryFn: () => fetchPlatformOrgs(search),
    placeholderData: keepPreviousData,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlatformOrgInput }) => updatePlatformOrg(id, input),
    onSuccess: (_row, vars) => {
      toast.success(vars.input.plan ? "Plan cambiado" : vars.input.isActive ? "Empresa reactivada" : "Empresa suspendida");
      void queryClient.invalidateQueries({ queryKey: ["platform"] });
    },
  });

  const sorted = useMemo(() => {
    const list = [...(orgs.data ?? [])];
    const by: Record<SortKey, (a: PlatformOrg, b: PlatformOrg) => number> = {
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      activity: (a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
      messages: (a, b) => b.messages30d - a.messages30d,
      name: (a, b) => a.name.localeCompare(b.name, "es"),
    };
    return list.sort(by[sort]);
  }, [orgs.data, sort]);

  const o = overview.data;

  return (
    <div className="pc">
      <section className="pc-kpis" aria-label="Cifras de la plataforma">
        <Kpi label="Empresas" value={o?.orgs} sub={o ? `${o.activeOrgs} activas` : undefined} />
        <Kpi label="Altas en 7 días" value={o?.new7d} sub={o ? `${o.new30d} en 30 días` : undefined} accent />
        <Kpi label="Con actividad" value={o?.orgsActive7d} sub="mensajes esta semana" />
        <Kpi label="Números" value={o?.numbers} sub={o ? `${o.coexistenceNumbers} en coexistencia` : undefined} />
        <Kpi label="Usuarios" value={o?.users} />
        <Kpi label="Mensajes en 7 días" value={o?.messages7d} />
        <Kpi label="Gasto IA del mes" value={o ? money(o.aiCostMonthUsd) : undefined} />
      </section>

      <section className="pc-panel">
        <div className="pc-panel__head">
          <h2>Altas por día</h2>
          <span className="pc-plans">
            {(o?.byPlan ?? []).map((p) => (
              <span key={p.plan} className="pc-chip">
                {planFor(p.plan).name} · {p.count}
              </span>
            ))}
          </span>
        </div>
        <SignupsChart data={o?.signupsByDay ?? []} loading={overview.isPending} />
      </section>

      <section className="pc-panel">
        <div className="pc-panel__head">
          <h2>Empresas</h2>
          <label className="pc-search">
            <NavIcon name="search" size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o subdominio"
              aria-label="Buscar empresas"
            />
          </label>
        </div>

        {orgs.isError && <p style={{ color: "var(--danger)" }}>No se pudieron cargar las empresas.</p>}

        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                <Th onClick={() => setSort("name")} active={sort === "name"}>Empresa</Th>
                <th>Plan</th>
                <th className="num">Equipo</th>
                <th className="num">Números</th>
                <th className="num">Contactos</th>
                <Th onClick={() => setSort("messages")} active={sort === "messages"} num>Mensajes 30 d</Th>
                <Th onClick={() => setSort("activity")} active={sort === "activity"}>Última actividad</Th>
                <th className="num">IA mes</th>
                <th>Config.</th>
                <Th onClick={() => setSort("created")} active={sort === "created"}>Alta</Th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {orgs.isPending &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={11}>
                      <div className="skeleton" style={{ height: 22 }} />
                    </td>
                  </tr>
                ))}
              {sorted.map((org) => {
                const mine = !!myOrgSlug && org.slug === myOrgSlug;
                const busy = update.isPending && update.variables?.id === org.id;
                return (
                  <tr key={org.id} className={org.isActive ? "" : "is-suspended"}>
                    <td>
                      <div className="pc-org">
                        <a href={org.url} target="_blank" rel="noopener noreferrer" className="pc-org__name">
                          {org.name}
                          {mine && <span className="pc-chip pc-chip--mine">tú</span>}
                        </a>
                        <span className="pc-org__meta">
                          {org.slug} · {org.adminEmail ?? "sin administrador"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <select
                        className="pc-select"
                        value={PLAN_KEYS.includes(org.plan as (typeof PLAN_KEYS)[number]) ? org.plan : "free"}
                        disabled={busy}
                        aria-label={`Plan de ${org.name}`}
                        onChange={(e) => update.mutate({ id: org.id, input: { plan: e.target.value as (typeof PLAN_KEYS)[number] } })}
                      >
                        {PLAN_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {PLANS[k].name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">{org.users}</td>
                    <td className="num" title={`${org.coexistenceNumbers} en coexistencia`}>
                      {org.numbers}
                      {org.coexistenceNumbers > 0 && <small> · {org.coexistenceNumbers} coex.</small>}
                    </td>
                    <td className="num">{org.contacts}</td>
                    <td className="num">{org.messages30d}</td>
                    <td title={org.lastMessageAt ?? undefined}>{relative(org.lastMessageAt)}</td>
                    <td className="num">{org.aiCostMonthUsd > 0 ? money(org.aiCostMonthUsd) : "—"}</td>
                    <td>
                      {org.onboardingCompletedAt ? (
                        <span className="pc-ok" title={`Primeros pasos completados el ${date(org.onboardingCompletedAt)}`}>
                          <NavIcon name="check" size={13} /> lista
                        </span>
                      ) : (
                        <span className="pc-muted">en curso</span>
                      )}
                    </td>
                    <td title={org.createdAt}>{date(org.createdAt)}</td>
                    <td>
                      <div className="pc-state">
                        <span className={`pc-badge ${org.isActive ? "is-on" : "is-off"}`}>
                          {org.isActive ? "Activa" : "Suspendida"}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy || mine}
                          title={mine ? "Es tu propia empresa" : org.isActive ? "Suspender: nadie de la empresa podrá entrar" : "Volver a dar acceso"}
                          onClick={() => {
                            if (org.isActive) {
                              void confirmDialog({
                                message: `¿Suspender "${org.name}"? Nadie de la empresa podrá entrar hasta que la reactives. Sus datos no se tocan.`,
                                danger: true,
                              }).then((ok) => ok && update.mutate({ id: org.id, input: { isActive: false } }));
                            } else {
                              update.mutate({ id: org.id, input: { isActive: true } });
                            }
                          }}
                        >
                          {org.isActive ? "Suspender" : "Reactivar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orgs.data && sorted.length === 0 && (
                <tr>
                  <td colSpan={11} className="pc-muted" style={{ textAlign: "center", padding: 24 }}>
                    Ninguna empresa coincide.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value?: number | string; sub?: string; accent?: boolean }) {
  return (
    <div className={`pc-kpi${accent ? " is-accent" : ""}`}>
      <span className="pc-kpi__label">{label}</span>
      {value === undefined ? (
        <span className="skeleton" style={{ height: 28, width: 60, display: "block" }} />
      ) : (
        <span className="pc-kpi__value">{typeof value === "number" ? value.toLocaleString("es") : value}</span>
      )}
      {sub && <span className="pc-kpi__sub">{sub}</span>}
    </div>
  );
}

function Th({ children, onClick, active, num }: { children: React.ReactNode; onClick: () => void; active: boolean; num?: boolean }) {
  return (
    <th className={num ? "num" : undefined} aria-sort={active ? "descending" : "none"}>
      <button type="button" className={`pc-th${active ? " is-active" : ""}`} onClick={onClick}>
        {children}
        {active && <NavIcon name="arrow-down" size={12} />}
      </button>
    </th>
  );
}

/** Treinta días de barras. Los días sin altas también se pintan (a cero). */
function SignupsChart({ data, loading }: { data: { day: string; count: number }[]; loading: boolean }) {
  const days = useMemo(() => {
    const byDay = new Map(data.map((d) => [d.day, d.count]));
    const out: { day: string; count: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key, count: byDay.get(key) ?? 0 });
    }
    return out;
  }, [data]);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((a, d) => a + d.count, 0);

  if (loading) return <div className="skeleton" style={{ height: 120 }} />;
  return (
    <div>
      <div className="pc-chart" role="img" aria-label={`${total} altas en los últimos 30 días`}>
        {days.map((d) => (
          <span
            key={d.day}
            className={`pc-bar${d.count ? " has-value" : ""}`}
            style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
            title={`${date(d.day)}: ${d.count} ${d.count === 1 ? "alta" : "altas"}`}
          />
        ))}
      </div>
      <div className="pc-chart__axis">
        <span>{date(days[0]!.day)}</span>
        <span>{total} altas en 30 días</span>
        <span>hoy</span>
      </div>
    </div>
  );
}

const money = (n: number) => `USD ${n.toFixed(2)}`;
const date = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });

function relative(iso: string | null): string {
  if (!iso) return "nunca";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `hace ${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 60) return `hace ${days} d`;
  return date(iso);
}
