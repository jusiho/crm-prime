# Conectar WhatsApp

Driony trabaja sobre la **WhatsApp Business Platform** de Meta (la "API de WhatsApp"). Hay dos maneras de conectar un número; la primera es la normal.

## Con el botón «Conectar WhatsApp»

En **WhatsApp** (menú lateral) pulsa **Conectar WhatsApp**. Se abre la ventana oficial de Meta dentro de tu panel:

1. Inicia sesión en Facebook con la cuenta que administra tu negocio.
2. Elige (o crea) el **portafolio de negocio** y la **cuenta de WhatsApp Business**.
3. Elige el número. Si ya lo usas en la app de **WhatsApp Business** del celular, activa la **Coexistencia**: escanea el QR con el celular y el número queda conectado a los dos sitios.
4. La ventana se cierra sola y el número aparece en tu lista.

No hay que copiar tokens ni configurar webhooks: la plataforma se encarga.

### Coexistencia: seguir usando el celular

Con Coexistencia, el número funciona a la vez en la app del celular y en Driony:

- lo que te escriben aparece en los dos;
- lo que respondes desde el celular también se ve en la bandeja, y **pausa a la IA** en esa conversación durante unos minutos para que no os piséis;
- las respuestas del CRM salen por el mismo número.

Al conectar, Driony importa los contactos y el historial reciente del celular (Meta solo lo permite en las 24 horas siguientes a conectar).

#### Quién puede activarla

La Coexistencia **no la activa cada empresa por su cuenta**. Meta solo la habilita a través del registro integrado (*Embedded Signup*) de un **proveedor tecnológico aprobado** (Tech Provider o Solution Partner con acceso avanzado a la API de WhatsApp). En la práctica:

- Se activa únicamente con el botón **Conectar WhatsApp** de Driony, una vez que Meta apruebe la plataforma.
- Mientras esa aprobación no llegue, la pantalla de WhatsApp lo dice («Conexión con un clic: en revisión por Meta») y en lugar del botón te ofrece conectar con tu propia app. No hay nada que puedas hacer por tu cuenta para adelantarla.
- **No** se consigue con un token pegado a mano ni con tu propia app de desarrollador: por esa vía el número queda en modo API (solo desde el CRM).
- Si al terminar el registro de Meta el número no quedó también en la app del celular, Driony lo guarda en modo API y te lo muestra así, en vez de prometer una coexistencia que no existe.
- En la nube de Driony está incluida **a partir del plan Pro** ([Planes y límites](/docs/planes)). Con el plan Gratis, el mismo botón conecta el número en modo API.

### Varios números

Puedes conectar tantos números como quieras (**Añadir número**). A cada uno le pones un alias («Ventas», «Soporte»), un [agente de IA](/docs/agentes) propio, [flujos](/docs/flujos) propios y un [embudo](/docs/embudos) al que entran sus conversaciones. Cada respuesta sale siempre por el número por el que entró el mensaje.

## Con tu propia app de Meta

Si prefieres usar tu propia app de desarrollador de Meta (o mientras la plataforma no tenga aún la aprobación de Meta para conectar el número de tu empresa), el número se añade **a mano**:

1. En [developers.facebook.com](https://developers.facebook.com) crea una app de tipo **Negocio** y añádele el producto **WhatsApp**.
2. En **Ajustes › Integraciones → Tu propia app de Meta**, pega el **App ID**, el **App secret** (Configuración › Básica de tu app) y un **verify token** que inventes tú. Guarda.
3. En tu app → WhatsApp → Configuración → **Webhooks**: URL de devolución de llamada = la que te muestra esa pantalla (`https://tu-empresa.driony.com/api/v1/webhooks/whatsapp`) y el verify token que guardaste. Suscribe `messages` (y `message_echoes`).
4. En **WhatsApp → Añadir un número a mano**: el *Phone number ID*, el *WABA ID* y un token **permanente** (usuario del sistema con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`).

Con tu propia app el número trabaja en **modo API**: se atiende solo desde el CRM. La Coexistencia con el celular no se puede activar por esta vía: solo la habilita Meta a través de un proveedor aprobado, con el botón de la plataforma (ver «Quién puede activarla», más arriba).

## La ventana de 24 horas

Es una regla de WhatsApp, no del CRM: puedes escribir libremente a quien te haya escrito en las **últimas 24 horas**. Pasado ese tiempo, solo puedes iniciar con una **plantilla aprobada por Meta** ([Difusiones y plantillas](/docs/difusiones)). La bandeja te lo indica y te ofrece enviar una plantilla.

## Problemas frecuentes

| Lo que ves | Qué es |
|---|---|
| La pantalla dice **«Conexión con un clic: en revisión por Meta»** | Meta aún no ha aprobado a la plataforma como proveedor tecnológico. Conecta con tu propia app (arriba); cuando llegue la aprobación aparecerá el botón. |
| Meta dice **«la app de socio no tiene los permisos avanzados…» (#2655111)** al abrir el registro | Lo mismo: abriste el registro de Meta sin que la plataforma esté aprobada y sin un rol en su app. Conecta con tu propia app mientras tanto. |
| **«Dominio de host desconocido de JSSDK»** | Solo puede pasar si abres el conector fuera de `driony.com`. Vuelve a pulsar el botón desde tu panel. |
| El número aparece con **«Token caducado»** | Pegaste un token temporal (caduca en 24 h). Genera uno permanente de usuario del sistema y pulsa **Actualizar token**. |
| Envías pero **no recibes** | El webhook de tu app no apunta a Driony o el verify token no coincide (solo con app propia). Revisa la URL y suscribe `messages`. |
| Con la app propia, **la cuenta de WhatsApp no está suscrita** a tu app | Compruébalo con `GET /{waba-id}/subscribed_apps`; Driony lo hace al añadir el número, pero Meta a veces lo exige de nuevo. |
| Quiero **Coexistencia** con mi propia app o con un token a mano | No es posible: Meta solo la activa a través de un proveedor tecnológico aprobado (Embedded Signup). Con app propia el número trabaja en modo API. |
