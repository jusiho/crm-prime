"use client";

import { useState } from "react";
import { NavIcon } from "@/components/NavIcons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  effortValues,
  keywordActions,
  weekday,
  type AgentToolInfo,
  type BotChannelRef,
  type BotDto,
  type BusinessHours,
  type CreateBotInput,
  type KeywordAction,
  type KeywordTrigger,
  type Weekday,
} from "@crm/shared";
import { createBot, updateBot } from "@/lib/bff";
import { box, field, input, label as lbl, primaryBtn, ghostBtn, toggle } from "./styles";

// Modelos agrupados por proveedor. El proveedor activo (OpenAI o Anthropic) se
// decide por la env del backend; aquí eliges el modelo dentro de ese proveedor.
const MODEL_GROUPS: { label: string; models: string[] }[] = [
  {
    label: "OpenAI",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
  },
  {
    label: "Claude (Anthropic)",
    models: [
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ],
  },
];

const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

const ACTION_LABEL: Record<KeywordAction, string> = {
  reply: "Responder texto",
  handoff: "Pasar a humano",
  set_off: "Apagar IA",
};

type Form = {
  name: string;
  model: string;
  effort: string;
  systemPrompt: string;
  enabledTools: string[];
  maxIterations: number;
  monthlyTokenBudget: number;
  isActive: boolean;
  channelId: string | null;
  escalateOnNegativeSentiment: boolean;
  minConfidence: number;
  keywords: string;
  autopilotByDefault: boolean;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  businessHoursEnabled: boolean;
  businessHours: BusinessHours;
  keywordTriggers: KeywordTrigger[];
};

function defaultHours(): BusinessHours {
  return {
    timezone: "America/Lima",
    days: {
      mon: { from: "09:00", to: "18:00" },
      tue: { from: "09:00", to: "18:00" },
      wed: { from: "09:00", to: "18:00" },
      thu: { from: "09:00", to: "18:00" },
      fri: { from: "09:00", to: "18:00" },
      sat: null,
      sun: null,
    },
    outOfHoursMessage:
      "¡Gracias por escribirnos! Ahora estamos fuera de horario, te responderemos pronto.",
  };
}

function toForm(bot: BotDto | null): Form {
  if (!bot) {
    return {
      name: "",
      model: "gpt-4o-mini",
      effort: "medium",
      systemPrompt:
        "Eres un asistente de ventas por WhatsApp. Responde en español, con tono cercano y profesional. Cuando el cliente pregunte por precios, productos o disponibilidad, usa la herramienta de catálogo (search_products) en vez de inventar. Si no tienes la información o el cliente lo amerita, escala a un humano.",
      enabledTools: [
        "search_contact",
        "search_products",
        "search_knowledge",
        "handoff_to_human",
      ],
      maxIterations: 6,
      monthlyTokenBudget: 0,
      isActive: true,
      channelId: null,
      escalateOnNegativeSentiment: true,
      minConfidence: 0.6,
      keywords: "humano, agente, reclamo",
      autopilotByDefault: false,
      welcomeEnabled: false,
      welcomeMessage: "¡Hola! 👋 Gracias por escribirnos. ¿En qué te ayudamos?",
      businessHoursEnabled: false,
      businessHours: defaultHours(),
      keywordTriggers: [],
    };
  }
  return {
    name: bot.name,
    model: bot.model,
    effort: bot.effort,
    systemPrompt: bot.systemPrompt,
    enabledTools: bot.enabledTools,
    maxIterations: bot.maxIterations,
    monthlyTokenBudget: bot.monthlyTokenBudget,
    isActive: bot.isActive,
    channelId: bot.channelId,
    escalateOnNegativeSentiment:
      bot.escalationRules.escalateOnNegativeSentiment ?? false,
    minConfidence: bot.escalationRules.minConfidence ?? 0.6,
    keywords: (bot.escalationRules.keywords ?? []).join(", "),
    autopilotByDefault: bot.autopilotByDefault,
    welcomeEnabled: bot.welcomeEnabled,
    welcomeMessage: bot.welcomeMessage ?? "",
    businessHoursEnabled: bot.businessHoursEnabled,
    businessHours: bot.businessHours ?? defaultHours(),
    keywordTriggers: bot.keywordTriggers,
  };
}

