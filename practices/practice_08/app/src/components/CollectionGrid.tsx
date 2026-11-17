import type { Collection } from "@/lib/api";
import { CollectionCard } from "@/components/CollectionCard";

type Props = {
  collections: Collection[];
  favorites: string[];
  onToggleFavorite: (id: string, favorite: boolean) => Promise<void>;
};

/** Одна колонка до 720 px, две до 1100 px, три выше (правило 18). */
export function CollectionGrid({ collections, favorites, onToggleFavorite }: Props) {
  return (
    <>
      <h2 className="sr-only">Подборки</h2>
      <ul className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-3">
      {collections.map((collection) => (
        <li key={collection.id}>
          <CollectionCard
            collection={collection}
            favorite={favorites.includes(collection.id)}
            onToggleFavorite={onToggleFavorite}
          />
        </li>
      ))}
      </ul>
    </>
  );
}
