"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { AiUsagePeriod, AiUsageReport } from "@crm/shared";
import { NavIcon } from "@/components/NavIcons";
import { fetchAiUsage } from "@/lib/bff";

const PERIODS: { key: AiUsagePeriod; label: string }[] = [
  { key: "month", label: "Este mes" },
  { key: "last_month", label: "Mes pasado" },
  { key: "30d", label: "Últimos 30 días" },
];

// Con poco uso los importes son de milésimas: se enseñan con más decimales
// en vez de un "< USD 0,01" que no dice nada.
const usd = (n: number) => {
  if (n === 0) return "USD 0";
  if (n < 0.0001) return "< USD 0,0001";
  const digits = n < 1 ? 4 : 2;
  return `USD ${n.toLocaleString("es", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};
const num = (n: number) => n.toLocaleString("es");
const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("es", { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${(n / 1000).toLocaleString("es", { maximumFractionDigits: 1 })} mil` : num(n);

/**
 * Ajustes › Consumo de IA: cuántos tokens gasta la empresa, en qué y cuánto le
 * cuesta. La IA la paga la empresa a su proveedor con su clave; esto es una
 * estimación con precios de lista para que sepa en qué se le va el dinero.
 */
export function AiUsageSettings() {
  const [period, setPeriod] = useState<AiUsagePeriod>("month");
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["ai-usage", period],
    queryFn: () => fetchAiUsage(period),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="usage">
      <header className="usage__head">
        <div>
          <h3>Consumo de IA</h3>
          <p>
            Tokens y coste estimado de todo lo que hace la IA en tu empresa. Lo pagas directamente a tu proveedor
            con tu clave; Driony no cobra nada por la IA.
          </p>
        </div>
        <div className="seg" role="tablist" aria-label="Periodo">
          {PERIODS.map((p) => (
            <button key={p.key} role="tab" aria-selected={period === p.key} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {isError && (
        <p style={{ color: "var(--danger)" }}>
          No se pudo cargar el consumo.{" "}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refetch()}>
            Reintentar
          </button>
        </p>
      )}
      {isPending && <div className="skeleton" style={{ height: 260, borderRadius: 12 }} />}
      {data && <Report data={data} />}
    </div>
  );
}

function Report({ data }: { data: AiUsageReport }) {
  const { total } = data;
  const tokens = total.inputTokens + total.outputTokens;

  if (total.calls === 0) {
    return (
      <div className="usage__empty">
        <NavIcon name="bolt" size={22} />
        <strong>Sin consumo en este periodo</strong>
        <span>Cuando el agente responda o uses el copiloto, lo verás aquí con su coste.</span>
      </div>
    );
  }

  const maxDay = Math.max(1, ...data.byDay.map((d) => d.tokens));

  return (
    <>
      <section className="usage__kpis">
        <div className="usage__kpi is-main">
          <span>Coste estimado</span>
          <strong>{usd(total.costUsd)}</strong>
          {total.unpriced && <small>Sin contar modelos sin precio conocido</small>}
        </div>
        <div className="usage__kpi">
          <span>Tokens</span>
          <strong>{compact(tokens)}</strong>
          <small>
            {compact(total.inputTokens)} de entrada · {compact(total.outputTokens)} de salida
          </small>
        </div>
        <div className="usage__kpi">
          <span>Llamadas a la IA</span>
          <strong>{num(total.calls)}</strong>
          <small>{total.calls ? `${compact(Math.round(tokens / total.calls))} tokens de media` : ""}</small>
        </div>
      </section>

      <section className="usage__panel">
        <h4>Por día</h4>
        <div className="usage__chart" role="img" aria-label="Tokens por día">
          {data.byDay.map((d) => (
            <span
              key={d.day}
              className={`usage__bar${d.tokens ? " has-value" : ""}`}
              style={{ height: `${Math.max(3, (d.tokens / maxDay) * 100)}%` }}
              title={`${new Date(`${d.day}T12:00:00Z`).toLocaleDateString("es", { day: "numeric", month: "short" })}: ${num(d.tokens)} tokens · ${usd(d.costUsd)}`}
            />
          ))}
        </div>
      </section>

      <div className="usage__grid">
        <section className="usage__panel">
          <h4>En qué se gasta</h4>
          <table className="usage__table">
            <thead>
              <tr>
                <th>Función</th>
                <th className="num">Llamadas</th>
                <th className="num">Tokens</th>
                <th className="num">Coste</th>
              </tr>
            </thead>
            <tbody>
              {data.byFeature.map((f) => (
                <tr key={f.feature}>
                  <td>
                    <span className="usage__label">{f.label}</span>
                    <span className="usage__share">
                      <span style={{ transform: `scaleX(${tokens ? (f.inputTokens + f.outputTokens) / tokens : 0})` }} />
                    </span>
                  </td>
                  <td className="num">{num(f.calls)}</td>
                  <td className="num">{compact(f.inputTokens + f.outputTokens)}</td>
                  <td className="num">{usd(f.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="usage__panel">
          <h4>Por modelo</h4>
          <table className="usage__table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th className="num">Tokens</th>
                <th className="num">Coste</th>
              </tr>
            </thead>
            <tbody>
              {data.byModel.map((m) => (
                <tr key={m.model}>
                  <td>
                    <code>{m.model}</code>
                  </td>
                  <td className="num">{compact(m.inputTokens + m.outputTokens)}</td>
                  <td className="num">{m.priced ? usd(m.costUsd) : <span className="usage__muted">sin precio</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <p className="usage__note">
        Coste estimado con los precios de lista de cada proveedor (revisados en {data.pricesReviewed}). Tu factura
        real está en tu cuenta de OpenAI o Anthropic. Para poner un tope mensual a un agente, ve a{" "}
        <Link href="/agentes">Agentes IA</Link> › Modelo y gasto.
      </p>
    </>
  );
}
