"use client";

import { useState } from "react";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Toaster } from "@/components/Toaster";
import { ConfirmHost } from "@/components/ConfirmHost";
import { toast } from "@/lib/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false },
        },
        // Toda mutación que falle avisa con un toast de error, sin tener que
        // cablearlo componente por componente.
        // Si la mutación ya trae su propio onError, se le deja a ella: si no,
        // el error saldría dos veces.
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (mutation.options.onError) return;
            const msg =
              error instanceof Error ? error.message : "Ocurrió un error";
            toast.error(msg);
          },
        }),
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
      <ConfirmHost />
    </QueryClientProvider>
  );
}