export function BotEditor({
  bot,
  availableTools,
  channels,
  onSaved,
  onCancel,
  onDeleted,
}: {
  bot: BotDto | null; // null = crear nuevo
  availableTools: AgentToolInfo[];
  channels: BotChannelRef[];
  onSaved: (b: BotDto) => void;
  onCancel: () => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => toForm(bot));
  const isNew = !bot;

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const payload: CreateBotInput = {
        name: form.name,
        model: form.model,
        effort: form.effort as CreateBotInput["effort"],
        systemPrompt: form.systemPrompt,
        enabledTools: form.enabledTools,
        maxIterations: Number(form.maxIterations),
        monthlyTokenBudget: Number(form.monthlyTokenBudget),
        isActive: form.isActive,
        channelId: form.channelId,
        autopilotByDefault: form.autopilotByDefault,
        welcomeEnabled: form.welcomeEnabled,
        welcomeMessage: form.welcomeMessage.trim() || null,
        businessHoursEnabled: form.businessHoursEnabled,
        businessHours: form.businessHoursEnabled ? form.businessHours : null,
        keywordTriggers: form.keywordTriggers.filter(
          (t) => t.keywords.length > 0,
        ),
        escalationRules: {
          escalateOnNegativeSentiment: form.escalateOnNegativeSentiment,
          minConfidence: Number(form.minConfidence),
          keywords: form.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        },
      };
      return isNew ? createBot(payload) : updateBot(bot!.id, payload);
    },
    onSuccess: (b) => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      onSaved(b);
    },
  });

  function toggleTool(name: string) {
    set(
      "enabledTools",
      form.enabledTools.includes(name)
        ? form.enabledTools.filter((t) => t !== name)
        : [...form.enabledTools, name],
    );
  }

  // Las 6 secciones no caben de un vistazo en una columna, y la mayoría de
  // ediciones tocan una sola cosa. Agrupadas por intención: quién es el bot,
  // qué sabe hacer, cuándo actúa solo, y cuándo se rinde.
  const [tab, setTab] = useState<
    "general" | "capacidades" | "automatizacion" | "limites"
  >("general");

  const TABS = [
    { id: "general", label: "General", icon: "bot" },
    { id: "capacidades", label: "Capacidades", icon: "bolt" },
    { id: "automatizacion", label: "Automatización", icon: "clock" },
    { id: "limites", label: "Escalado y límites", icon: "alert" },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <nav style={tabBar} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={tabBtn(tab === t.id)}
          >
            <NavIcon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </nav>

      <div style={tabPanel}>
      {tab === "general" && (
      <>
      {/* Identidad */}
      <div style={box}>
        <SectionTitle>Identidad</SectionTitle>
        <div style={field}>
          <span style={lbl}>Nombre del bot</span>
          <input
            style={input}
            value={form.name}
            placeholder="Bot de Ventas"
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div style={field}>
          <span style={lbl}>Número de WhatsApp que atiende</span>
          <select
            style={input}
            value={form.channelId ?? ""}
            onChange={(e) => set("channelId", e.target.value || null)}
          >
            <option value="">Cualquiera (bot por defecto)</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label ?? c.displayPhoneNumber ?? c.id}
              </option>
            ))}
          </select>
        </div>
        <label style={toggle}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set("isActive", e.target.checked)}
          />
          Bot activo
        </label>
      </div>

      {/* Modelo */}
      <div style={box}>
        <SectionTitle>Modelo</SectionTitle>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...field, flex: 1 }}>
            <span style={lbl}>Modelo</span>
            <select
              style={input}
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
            >
              {MODEL_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div style={{ ...field, width: 140 }}>
            <span style={lbl}>Effort</span>
            <select
              style={input}
              value={form.effort}
              onChange={(e) => set("effort", e.target.value)}
            >
              {effortValues.map((ef) => (
                <option key={ef} value={ef}>
                  {ef}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={field}>
          <span style={lbl}>System prompt (personalidad e instrucciones)</span>
          <textarea
            style={{ ...input, minHeight: 150, resize: "vertical", fontFamily: "inherit" }}
            value={form.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
          />
        </div>
      </div>

      </>
      )}

      {tab === "capacidades" && (
      <>
      {/* Herramientas de consulta */}
      <div style={box}>
        <SectionTitle>Qué puede consultar</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {availableTools
            .filter((t) => !t.isAction)
            .map((t) => (
              <ToolRow
                key={t.name}
                tool={t}
                checked={form.enabledTools.includes(t.name)}
                onToggle={() => toggleTool(t.name)}
              />
            ))}
        </div>
      </div>

      {/* Acciones: escriben en el CRM */}
      <div style={box}>
        <SectionTitle>Qué puede hacer en el CRM</SectionTitle>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 10px" }}>
          En autopilot se aplican solas. En copilot quedan pendientes y se
          aplican cuando el agente humano envía la respuesta.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {availableTools
            .filter((t) => t.isAction)
            .map((t) => (
              <ToolRow
                key={t.name}
                tool={t}
                checked={form.enabledTools.includes(t.name)}
                onToggle={() => toggleTool(t.name)}
              />
            ))}
        </div>
      </div>

      </>
      )}

      {tab === "automatizacion" && (
      <>
      {/* Automatización */}
      <div style={box}>
        <SectionTitle>Automatización</SectionTitle>

        <label style={toggle}>
          <input
            type="checkbox"
            checked={form.autopilotByDefault}
            onChange={(e) => set("autopilotByDefault", e.target.checked)}
          />
          <span>
            <strong>Arrancar en autopilot</strong>
            <div style={hint}>
              Las conversaciones nuevas de este número empiezan respondiendo la
              IA sola.
            </div>
          </span>
        </label>

        <div style={divider} />

        <label style={toggle}>
          <input
            type="checkbox"
            checked={form.welcomeEnabled}
            onChange={(e) => set("welcomeEnabled", e.target.checked)}
          />
          <span>
            <strong>Mensaje de bienvenida</strong>
            <div style={hint}>Saludo automático al primer mensaje (sin IA).</div>
          </span>
        </label>
        {form.welcomeEnabled && (
          <textarea
            style={{ ...input, minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
            value={form.welcomeMessage}
            onChange={(e) => set("welcomeMessage", e.target.value)}
            placeholder="¡Hola! Gracias por escribirnos…"
          />
        )}

        <div style={divider} />

        <label style={toggle}>
          <input
            type="checkbox"
            checked={form.businessHoursEnabled}
            onChange={(e) => set("businessHoursEnabled", e.target.checked)}
          />
          <span>
            <strong>Horario de atención</strong>
            <div style={hint}>
              Fuera de horario responde un mensaje y deja la conversación
              pendiente (no activa la IA).
            </div>
          </span>
        </label>
        {form.businessHoursEnabled && (
          <BusinessHoursEditor
            value={form.businessHours}
            onChange={(h) => set("businessHours", h)}
          />
        )}

        <div style={divider} />

        <div>
          <strong style={{ fontSize: 14 }}>Disparadores por palabra clave</strong>
          <div style={hint}>
            Si el mensaje contiene una palabra, ejecuta una acción antes que la
            IA.
          </div>
          <KeywordTriggersEditor
            value={form.keywordTriggers}
            onChange={(t) => set("keywordTriggers", t)}
          />
        </div>
      </div>

      </>
      )}

      {tab === "limites" && (
      <>
      {/* Escalado y límites */}
      <div style={box}>
        <SectionTitle>Escalado y límites</SectionTitle>
        <p style={sectionHint}>
          Cuándo el bot deja de intentarlo y pasa la conversación a una
          persona. Si se cumple cualquiera de estas condiciones, el bot no
          responde y la conversación queda marcada como pendiente.
        </p>
        <label style={toggle}>
          <input
            type="checkbox"
            checked={form.escalateOnNegativeSentiment}
            onChange={(e) =>
              set("escalateOnNegativeSentiment", e.target.checked)
            }
          />
          Escalar si el sentimiento es negativo
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...field, flex: 1 }}>
            <span style={lbl}>Confianza mínima (0–1)</span>
            <span style={fieldHint}>
              Por debajo de este valor, escala. 0 lo desactiva.
            </span>
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              style={input}
              value={form.minConfidence}
              onChange={(e) => set("minConfidence", Number(e.target.value))}
            />
          </div>
          <div style={{ ...field, flex: 1 }}>
            <span style={lbl}>Máx. iteraciones</span>
            <span style={fieldHint}>
              Cuántas veces puede consultar herramientas antes de rendirse.
            </span>
            <input
              type="number"
              min={1}
              max={20}
              style={input}
              value={form.maxIterations}
              onChange={(e) => set("maxIterations", Number(e.target.value))}
            />
          </div>
        </div>
        <div style={field}>
          <span style={lbl}>Palabras de escalado (separadas por coma)</span>
          <input
            style={input}
            value={form.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            placeholder="humano, reclamo, agente"
          />
        </div>
        <div style={field}>
          <span style={lbl}>Presupuesto de tokens / mes (0 = sin límite)</span>
          <span style={fieldHint}>
            Al superarlo, el bot deja de responder hasta el mes siguiente. No
            se llama al modelo, así que el gasto se detiene de verdad.
          </span>
          <input
            type="number"
            min={0}
            style={input}
            value={form.monthlyTokenBudget}
            onChange={(e) => set("monthlyTokenBudget", Number(e.target.value))}
          />
          {!isNew && bot && <BudgetMeter bot={bot} limit={form.monthlyTokenBudget} />}
        </div>
      </div>

      </>
      )}
      </div>

      {/* Acciones: fijas abajo, alcanzables desde cualquier pestaña */}
      <div style={actionBar}>
        {!isNew && onDeleted && !bot?.isDefault && (
          <button onClick={onDeleted} style={{ ...ghostBtn, color: "#e08a8a", borderColor: "#5a2a2a" }}>
            Eliminar
          </button>
        )}
        <div style={{ flex: 1 }} />
        {save.isError && (
          <span style={{ color: "#ff6b6b", fontSize: 13 }}>
            {(save.error as Error).message}
          </span>
        )}
        <button onClick={onCancel} style={ghostBtn}>
          Cancelar
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.name.trim()}
          style={primaryBtn}
        >
          {save.isPending ? "Guardando…" : isNew ? "Crear bot" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function BusinessHoursEditor({
  value,
  onChange,
}: {
  value: BusinessHours;
  onChange: (h: BusinessHours) => void;
}) {
  function setDay(d: Weekday, range: { from: string; to: string } | null) {
    onChange({ ...value, days: { ...value.days, [d]: range } });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
      <div style={field}>
        <span style={lbl}>Zona horaria</span>
        <input
          style={input}
          value={value.timezone}
          onChange={(e) => onChange({ ...value, timezone: e.target.value })}
          placeholder="America/Lima"
        />
      </div>
      {weekday.map((d) => {
        const range = value.days?.[d] ?? null;
        const openDay = !!range;
        return (
          <div key={d} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, width: 120 }}>
              <input
                type="checkbox"
                checked={openDay}
                onChange={(e) =>
                  setDay(d, e.target.checked ? { from: "09:00", to: "18:00" } : null)
                }
              />
              {WEEKDAY_LABEL[d]}
            </label>
            {openDay && range && (
              <>
                <input
                  type="time"
                  style={{ ...input, width: 110 }}
                  value={range.from}
                  onChange={(e) => setDay(d, { ...range, from: e.target.value })}
                />
                <span style={{ color: "var(--muted)" }}>–</span>
                <input
                  type="time"
                  style={{ ...input, width: 110 }}
                  value={range.to}
                  onChange={(e) => setDay(d, { ...range, to: e.target.value })}
                />
              </>
            )}
            {!openDay && (
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Cerrado</span>
            )}
          </div>
        );
      })}
      <div style={field}>
        <span style={lbl}>Mensaje fuera de horario</span>
        <textarea
          style={{ ...input, minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
          value={value.outOfHoursMessage ?? ""}
          onChange={(e) =>
            onChange({ ...value, outOfHoursMessage: e.target.value })
          }
        />
      </div>
    </div>
  );
}

function KeywordTriggersEditor({
  value,
  onChange,
}: {
  value: KeywordTrigger[];
  onChange: (t: KeywordTrigger[]) => void;
}) {
  function update(i: number, patch: Partial<KeywordTrigger>) {
    onChange(value.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
      {value.map((t, i) => (
        <div key={i} style={{ ...box, gap: 8, padding: 12 }}>
          <input
            style={input}
            value={t.keywords.join(", ")}
            placeholder="precio, costo, cuánto cuesta"
            onChange={(e) =>
              update(i, {
                keywords: e.target.value
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean),
              })
            }
          />
          <div style={{ display: "flex", gap: 8 }}>
            <select
              style={{ ...input, flex: 1 }}
              value={t.action}
              onChange={(e) =>
                update(i, { action: e.target.value as KeywordAction })
              }
            >
              {keywordActions.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABEL[a]}
                </option>
              ))}
            </select>
            <button
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              style={{ ...ghostBtn, color: "#e08a8a", borderColor: "#5a2a2a" }}
            >
              ✕
            </button>
          </div>
          {t.action === "reply" && (
            <textarea
              style={{ ...input, minHeight: 50, resize: "vertical", fontFamily: "inherit" }}
              value={t.value ?? ""}
              placeholder="Texto que se responde automáticamente…"
              onChange={(e) => update(i, { value: e.target.value })}
            />
          )}
        </div>
      ))}
      <button
        onClick={() =>
          onChange([...value, { keywords: [], action: "reply", value: "" }])
        }
        style={ghostBtn}
      >
        + Añadir disparador
      </button>
    </div>
  );
}

const tabBar: React.CSSProperties = {
  display: "flex",
  gap: 4,
  padding: "0 0 2px",
  borderBottom: "1px solid var(--border)",
  overflowX: "auto",
};

function tabBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 14px",
    border: "none",
    borderBottom: `2px solid ${active ? "var(--accent, #25d366)" : "transparent"}`,
    background: "transparent",
    color: active ? "var(--text)" : "var(--muted)",
    fontSize: 13.5,
    fontWeight: active ? 600 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "color 150ms, border-color 150ms",
  };
}

