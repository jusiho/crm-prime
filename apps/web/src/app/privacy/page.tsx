export default function PrivacyPage() {
  const company = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "CRM Prime";
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contacto@crmprime.com";

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 24px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#e6edf6",
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Política de Privacidad</h1>
      <p style={{ color: "#8aa0bd", marginTop: 0 }}>
        Última actualización: junio de 2026
      </p>

      <Section title="1. Responsable del tratamiento">
        <p>
          <strong>{company}</strong> es el responsable del tratamiento de los
          datos personales recabados a través de esta plataforma y de los canales
          de comunicación integrados (WhatsApp Business API).
        </p>
      </Section>

      <Section title="2. Datos que recopilamos">
        <ul>
          <li>Nombre y número de teléfono de los contactos que nos escriben.</li>
          <li>Contenido de los mensajes intercambiados a través de WhatsApp.</li>
          <li>
            Datos de cuenta de usuarios internos: nombre, correo electrónico y
            contraseña (almacenada en forma de hash).
          </li>
          <li>
            Información operativa: registros de actividad, sesiones activas y
            metadatos de uso de la plataforma.
          </li>
        </ul>
      </Section>

      <Section title="3. Finalidad del tratamiento">
        <ul>
          <li>
            Gestionar la comunicación entre la empresa y sus clientes a través de
            WhatsApp Business.
          </li>
          <li>Brindar soporte, seguimiento de ventas y atención al cliente.</li>
          <li>Mejorar la calidad del servicio mediante el análisis de conversaciones.</li>
          <li>
            Generar respuestas asistidas por inteligencia artificial (en modo
            copilot o autopilot), sujetas siempre a revisión humana.
          </li>
        </ul>
      </Section>

      <Section title="4. Base legal">
        <p>
          El tratamiento se fundamenta en el interés legítimo de la empresa para
          brindar atención al cliente, y en el consentimiento del usuario al
          iniciar la comunicación vía WhatsApp.
        </p>
      </Section>

      <Section title="5. Conservación de datos">
        <p>
          Los datos se conservan mientras sea necesario para las finalidades
          descritas y conforme a las obligaciones legales aplicables. El usuario
          puede solicitar la eliminación de sus datos en cualquier momento.
        </p>
      </Section>

      <Section title="6. Compartición con terceros">
        <p>Los datos pueden ser procesados por los siguientes proveedores:</p>
        <ul>
          <li>
            <strong>Meta Platforms</strong> — infraestructura de WhatsApp
            Business Cloud API.
          </li>
          <li>
            <strong>Anthropic</strong> — generación de respuestas asistidas por
            IA (solo el contenido de la conversación; sin datos identificatorios
            adicionales).
          </li>
        </ul>
        <p>No vendemos ni cedemos datos personales a terceros con fines comerciales.</p>
      </Section>

      <Section title="7. Derechos del usuario">
        <p>
          Puedes ejercer tus derechos de acceso, rectificación, supresión,
          oposición y portabilidad escribiendo a:{" "}
          <a href={`mailto:${email}`} style={{ color: "#3578ff" }}>
            {email}
          </a>
          .
        </p>
      </Section>

      <Section title="8. Seguridad">
        <p>
          Aplicamos medidas técnicas y organizativas para proteger los datos:
          cifrado en tránsito (HTTPS/TLS), tokens de autenticación de corta
          vida, hash de contraseñas con bcrypt y acceso restringido por roles.
        </p>
      </Section>

      <Section title="9. Contacto">
        <p>
          Para cualquier consulta sobre privacidad, escríbenos a{" "}
          <a href={`mailto:${email}`} style={{ color: "#3578ff" }}>
            {email}
          </a>
          .
        </p>
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8, color: "#e6edf6" }}>
        {title}
      </h2>
      <div style={{ color: "#b0c4de" }}>{children}</div>
    </section>
  );
}
