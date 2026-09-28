"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OnboardingDto, OnboardingStepKey, TourKey } from "@crm/shared";
import {
  dismissOnboarding,
  fetchOnboarding,
  markTourSeen,
  skipOnboardingStep,
} from "@/lib/bff";

export const ONBOARDING_KEY = ["onboarding"] as const;

/**
 * Estado de Primeros pasos compartido por el menú lateral, la página y los
 * tours. Se refresca al volver a la pestaña: los pasos se completan en otras
 * pantallas, y al regresar la lista debe reflejarlo sin recargar.
 */
export function useOnboarding(enabled = true) {
  return useQuery({
    queryKey: ONBOARDING_KEY,
    queryFn: fetchOnboarding,
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useOnboardingActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ONBOARDING_KEY });

  const skip = useMutation({
    mutationFn: ({ key, skipped }: { key: OnboardingStepKey; skipped: boolean }) =>
      skipOnboardingStep(key, skipped),
    onSuccess: refresh,
  });

  const dismiss = useMutation({
    mutationFn: (dismissed: boolean) => dismissOnboarding(dismissed),
    onSuccess: refresh,
  });

  const tourSeen = useMutation({
    mutationFn: (key: TourKey) => markTourSeen(key),
    // Optimista: el tour no debe volver a abrirse mientras llega la respuesta.
    onMutate: (key) => {
      queryClient.setQueryData<OnboardingDto>(ONBOARDING_KEY, (old) =>
        old && !old.toursSeen.includes(key)
          ? { ...old, toursSeen: [...old.toursSeen, key] }
          : old,
      );
    },
  });

  return { skip, dismiss, tourSeen };
}
