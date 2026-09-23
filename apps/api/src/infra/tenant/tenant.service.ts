import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  currentOrgId,
  runUnscoped,
  setSingleOrg,
  tenancyMode,
} from "./tenant.context";

/** Slug de la organización única en modo `single`. */
const DEFAULT_SLUG = "default";

/**
 * Resuelve a qué organización pertenece lo que se está haciendo ahora mismo.
 *
 * Dos modos, y la diferencia importa:
 *
 * - `single` (por defecto, la versión open source): hay una sola organización
 *   y se usa siempre. El CRM se comporta exactamente como antes de que
 *   existiera la columna `orgId`.
 * - `multi` (SaaS): no hay organización por defecto. Si algo pregunta por el
 *   `orgId` fuera del contexto de una petición autenticada, **falla**. Es
 *   deliberado: un valor por defecto en modo SaaS es una fuga de datos con
 *   forma de comodidad.
 */
@Injectable()
export class TenantService implements OnModuleInit {
  private readonly log = new Logger(TenantService.name);

  readonly mode = tenancyMode;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (this.mode === "multi") {
      this.log.log("Modo multi-empresa: el orgId sale de cada petición");
      return;
    }

    // `Organization` no es una tabla con orgId, así que esta consulta no pasa
    // por el filtro; aun así se marca, porque es el arranque y no hay contexto.
    const orgs = await runUnscoped("arranque: localizar la organización única", () =>
      this.prisma.organization.findMany({
        orderBy: { createdAt: "asc" },
        take: 2,
      }),
    );

    if (orgs.length > 1) {
      // Elegir "la primera" aquí sería servirle a una empresa los datos de
      // otra. Mejor no arrancar.
      throw new Error(
        "Hay más de una organización en la base pero TENANCY_MODE no es 'multi'. " +
          "Arranca con TENANCY_MODE=multi o deja una sola organización.",
      );
    }

    if (orgs.length === 1) {
      setSingleOrg(orgs[0].id);
      return;
    }

    // Base recién creada sin seed: la organización única es un invariante del
    // modo single, así que se establece aquí en vez de fallar al primer alta.
    const created = await this.prisma.organization.create({
      data: { slug: DEFAULT_SLUG, name: "Mi empresa" },
    });
    setSingleOrg(created.id);
    this.log.log(`Organización creada: ${created.slug}`);
  }

  /**
   * La organización activa. Lanza si no hay ninguna: es preferible un 500 a
   * escribir una fila sin dueño.
   */
  orgId(): string {
    const id = currentOrgId();
    if (id) return id;
    throw new InternalServerErrorException(
      "No hay organización en el contexto de esta operación",
    );
  }
}
