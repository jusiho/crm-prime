import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import type {
  IngestKnowledgeInput,
  KnowledgeDocDto,
  KnowledgeHit,
} from "@crm/shared";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TenantService } from "../../infra/tenant/tenant.service";
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from "./embeddings/embedding.provider";

const CHUNK_SIZE = 600;

@Injectable()
export class KnowledgeService implements OnModuleInit {
  private readonly logger = new Logger("Knowledge");

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    @Inject(EMBEDDING_PROVIDER) private readonly embedder: EmbeddingProvider,
  ) {}

  // Asegura el índice vectorial (Prisma no lo expresa en el schema).
  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw
         ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)`,
      );
    } catch (e) {
      this.logger.warn(`No se pudo crear el índice HNSW: ${(e as Error).message}`);
    }
  }

  // ── Ingesta: trocear + embeber + almacenar ──────────────────
  async ingest(input: IngestKnowledgeInput): Promise<KnowledgeDocDto> {
    const doc = await this.prisma.knowledgeDoc.create({
      data: {
        orgId: this.tenant.orgId(),
        title: input.title,
        source: input.source ?? null,
        content: input.content,
      },
    });

    const chunks = this.chunk(input.content);
    const vectors = await this.embedder.embed(chunks);

    for (let i = 0; i < chunks.length; i++) {
      const created = await this.prisma.knowledgeChunk.create({
        data: {
          docId: doc.id,
          content: chunks[i]!,
          tokenCount: Math.ceil(chunks[i]!.length / 4),
        },
      });
      await this.prisma.$executeRawUnsafe(
        `UPDATE knowledge_chunks SET embedding = '${this.toVector(vectors[i]!)}'::vector WHERE id = $1`,
        created.id,
      );
    }

    this.logger.log(`Ingesta "${doc.title}": ${chunks.length} chunks`);
    return { id: doc.id, title: doc.title, source: doc.source, chunks: chunks.length, createdAt: doc.createdAt.toISOString() };
  }

  // ── Búsqueda semántica ──────────────────────────────────────
  async search(query: string, topK = 4): Promise<KnowledgeHit[]> {
    if (!query.trim()) return [];
    const [vec] = await this.embedder.embed([query]);
    const lit = this.toVector(vec!);
    // El filtro por empresa va explícito aunque RLS también lo imponga. Son
    // dos defensas distintas: RLS solo actúa si la aplicación se conecta con el
    // rol restringido, y esta consulta tiene que ser correcta también sin él.
    // Sin esto, el agente de una empresa citaría los documentos internos de
    // otra en una respuesta a un cliente.
    const orgId = this.tenant.orgId();
    const rows = await this.prisma.$queryRawUnsafe<
      { content: string; docTitle: string; score: number }[]
    >(
      `SELECT kc.content, kd.title AS "docTitle",
              1 - (kc.embedding <=> '${lit}'::vector) AS score
       FROM knowledge_chunks kc
       JOIN knowledge_docs kd ON kd.id = kc."docId"
       WHERE kc.embedding IS NOT NULL
         AND kd."isActive" = true
         AND kd."orgId" = $1
       ORDER BY kc.embedding <=> '${lit}'::vector
       LIMIT ${topK}`,
      orgId,
    );
    return rows.map((r) => ({
      content: r.content,
      docTitle: r.docTitle,
      score: Number(r.score),
    }));
  }

  /** Devuelve fragmentos relevantes (texto) para inyectar en el contexto del agente. */
  async retrieve(query: string, topK = 3): Promise<string[]> {
    const hits = await this.search(query, topK);
    // Filtra ruido: solo fragmentos con cierta similitud.
    return hits.filter((h) => h.score > 0.15).map((h) => h.content);
  }

  // ── CRUD de documentos ──────────────────────────────────────
  async listDocs(): Promise<KnowledgeDocDto[]> {
    const docs = await this.prisma.knowledgeDoc.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    });
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      source: d.source,
      chunks: d._count.chunks,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async deleteDoc(id: string): Promise<void> {
    const doc = await this.prisma.knowledgeDoc.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Documento no encontrado");
    await this.prisma.knowledgeDoc.delete({ where: { id } });
  }

  // ── Helpers ─────────────────────────────────────────────────
  private toVector(arr: number[]): string {
    return `[${arr.map((x) => x.toFixed(6)).join(",")}]`;
  }

  private chunk(text: string, size = CHUNK_SIZE): string[] {
    const paras = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    const chunks: string[] = [];
    let cur = "";
    for (const p of paras) {
      if (cur && (cur + "\n\n" + p).length > size) {
        chunks.push(cur);
        cur = p;
      } else {
        cur = cur ? cur + "\n\n" + p : p;
      }
    }
    if (cur) chunks.push(cur);
    // Partir párrafos muy largos.
    return chunks.flatMap((c) =>
      c.length > size * 2 ? this.hardSplit(c, size) : [c],
    );
  }

  private hardSplit(text: string, size: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      out.push(text.slice(i, i + size));
    }
    return out;
  }
}
