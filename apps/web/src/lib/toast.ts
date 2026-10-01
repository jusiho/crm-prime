// Store de toasts independiente de React: cualquier código (incluido el
// onError global de React Query) puede llamar a toast.success/error/info.
// El componente <Toaster/> se suscribe y los renderiza.

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** Al pulsarlo se navega aquí (p. ej. el chat del mensaje nuevo). */
  href?: string;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
let seq = 0;

function emit(): void {
  for (const l of listeners) l(toasts);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string, ms: number, href?: string): number {
  const id = ++seq;
  toasts = [...toasts, { id, kind, message, ...(href ? { href } : {}) }];
  emit();
  if (ms > 0 && typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), ms);
  }
  return id;
}

export const toast = {
  success: (message: string) => push("success", message, 3500),
  error: (message: string) => push("error", message, 6000),
  info: (message: string, opts: { href?: string; ms?: number } = {}) => push("info", message, opts.ms ?? 4000, opts.href),
};
