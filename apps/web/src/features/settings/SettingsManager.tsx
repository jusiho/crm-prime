"use client";

import { useState } from "react";
import { NavIcon, type IconName } from "@/components/NavIcons";
import { WhatsAppConnect } from "@/features/whatsapp/WhatsAppConnect";
import { TagsManager } from "./TagsManager";
import { QuickRepliesSettings } from "./QuickRepliesSettings";
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
  | "quickReplies"
  | "channels"
  | "sources"
  | "fields"
  | "stages"
  | "ai"
  | "apiKeys"
  | "integrations"
  | "webhooksOut";

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "tags", label: "Etiquetas", icon: "tag" },
  { key: "quickReplies", label: "Respuestas rápidas", icon: "zap" },
  { key: "channels", label: "Canales", icon: "whatsapp" },
  { key: "sources", label: "Fuentes", icon: "target" },
  { key: "fields", label: "Campos personalizados", icon: "puzzle" },
  { key: "stages", label: "Etapas del pipeline", icon: "pipeline" },
  { key: "ai", label: "Inteligencia Artificial", icon: "bot" },
  { key: "apiKeys", label: "Claves de API", icon: "key" },
  { key: "integrations", label: "Integraciones", icon: "plug" },
  { key: "webhooksOut", label: "Webhooks salientes", icon: "antenna" },
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
            <NavIcon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ minWidth: 0 }}>
        {tab === "tags" && <TagsManager />}
        {tab === "quickReplies" && <QuickRepliesSettings />}
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
    display: "flex",
    alignItems: "center",
    gap: 9,
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