const tabPanel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: "16px 0",
};

// Siempre visible: da igual en qué pestaña estés, guardar está a un clic.
const actionBar: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 0",
  borderTop: "1px solid var(--border)",
  background: "var(--bg, #0b0f17)",
};

/** Consumo real del mes frente al presupuesto. Sin esto el número es ciego. */
function BudgetMeter({ bot, limit }: { bot: BotDto; limit: number }) {
  const spent = bot.tokensThisMonth;
  if (limit <= 0) {
    return (
      <span style={fieldHint}>
        Este mes lleva <strong>{spent.toLocaleString("es")}</strong> tokens. Sin
        límite configurado.
      </span>
    );
  }
  const pct = Math.min(100, Math.round((spent / limit) * 100));
  const over = spent >= limit;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={meterTrack}>
        <div
          style={{
            ...meterFill,
            width: `${pct}%`,
            background: over ? "#e08a8a" : pct > 80 ? "#e0a458" : "var(--accent, #25d366)",
          }}
        />
      </div>
      <span style={{ ...fieldHint, color: over ? "#e08a8a" : "var(--muted)" }}>
        {spent.toLocaleString("es")} de {limit.toLocaleString("es")} tokens
        {over ? " · agotado, el bot no responde" : ` · ${pct}%`}
      </span>
    </div>
  );
}

