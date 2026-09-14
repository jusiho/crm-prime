"use client";

import { useState } from "react";
import { WhatsAppConnect } from "@/features/whatsapp/WhatsAppConnect";
import { TagsManager } from "./TagsManager";
import { AiSettings } from "./AiSettings";
import { ApiKeysSettings } from "./ApiKeysSettings";
import { IntegrationsSettings } from "./IntegrationsSettings";
import { WebhooksOutSettings } from "./WebhooksOutSettings";
import {
  CustomFieldsSettings,
  SourcesSettings,
  StagesSettings,
} from "./SettingsPanels";

type TabKey =
  | "tags"
  | "channels"
  | "sources"
  | "fields"
  | "stages"
  | "ai"
  | "apiKeys"
  | "integrations"
  | "webhooksOut";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "tags", label: "Etiquetas", icon: "🏷️" },
  { key: "channels", label: "Canales", icon: "📱" },
  { key: "sources", label: "Fuentes", icon: "🎯" },
  { key: "fields", label: "Campos personalizados", icon: "🧩" },
  { key: "stages", label: "Etapas del pipeline", icon: "📊" },
  { key: "ai", label: "Inteligencia Artificial", icon: "🤖" },
  { key: "apiKeys", label: "Claves de API", icon: "🔑" },
  { key: "integrations", label: "Integraciones", icon: "🔌" },
  { key: "webhooksOut", label: "Webhooks salientes", icon: "📡" },
];

export function SettingsManager() {
  const [tab, setTab] = useState<TabKey>("tags");

  return (
    <div style={wrap}>
      <nav style={tabBar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={tabBtn(tab === t.key)}
          >
            <span style={{ marginRight: 7 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ minWidth: 0 }}>
        {tab === "tags" && <TagsManager />}
        {tab === "channels" && <WhatsAppConnect />}
        {tab === "sources" && <SourcesSettings />}
        {tab === "fields" && <CustomFieldsSettings />}
        {tab === "stages" && <StagesSettings />}
        {tab === "ai" && <AiSettings />}
        {tab === "apiKeys" && <ApiKeysSettings />}
        {tab === "integrations" && <IntegrationsSettings />}
        {tab === "webhooksOut" && <WebhooksOutSettings />}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  gap: 24,
  maxWidth: 1040,
  margin: "0 auto",
  padding: 24,
  alignItems: "start",
};

const tabBar: React.CSSProperties = {
  position: "sticky",
  top: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

function tabBtn(active: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 9,
    border: "1px solid transparent",
    background: active ? "var(--surface)" : "transparent",
    color: active ? "var(--text)" : "var(--muted)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    borderColor: active ? "var(--border)" : "transparent",
    transition: "background 0.12s ease, color 0.12s ease",
  };
}
