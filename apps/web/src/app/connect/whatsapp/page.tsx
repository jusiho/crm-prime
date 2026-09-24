import { getTranslator } from "@/i18n/server";
import { ConnectWhatsappHub } from "./ConnectWhatsappHub";

export const metadata = { title: "Conectar WhatsApp" };

/**
 * Conector de WhatsApp en el dominio raíz. Sin sesión: lo que autoriza es el
 * pase de la URL, emitido desde el panel de la empresa. Ver ConnectHubController.
 */
export default async function ConnectWhatsappPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const t = await getTranslator();
  const { ticket } = await searchParams;

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>
          Trimmo
        </p>
        {ticket ? (
          <ConnectWhatsappHub
            ticket={ticket}
            t={{
              title: t("connect.title"),
              subtitle: t("connect.subtitle"),
              loadingSdk: t("connect.loadingSdk"),
              continueWithMeta: t("connect.continueWithMeta"),
              waiting: t("connect.waiting"),
              saving: t("connect.saving"),
              done: t("connect.done"),
              notCompleted: t("connect.notCompleted"),
              missingConfig: t("connect.missingConfig"),
              backHint: t("connect.backHint"),
            }}
          />
        ) : (
          <div style={caja}>
            <h1 style={{ margin: 0, fontSize: 20 }}>{t("connect.expired")}</h1>
            <p style={{ color: "var(--muted)", lineHeight: 1.5 }}>{t("connect.expiredHint")}</p>
          </div>
        )}
      </div>
    </main>
  );
}

const caja: React.CSSProperties = {
  padding: 28,
  borderRadius: 12,
  background: "var(--panel)",
  border: "1px solid var(--border)",
};
