import { useCallback, useEffect, useRef, useState } from "react";

import { CollectionGrid } from "@/components/CollectionGrid";
import { LoadingGrid } from "@/components/LoadingGrid";
import { StateMessage } from "@/components/StateMessage";
import { TagSearchForm } from "@/components/TagSearchForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollections } from "@/hooks/useCollections";
import { useFavoritesList } from "@/hooks/useFavoritesList";
import { setFavorite } from "@/lib/api";
import { pluralize } from "@/lib/plural";

export default function App() {
  const { state, load, setFavoriteLocal } = useCollections();
  const favoritesList = useFavoritesList();
  const [tab, setTab] = useState("all");
  const [tagInput, setTagInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Запрос с подстановкой канонического active_tag в поле (правило 5).
  const search = useCallback(
    async (tag: string) => {
      const data = await load(tag);
      if (data) setTagInput(data.active_tag);
    },
    [load],
  );

  useEffect(() => {
    void search("");
  }, [search]);

  function handleTabChange(next: string) {
    setTab(next);
    if (next === "favorites") void favoritesList.load();
  }

  function handleReset() {
    setTagInput("");
    void search("").then(() => inputRef.current?.focus());
    inputRef.current?.focus();
  }

  function handleChip(tag: string) {
    if (state.status === "loading") return;
    if (tag === state.activeTag) {
      handleReset();
      return;
    }
    setTagInput(tag);
    void search(tag);
  }

  async function handleToggleFavorite(id: string, favorite: boolean) {
    await setFavorite(id, favorite);
    setFavoriteLocal(id, favorite);
    if (!favorite) favoritesList.remove(id);
  }

  const loading = state.status === "loading";
  const count = state.collections.length;

  let statusText = "";
  if (loading) statusText = "Загружаем подборки…";
  else if (state.status === "success") {
    statusText = state.activeTag
      ? `Показаны подборки по тегу «${state.activeTag}»`
      : "Показаны все подборки";
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 min-[720px]:p-6">
      <header className="flex flex-col gap-2">
        <Badge variant="accent" className="w-fit">
          ВкусВилл
        </Badge>
        <h1 className="text-3xl font-semibold">Подборки ВкусВилла</h1>
        <p className="text-muted-foreground">Найдите подборку по тегу и соберите корзину.</p>
      </header>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList aria-label="Раздел">
          <TabsTrigger value="all">Все подборки</TabsTrigger>
          <TabsTrigger value="favorites">Избранное</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="flex flex-col gap-4">
          <TagSearchForm
            value={tagInput}
            onValueChange={setTagInput}
            onSubmit={(tag) => void search(tag)}
            onReset={handleReset}
            pending={loading}
            suggestions={state.tags}
            inputRef={inputRef}
          />

          {state.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Популярные теги">
              {state.tags.map((tag) => (
                <li key={tag}>
                  <Button
                    type="button"
                    size="sm"
                    variant={tag === state.activeTag ? "default" : "outline"}
                    aria-pressed={tag === state.activeTag}
                    disabled={loading}
                    onClick={() => handleChip(tag)}
                  >
                    {tag}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <p role="status" className="text-sm text-muted-foreground">
            {statusText}
            {state.status === "success" && count > 0 && (
              <> · {count} {pluralize(count, "подборка", "подборки", "подборок")}</>
            )}
          </p>

          {loading && <LoadingGrid />}

          {state.status === "error" && state.error?.kind === "bad-request" && (
            <StateMessage
              tone="error"
              title="Не удалось применить фильтр."
              actionLabel="Сбросить фильтр"
              onAction={handleReset}
            />
          )}
          {state.status === "error" && state.error?.kind === "server" && (
            <StateMessage
              tone="error"
              title={
                state.error.tag
                  ? `Не удалось загрузить подборки по тегу «${state.error.tag}». Попробуйте ещё раз.`
                  : "Не удалось загрузить подборки. Попробуйте ещё раз."
              }
              actionLabel="Повторить"
              onAction={() => void search(state.error?.tag ?? "")}
            />
          )}

          {state.status === "success" && count === 0 && state.activeTag && (
            <StateMessage
              title={`По тегу «${state.activeTag}» ничего не найдено`}
              actionLabel="Сбросить фильтр"
              onAction={handleReset}
            />
          )}
          {state.status === "success" && count === 0 && !state.activeTag && (
            <StateMessage
              title="Подборок пока нет"
              actionLabel="Обновить"
              onAction={() => void search("")}
            />
          )}

          {state.status === "success" && count > 0 && (
            <CollectionGrid
              collections={state.collections}
              favorites={state.favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        </TabsContent>

        <TabsContent value="favorites" className="flex flex-col gap-4">
          {favoritesList.state.status === "loading" && (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                Загружаем избранное…
              </p>
              <LoadingGrid />
            </>
          )}
          {favoritesList.state.status === "error" && (
            <StateMessage
              tone="error"
              title="Не удалось загрузить избранное. Попробуйте ещё раз."
              actionLabel="Повторить"
              onAction={() => void favoritesList.load()}
            />
          )}
          {favoritesList.state.status === "success" &&
            (favoritesList.state.collections.length === 0 ? (
              <StateMessage title="Пока пусто. Добавьте подборку в избранное — она останется здесь." />
            ) : (
              <CollectionGrid
                collections={favoritesList.state.collections}
                favorites={favoritesList.state.collections.map((c) => c.id)}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
        </TabsContent>
      </Tabs>
    </main>
  );
}
