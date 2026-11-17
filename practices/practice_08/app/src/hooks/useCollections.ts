import { useCallback, useRef, useState } from "react";

import {
  ApiError,
  fetchCollections,
  type Collection,
  type CollectionsResponse,
} from "@/lib/api";

export type SearchError = { kind: "bad-request" | "server"; tag: string };

export type SearchState = {
  status: "loading" | "success" | "error";
  collections: Collection[];
  favorites: string[];
  tags: string[];
  activeTag: string;
  error: SearchError | null;
};

const initialState: SearchState = {
  status: "loading",
  collections: [],
  favorites: [],
  tags: [],
  activeTag: "",
  error: null,
};

/**
 * Загрузка подборок по тегу. Каждый запрос получает номер; ответ на устаревший
 * запрос игнорируется (правило 11 spec.md).
 */
export function useCollections() {
  const [state, setState] = useState<SearchState>(initialState);
  const sequence = useRef(0);

  const load = useCallback(async (tag: string): Promise<CollectionsResponse | null> => {
    const id = ++sequence.current;
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    try {
      const data = await fetchCollections(tag);
      if (id !== sequence.current) return null;
      setState({
        status: "success",
        collections: data.collections,
        favorites: data.favorites,
        tags: data.tags,
        activeTag: data.active_tag,
        error: null,
      });
      return data;
    } catch (error) {
      if (id !== sequence.current) return null;
      const kind = error instanceof ApiError && error.status === 400 ? "bad-request" : "server";
      setState((prev) => ({
        ...prev,
        status: "error",
        collections: [],
        error: { kind, tag },
      }));
      return null;
    }
  }, []);

  const setFavoriteLocal = useCallback((id: string, favorite: boolean) => {
    setState((prev) => ({
      ...prev,
      favorites: favorite
        ? prev.favorites.includes(id)
          ? prev.favorites
          : [...prev.favorites, id]
        : prev.favorites.filter((x) => x !== id),
    }));
  }, []);

  return { state, load, setFavoriteLocal };
}
