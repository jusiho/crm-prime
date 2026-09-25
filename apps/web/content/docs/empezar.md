# Empezar

Trimmo es un CRM para vender por WhatsApp: una bandeja con todos tus números, agentes de IA que responden y califican, un embudo por proceso y flujos sin código. Esta guía te lleva de cero a tu primera conversación.

## Crear tu empresa

1. Entra en [trimmo.lat/signup](/signup) y escribe el nombre de tu empresa, tu nombre y tu correo.
2. Te proponemos un **subdominio** a partir del nombre (`tu-empresa.trimmo.lat`). Puedes cambiarlo antes de terminar; después ya no, porque es la dirección que compartirás con tu equipo.
3. Al terminar entras directamente en tu panel, como administrador.

Tu empresa vive en su propio subdominio. Los datos de cada empresa están separados de los de cualquier otra, también en la base de datos.

> **Para entrar después:** `tu-empresa.trimmo.lat/login`. Si vas a `trimmo.lat/login`, te preguntamos cuál es tu empresa y te llevamos allí, igual que hace Slack con los espacios de trabajo.

## Invitar a tu equipo

En **Vendedores** (menú lateral) creas los usuarios de tu equipo con un correo y una contraseña inicial. Hay dos roles:

| Rol | Puede |
|---|---|
| **Administrador** | Todo: ajustes, números de WhatsApp, agentes, claves de API, equipo. |
| **Vendedor** | Trabajar la bandeja, los contactos y el embudo. No ve los ajustes. |

Un administrador no puede desactivarse a sí mismo ni quitarse el rol: siempre queda alguien con la llave.

### Fuentes y reparto

Las **fuentes** (Ajustes › Fuentes) dicen por dónde llegó cada contacto: WhatsApp, un anuncio, una web, un referido. Puedes asignar vendedores a cada fuente; con eso:

- cada vendedor ve en su bandeja las conversaciones de sus fuentes;
- las oportunidades nuevas del embudo se reparten entre los vendedores de la fuente (ver [Embudos](/docs/embudos)).

Los contactos que entran por WhatsApp reciben la fuente **WhatsApp** automáticamente; los que vienen de un anuncio click-to-WhatsApp, **Anuncio de Meta**.

## Lo mínimo para empezar a vender

1. **Conecta tu número** — [Conectar WhatsApp](/docs/whatsapp).
2. **Pon tu API key de IA** en Ajustes › Inteligencia Artificial (OpenAI, Anthropic o cualquier API compatible con OpenAI). Sin ella los agentes no responden — [Agentes de IA](/docs/agentes).
3. **Revisa tu embudo** en Ajustes › Embudos y etapas y activa la entrada automática si quieres que cada conversación nueva aparezca como oportunidad — [Embudos](/docs/embudos).

## Idioma

El selector de idioma está arriba a la derecha (Español / English). Afecta al panel; los mensajes que envías a tus clientes los escribes tú o tu agente en el idioma que quieras.

## Dos formas de usar Trimmo

- **En la nube** (`trimmo.lat`): nosotros lo alojamos, tú entras y trabajas. Es lo que describe esta documentación.
- **Open source**: el mismo CRM, instalado en tu propio servidor, para una sola empresa — [Versión open source](/docs/autoalojado).
