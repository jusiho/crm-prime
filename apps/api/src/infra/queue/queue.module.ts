import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import {
  QUEUE_CAMPAIGN,
  QUEUE_FLOW,
  QUEUE_INBOUND,
  QUEUE_META_LEADS,
  QUEUE_OUTBOUND,
  QUEUE_WEBHOOK,
} from "./queue.constants";

/**
 * Configura la conexión a Redis y registra las colas de WhatsApp.
 * Reintentos con backoff exponencial por defecto en cada job.
 */
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_INBOUND,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      },
      {
        name: QUEUE_OUTBOUND,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      },
      {
        // Envío masivo de campañas (un job por destinatario, con throttling
        // en el worker para respetar los rate limits de Meta).
        name: QUEUE_CAMPAIGN,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 5000,
          removeOnFail: 10000,
        },
      },
      {
        // Reanudación de flujos tras un bloque "Esperar" (jobs retrasados).
        name: QUEUE_FLOW,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      },
      {
        // Leads de formularios de Meta: el webhook solo avisa, y el worker
        // descarga las respuestas y crea el contacto.
        name: QUEUE_META_LEADS,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      },
      {
        name: QUEUE_WEBHOOK,
        defaultJobOptions: {
          // Reintentos espaciados: el sistema del otro lado puede estar caído
          // un rato y no queremos martillearlo.
          attempts: 5,
          backoff: { type: "exponential", delay: 60_000 },
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
