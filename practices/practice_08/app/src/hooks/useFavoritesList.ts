import { useCallback, useRef, useState } from "react";

import { fetchFavorites, type Collection } from "@/lib/api";

export type FavoritesState = {
  status: "idle" | "loading" | "success" | "error";
  collections: Collection[];
};

/** Список вкладки «Избранное» (правило 13 spec.md). */
export function useFavoritesList() {
  const [state, setState] = useState<FavoritesState>({ status: "idle", collections: [] });
  const sequence = useRef(0);

  const load = useCallback(async () => {
    const id = ++sequence.current;
    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const collections = await fetchFavorites();
      if (id !== sequence.current) return;
      setState({ status: "success", collections });
    } catch {
      if (id !== sequence.current) return;
      setState({ status: "error", collections: [] });
    }
  }, []);

  const remove = useCallback((collectionId: string) => {
    setState((prev) => ({
      ...prev,
      collections: prev.collections.filter((c) => c.id !== collectionId),
    }));
  }, []);

  return { state, load, remove };
}
