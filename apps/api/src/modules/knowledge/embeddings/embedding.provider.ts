export const EMBEDDING_PROVIDER = Symbol("EMBEDDING_PROVIDER");

export const EMBEDDING_DIM = 1024; // coincide con vector(1024) del schema

export interface EmbeddingProvider {
  readonly name: string; // "voyage" | "fake"
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
  /** Con qué se embebería ahora (solo el enrutador lo implementa). */
  current?(): Promise<string>;
}
