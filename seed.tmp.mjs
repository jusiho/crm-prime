import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// Contacto de prueba con anuncio + utms, para ver la atribución de verdad.
const c = await prisma.contact.upsert({
  where: { phone: "+51900112233" },
  create: {
    phone: "+51900112233", name: "Ana Demo Ads", origin: "ad",
    originDetail: "Chat con nosotros",
    metadata: { utm_source: "facebook", utm_medium: "cpc", utm_campaign: "verano2026", pais: "Peru" },
  },
  update: {},
});
await prisma.conversation.create({
  data: {
    contactId: c.id, status: "OPEN",
    referral: {
      sourceId: "120226305854810726", headline: "Chat con nosotros",
      body: "Zapatillas de verano ya disponibles", sourceType: "ad",
      ctwaClid: "Aff-n8ZTODiE79d22KtAwQKj9e", mediaType: "image",
      sourceUrl: "https://fb.me/3cr4Wqqkv", welcomeMessage: "Hola!",
      imageUrl: null, videoUrl: null, thumbnailUrl: null,
    },
  },
});
console.log("contacto de prueba con anuncio creado");
await prisma.$disconnect();