const meterTrack: React.CSSProperties = {
  height: 6,
  borderRadius: 999,
  background: "var(--field, #0d1320)",
  overflow: "hidden",
  marginBottom: 4,
};

const meterFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 300ms cubic-bezier(0.22,1,0.36,1)",
};

const sectionHint: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 12.5,
  color: "var(--muted)",
  lineHeight: 1.5,
};

const fieldHint: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  color: "var(--muted)",
  lineHeight: 1.45,
  marginBottom: 4,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{children}</div>
  );
}

// Fila de herramienta. Una acción sin datos (p. ej. sin etiquetas creadas) se
// puede marcar igual, pero se avisa de que no hará nada hasta configurarla.
function ToolRow({
  tool,
  checked,
  onToggle,
}: {
  tool: AgentToolInfo;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label style={toolRow}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span>
        <strong style={{ fontSize: 13 }}>{tool.label}</strong>{" "}
        <code style={{ color: "var(--accent)", fontSize: 11 }}>{tool.name}</code>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          {tool.description}
        </div>
        {tool.unavailableReason && (
          <div style={{ color: "#e0b766", fontSize: 12, marginTop: 3 }}>
            ⚠️ {tool.unavailableReason}
          </div>
        )}
      </span>
    </label>
  );
}

const toolRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 8,
};

const hint: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  marginTop: 2,
};

const divider: React.CSSProperties = {
  height: 1,
  background: "var(--border)",
  margin: "4px 0",
};
