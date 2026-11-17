import { useRef, useState } from "react";
import { Heart, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createCart, type Collection } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { pluralize } from "@/lib/plural";

type Props = {
  collection: Collection;
  favorite: boolean;
  /** Сохраняет состояние избранного на сервере; при ошибке бросает исключение. */
  onToggleFavorite: (id: string, favorite: boolean) => Promise<void>;
};

type CartState = { status: "idle" | "loading" | "error" } | { status: "ready"; url: string };

const VISIBLE_ITEMS = 4;

/** Карточка подборки: избранное (правило 12) и корзина (правило 14). */
export function CollectionCard({ collection, favorite, onToggleFavorite }: Props) {
  const [cart, setCart] = useState<CartState>({ status: "idle" });
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState(false);
  const cartLock = useRef(false);
  const favoriteLock = useRef(false);

  async function handleCart() {
    if (cartLock.current) return;
    cartLock.current = true;
    setCart({ status: "loading" });
    try {
      const url = await createCart(collection.id);
      setCart({ status: "ready", url });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setCart({ status: "error" });
    } finally {
      cartLock.current = false;
    }
  }

  async function handleFavorite() {
    if (favoriteLock.current) return;
    favoriteLock.current = true;
    setFavoriteBusy(true);
    setFavoriteError(false);
    try {
      await onToggleFavorite(collection.id, !favorite);
    } catch {
      setFavoriteError(true);
    } finally {
      favoriteLock.current = false;
      setFavoriteBusy(false);
    }
  }

  const hidden = collection.items.length - VISIBLE_ITEMS;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{collection.title}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`В избранное: ${collection.title}`}
            aria-pressed={favorite}
            disabled={favoriteBusy}
            onClick={handleFavorite}
          >
            <Heart aria-hidden="true" className={favorite ? "fill-current text-destructive" : undefined} />
          </Button>
        </div>
        {collection.subtitle && <CardDescription>{collection.subtitle}</CardDescription>}
        {collection.tags.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1" aria-label="Теги подборки">
            {collection.tags.map((tag) => (
              <li key={tag}>
                <Badge variant="outline">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <ul className="flex flex-col gap-1 text-sm">
          {collection.items.slice(0, VISIBLE_ITEMS).map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.name}</span>
              <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                {formatPrice(item.price)}
              </span>
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            и ещё {hidden} {pluralize(hidden, "товар", "товара", "товаров")}
          </p>
        )}
        <p className="mt-auto pt-3 font-semibold">Итого: {formatPrice(collection.total)}</p>
      </CardContent>
      <CardFooter>
        <Button type="button" disabled={cart.status === "loading"} onClick={handleCart}>
          <ShoppingCart aria-hidden="true" />
          {cart.status === "loading" ? "Собираем корзину…" : "В корзину"}
        </Button>
        {cart.status === "ready" && (
          <div role="status" className="flex flex-col gap-2 text-sm">
            <span>Корзина готова</span>
            <a
              href={cart.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "accent" })}
            >
              Открыть корзину во ВкусВилле
            </a>
          </div>
        )}
        {cart.status === "error" && (
          <p role="alert" className="text-sm text-destructive-foreground">
            Не удалось собрать корзину. Попробуйте ещё раз.
          </p>
        )}
        {favoriteError && (
          <p role="alert" className="text-sm text-destructive-foreground">
            Не удалось изменить избранное. Попробуйте ещё раз.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
