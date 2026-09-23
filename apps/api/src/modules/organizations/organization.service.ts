import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import * as bcrypt from "bcryptjs";
import {
  RESERVED_SUBDOMAINS,
  extraReserved,
  type RegisterOrgInput,
  type RegisterOrgResult,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { runUnscoped } from "../../infra/tenant/tenant.context";
import { env } from "../../common/utils/env";

/** Etapas con las que arranca cualquier empresa nueva. */
const ETAPAS = [
  { name: "Nuevo", order: 0 },
  { name: "Contactado", order: 1 },
  { name: "Calificado", order: 2 },
  { name: "Propuesta", order: 3 },
  { name: "Ganado", order: 4, isWon: true },
  { name: "Perdido", order: 5, isLost: true },
];

const PROMPT_POR_DEFECTO = [
  "Eres un asistente de atención al cliente por WhatsApp.",
  "Responde en español, con tono cercano y profesional.",
  "Usa las herramientas disponibles para consultar y actuar en el CRM.",
  "Si no estás seguro, el cliente se enoja, o el tema excede tu alcance,",
  "escala a un humano con la herramienta handoff_to_human.",
  "Nunca inventes información que no puedas verificar con las herramientas.",
].join(" ");

/** Altas por IP en la ventana. Cinco empresas por hora es mucho para un humano. */
const ALTAS_MAX = 5;
const ALTAS_VENTANA_MS = 60 * 60_000;

@Injectable()
export class OrganizationService {
  private readonly log = new Logger(OrganizationService.name);

  // Mismo patrón que el límite de intentos de login: en memoria, por proceso.
  // Con varias instancias detrás del proxy cada una lleva su cuenta, así que
  // el límite real es N veces esto. Suficiente contra un script; para algo
  // serio va a Redis, que ya está en la pila.
  private readonly altas = new Map<string, { count: number; firstAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Dominio bajo el que cuelgan los subdominios: `acme.<base>`. */
  private get baseDomain(): string {
    return env("SAAS_BASE_DOMAIN") ?? "localhost:3000";
  }

  /**
   * ¿Está reservado este subdominio?
   *
   * Dos fuentes: la lista fija del proyecto y la de este despliegue concreto
   * (los subdominios que ya estás usando para otra cosa). La segunda importa
   * más de lo que parece: si hoy sirves el producto en `crm.tudominio.com` y
   * alguien registra la empresa "crm", te quita tu propia URL.
   */
  private reservado(slug: string): boolean {
    return (
      RESERVED_SUBDOMAINS.has(slug) ||
      extraReserved(env("RESERVED_SUBDOMAINS_EXTRA")).has(slug)
    );
  }

  /**
   * Da de alta una empresa con su primer administrador.
   *
   * Todo en **una transacción**. Una empresa a medias —creada pero sin
   * administrador, o sin etapas— es peor que un alta que falla: el usuario no
   * puede entrar, no puede reintentar porque el slug ya está cogido, y hay que
   * arreglarlo a mano en la base.
   */
  async register(input: RegisterOrgInput, ip?: string): Promise<RegisterOrgResult> {
    this.assertAltasPermitidas(ip ?? "?");

    const slug = input.slug.toLowerCase();
    if (this.reservado(slug)) {
      throw new BadRequestException("Ese subdominio está reservado, elige otro");
    }

    // Comprobación previa para dar un error entendible. La garantía de verdad
    // la da el índice único de la base, que es lo que resuelve dos altas
    // simultáneas con el mismo slug.
    const ocupado = await runUnscoped("alta: comprobar subdominio libre", () =>
      this.prisma.organization.findUnique({ where: { slug } }),
    );
    if (ocupado) {
      throw new ConflictException(`El subdominio "${slug}" ya está ocupado`);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    try {
      const { org, adminId } = await this.prisma.$transaction(async (tx) => {
        const creada = await tx.organization.create({
          data: { slug, name: input.companyName },
        });

        const admin = await tx.user.create({
          data: {
            orgId: creada.id,
            email: input.adminEmail.toLowerCase().trim(),
            passwordHash,
            name: input.adminName,
            role: "ADMIN",
          },
        });

        await tx.pipelineStage.createMany({
          data: ETAPAS.map((e) => ({ ...e, orgId: creada.id })),
        });

        await tx.agentConfig.create({
          data: {
            orgId: creada.id,
            name: "Agente por defecto",
            model: "claude-opus-4-8",
            effort: "medium",
            maxIterations: 6,
            isDefault: true,
            systemPrompt: PROMPT_POR_DEFECTO,
            enabledTools: [
              "search_contact",
              "update_contact",
              "search_knowledge",
              "schedule_followup",
              "handoff_to_human",
            ],
          },
        });

        return { org: creada, adminId: admin.id };
      });

      this.log.log(`Empresa dada de alta: ${org.slug} (${org.name})`);
      this.registrarAlta(ip ?? "?");

      // El pase para entrar en el subdominio nuevo sin volver a escribir la
      // contraseña. Dos minutos y un solo uso (lo hace cumplir AuthService).
      const handoffToken = await this.jwt.signAsync(
        { sub: adminId, org: org.id, purpose: "handoff", jti: randomUUID() },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "2m" },
      );

      return {
        orgId: org.id,
        slug: org.slug,
        url: this.urlFor(org.slug),
        handoffToken,
      };
    } catch (e) {
      // Carrera con otra alta del mismo slug: el índice único lo impidió.
      if ((e as { code?: string }).code === "P2002") {
        throw new ConflictException(`El subdominio "${slug}" ya está ocupado`);
      }
      throw e;
    }
  }

  /**
   * Traduce un subdominio a una organización.
   *
   * Consulta sin filtrar por necesidad: es justo la que averigua de qué empresa
   * estamos hablando. Devuelve lo mínimo — nada de datos de la empresa antes de
   * que nadie se haya autenticado.
   */
  async resolveSlug(slug: string): Promise<{ id: string; name: string } | null> {
    const org = await runUnscoped("acceso: resolver subdominio", () =>
      this.prisma.organization.findUnique({
        where: { slug: slug.toLowerCase() },
        select: { id: true, name: true, isActive: true },
      }),
    );
    if (!org || !org.isActive) return null;
    return { id: org.id, name: org.name };
  }

  /** Para la pantalla de acceso: el nombre de la empresa del subdominio. */
  async publicInfo(slug: string): Promise<{ slug: string; name: string }> {
    const org = await this.resolveSlug(slug);
    if (!org) throw new NotFoundException("Esa empresa no existe");
    return { slug: slug.toLowerCase(), name: org.name };
  }

  /** ¿Está libre este subdominio? Para avisar mientras se escribe el formulario. */
  async slugDisponible(slug: string): Promise<{ available: boolean; reason?: string }> {
    const limpio = slug.toLowerCase().trim();
    if (this.reservado(limpio)) {
      return { available: false, reason: "Está reservado" };
    }
    const existe = await runUnscoped("alta: comprobar subdominio libre", () =>
      this.prisma.organization.findUnique({ where: { slug: limpio } }),
    );
    return existe ? { available: false, reason: "Ya está ocupado" } : { available: true };
  }

  private assertAltasPermitidas(ip: string): void {
    const rec = this.altas.get(ip);
    if (!rec) return;
    if (Date.now() - rec.firstAt > ALTAS_VENTANA_MS) {
      this.altas.delete(ip);
      return;
    }
    if (rec.count >= ALTAS_MAX) {
      throw new HttpException(
        "Demasiadas altas desde esta conexión. Inténtalo dentro de una hora.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registrarAlta(ip: string): void {
    const rec = this.altas.get(ip);
    if (rec && Date.now() - rec.firstAt <= ALTAS_VENTANA_MS) {
      rec.count += 1;
    } else {
      this.altas.set(ip, { count: 1, firstAt: Date.now() });
    }
  }

  private urlFor(slug: string): string {
    const base = this.baseDomain;
    const protocolo = base.startsWith("localhost") ? "http" : "https";
    return `${protocolo}://${slug}.${base}`;
  }
}
