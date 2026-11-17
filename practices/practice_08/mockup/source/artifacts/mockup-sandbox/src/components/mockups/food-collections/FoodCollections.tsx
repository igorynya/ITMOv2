import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CookingPot,
  Heart,
  Leaf,
  RefreshCw,
  ShoppingBasket,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "./_group.css";

type PrototypeState =
  | "success"
  | "loading"
  | "validation-empty"
  | "validation-long"
  | "submitting"
  | "no-results"
  | "filter-error"
  | "empty-favorites"
  | "load-error"
  | "cart-pending"
  | "cart-error";

type Item = { name: string; quantity: string; price: number };
type Collection = {
  id: string;
  name: string;
  subtitle: string;
  tags: string[];
  items: Item[];
  budget: number | null;
};

const menuSets: Collection[][] = [
  [
    {
      id: "warm-salad",
      name: "Тёплый ужин без суеты",
      subtitle: "Запечённая курица, картофель и хрустящий салат.",
      tags: ["ужин", "просто", "сытно"],
      items: [
        { name: "Филе куриное", quantity: "400 г", price: 219 },
        { name: "Картофель", quantity: "500 г", price: 68 },
        { name: "Огурцы", quantity: "2 шт.", price: 76 },
        { name: "Сметана", quantity: "180 г", price: 89 },
      ],
      budget: 520,
    },
    {
      id: "tomato-pasta",
      name: "Паста с томатами",
      subtitle: "Яркий соус, свежий базилик и немного пармезана.",
      tags: ["ужин", "бюджет", "быстро", "вегетарианское"],
      items: [
        { name: "Паста", quantity: "250 г", price: 94 },
        { name: "Томаты", quantity: "400 г", price: 149 },
        { name: "Сыр твёрдый", quantity: "80 г", price: 138 },
        { name: "Базилик", quantity: "1 пучок", price: 79 },
      ],
      budget: 520,
    },
    {
      id: "apple-oats",
      name: "Овсянка с яблоком",
      subtitle: "Тёплые хлопья с мёдом и хрустящими орехами.",
      tags: ["завтрак", "бюджет", "быстро"],
      items: [
        { name: "Овсяные хлопья", quantity: "200 г", price: 78 },
        { name: "Яблоки", quantity: "2 шт.", price: 64 },
        { name: "Мёд", quantity: "100 г", price: 96 },
        { name: "Йогурт натуральный", quantity: "150 г", price: 82 },
      ],
      budget: 360,
    },
    {
      id: "fish-bowl",
      name: "Рыба и овощи на противне",
      subtitle: "Минимум посуды, максимум цвета на тарелке.",
      tags: ["ужин", "полезно", "духовка"],
      items: [
        { name: "Филе трески", quantity: "350 г", price: 289 },
        { name: "Перец сладкий", quantity: "2 шт.", price: 118 },
        { name: "Кабачок", quantity: "1 шт.", price: 92 },
        { name: "Лимон", quantity: "1 шт.", price: 54 },
      ],
      budget: 650,
    },
  ],
  [
    {
      id: "breakfast-oats",
      name: "Завтрак с яблоком",
      subtitle: "Тёплая овсянка с орехами и мёдом.",
      tags: ["завтрак", "быстро", "сытно"],
      items: [
        { name: "Овсяные хлопья", quantity: "200 г", price: 78 },
        { name: "Яблоки", quantity: "2 шт.", price: 64 },
        { name: "Орехи", quantity: "60 г", price: 119 },
        { name: "Мёд", quantity: "100 г", price: 96 },
      ],
      budget: 410,
    },
    {
      id: "lunch-bowl",
      name: "Обеденная тарелка",
      subtitle: "Гречка, грибы и соус из зелени.",
      tags: ["обед", "вегетарианское", "просто"],
      items: [
        { name: "Гречка", quantity: "200 г", price: 72 },
        { name: "Шампиньоны", quantity: "250 г", price: 145 },
        { name: "Йогурт натуральный", quantity: "150 г", price: 82 },
        { name: "Укроп", quantity: "1 пучок", price: 39 },
      ],
      budget: 430,
    },
    {
      id: "soup-day",
      name: "Суп на два дня",
      subtitle: "Нежный суп из чечевицы с паприкой.",
      tags: ["обед", "заготовка", "полезно"],
      items: [
        { name: "Чечевица", quantity: "250 г", price: 129 },
        { name: "Морковь", quantity: "2 шт.", price: 38 },
        { name: "Лук репчатый", quantity: "2 шт.", price: 31 },
        { name: "Сливки", quantity: "200 мл", price: 115 },
      ],
      budget: 400,
    },
  ],
];

const tagOptions = ["ужин", "завтрак", "бюджет", "быстро", "вегетарианское", "полезно", "обед"];
const stateLabels: Record<PrototypeState, string> = {
  success: "Успех · подборки «ужин»",
  loading: "Загрузка",
  "validation-empty": "Проверка · пустой тег",
  "validation-long": "Проверка · длинный тег",
  submitting: "Отправка запроса",
  "no-results": "Нет результатов",
  "filter-error": "Ошибка 400",
  "empty-favorites": "Пустое избранное",
  "load-error": "Ошибка загрузки",
  "cart-pending": "Корзина · загрузка",
  "cart-error": "Корзина · ошибка",
};

function money(value: number) {
  return `${value} ₽`;
}

function collectionCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun =
    lastTwo >= 11 && lastTwo <= 14
      ? "подборок"
      : last === 1
        ? "подборка"
        : last >= 2 && last <= 4
          ? "подборки"
          : "подборок";
  return `${count} ${noun}`;
}

export function FoodCollections() {
  const [prototypeState, setPrototypeState] = useState<PrototypeState>("success");
  const [tag, setTag] = useState("ужин");
  const [activeTab, setActiveTab] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [menuSetIndex, setMenuSetIndex] = useState(0);
  const [cartMessage, setCartMessage] = useState("");

  const isBusy = prototypeState === "loading" || prototypeState === "submitting";
  const formDisabled = prototypeState === "loading";
  const validationError =
    prototypeState === "validation-empty"
      ? "Введите тег"
      : prototypeState === "validation-long"
        ? "Тег не длиннее 64 символов"
        : "";
  const allCollections = menuSets[menuSetIndex];
  const filteredCollections = useMemo(() => {
    if (prototypeState === "no-results") return [];
    if (activeTab === "favorites") {
      return allCollections.filter((collection) => favorites.includes(collection.id));
    }
    const normalizedTag = tag.trim().toLocaleLowerCase("ru");
    if (!normalizedTag) return allCollections;
    return allCollections.filter((collection) =>
      collection.tags.some((item) => item.toLocaleLowerCase("ru") === normalizedTag),
    );
  }, [activeTab, allCollections, favorites, prototypeState, tag]);

  const changePrototypeState = (value: string) => {
    const next = value as PrototypeState;
    setPrototypeState(next);
    setActiveTab("all");
    setCartMessage("");
    if (next === "success") setTag("ужин");
    if (next === "validation-empty") setTag("");
    if (next === "validation-long") setTag("оченьдлинныйтег".repeat(6));
    if (next === "no-results") setTag("праздничный");
    if (next === "empty-favorites") setActiveTab("favorites");
  };

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (prototypeState === "loading") return;
    if (!tag.trim()) {
      setPrototypeState("validation-empty");
      return;
    }
    if (tag.length > 64) {
      setPrototypeState("validation-long");
      return;
    }
    setPrototypeState("submitting");
    window.setTimeout(() => {
      const found = menuSets[menuSetIndex].some((collection) =>
        collection.tags.some((item) => item.toLocaleLowerCase("ru") === tag.trim().toLocaleLowerCase("ru")),
      );
      setPrototypeState(found ? "success" : "no-results");
      setActiveTab("all");
    }, 450);
  };

  const resetSearch = () => {
    setTag("");
    setPrototypeState("success");
    setActiveTab("all");
  };

  const retryLoad = () => {
    setPrototypeState("submitting");
    window.setTimeout(() => setPrototypeState("success"), 500);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((favorite) => favorite !== id) : [...current, id],
    );
  };

  const addToCart = (id: string) => {
    setCartMessage("");
    if (prototypeState === "cart-error") setPrototypeState("success");
    setCartMessage(id);
    window.setTimeout(() => setCartMessage(""), 2600);
  };

  const tagsDisabled = formDisabled;
  const shouldShowSkeletons = prototypeState === "loading" || prototypeState === "submitting";
  const showNoResults = prototypeState === "no-results";
  const showEmptyFavorites =
    prototypeState === "empty-favorites" || (activeTab === "favorites" && favorites.length === 0);
  const isValidationState =
    prototypeState === "validation-empty" || prototypeState === "validation-long";
  const isErrorState =
    prototypeState === "filter-error" ||
    prototypeState === "load-error" ||
    prototypeState === "cart-error";
  const showCollectionCount = !isBusy && !isValidationState && !isErrorState;
  const cartMessageCollection = allCollections.find((collection) => collection.id === cartMessage);
  const statusText = (() => {
    if (prototypeState === "success" && activeTab === "all") {
      return tag
        ? `Показаны подборки по тегу «${tag}»`
        : "Показаны все подборки";
    }
    if (prototypeState === "submitting") return "Ищем подходящие подборки…";
    if (prototypeState === "no-results") return `По тегу «${tag}» ничего не найдено`;
    return "";
  })();

  return (
    <main className="fc-app">
      <div className="fc-shell">
        <div className="fc-topline">
          <span className="fc-topline-mark"><Leaf size={16} aria-hidden="true" /></span>
          Подборки продуктов
        </div>

        <aside className="fc-prototype" aria-label="Переключатель состояния прототипа">
          <Label htmlFor="prototype-state" className="fc-prototype-label">Состояние · только для прототипа</Label>
          <Select value={prototypeState} onValueChange={changePrototypeState}>
            <SelectTrigger id="prototype-state" className="fc-prototype-trigger" aria-label="Состояние · только для прототипа">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="fc-prototype-menu">
              {(Object.keys(stateLabels) as PrototypeState[]).map((state) => (
                <SelectItem value={state} key={state}>{stateLabels[state]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </aside>

        <header className="fc-hero">
          <div>
            <div className="fc-eyebrow">Меню начинается с идеи</div>
            <h1 className="fc-title">Что приготовить сегодня?</h1>
            <p className="fc-subtitle">
              Готовые наборы продуктов для простых рецептов — выберите настроение и соберите корзину.
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            className="fc-extra-button"
            onClick={() => {
              setMenuSetIndex((index) => (index + 1) % menuSets.length);
              setTag(menuSets[(menuSetIndex + 1) % menuSets.length][0].tags[0]);
              setPrototypeState("success");
              setActiveTab("all");
            }}
          >
            Ещё подборки <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </header>

        <section aria-label="Поиск подборок">
          <div className="fc-toolbar">
            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                setActiveTab(value);
                if (prototypeState === "empty-favorites") setPrototypeState("success");
              }}
            >
              <TabsList className="fc-tabs-list" aria-label="Фильтр подборок">
                <TabsTrigger value="all">Все</TabsTrigger>
                <TabsTrigger value="favorites">
                  Избранное<span className="fc-tab-count" aria-label={`${favorites.length} в избранном`}>({favorites.length})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab !== "favorites" && <form className="fc-search-form" onSubmit={search} noValidate>
              <div className="fc-field">
                <Label htmlFor="food-tag" className="fc-label">Тег</Label>
                <Input
                  id="food-tag"
                  className="fc-input"
                  value={tag}
                  onChange={(event) => {
                    setTag(event.target.value);
                    if (
                      prototypeState === "validation-empty" ||
                      prototypeState === "validation-long" ||
                      prototypeState === "no-results"
                    ) {
                      setPrototypeState("success");
                    }
                  }}
                  placeholder="Например, ужин"
                  aria-invalid={Boolean(validationError)}
                  aria-describedby={validationError ? "food-tag-error food-tag-count" : "food-tag-count"}
                  disabled={formDisabled}
                />
                <div className="fc-field-meta">
                  {validationError && <p className="fc-form-error" id="food-tag-error">{validationError}</p>}
                  <span className="fc-field-counter" id="food-tag-count">{tag.length}/64</span>
                </div>
              </div>
              <Button
                type="submit"
                className="fc-btn"
                disabled={isBusy}
                aria-busy={prototypeState === "submitting"}
              >
                {prototypeState === "submitting" ? (
                  <><RefreshCw size={15} className="animate-spin" aria-hidden="true" /> Найти</>
                ) : "Найти"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="fc-btn fc-btn-secondary"
                disabled={formDisabled}
                onClick={resetSearch}
              >
                Сбросить
              </Button>
            </form>}
          </div>

          {activeTab !== "favorites" && (
            <div className="fc-tags" aria-label="Популярные теги">
              <span className="fc-tags-label">Популярное:</span>
              {tagOptions.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant="outline"
                  className="fc-tag-chip"
                  disabled={tagsDisabled}
                  aria-pressed={tag === item}
                  onClick={() => {
                    setTag(item);
                    if (prototypeState !== "loading") setPrototypeState("success");
                  }}
                >
                  {item}
                </Button>
              ))}
            </div>
          )}
        </section>

        {prototypeState === "load-error" && (
          <Alert variant="destructive" className="fc-load-error">
            <CircleAlert size={18} aria-hidden="true" />
            <AlertDescription>Не удалось загрузить подборки. Попробуйте ещё раз.</AlertDescription>
            <Button type="button" variant="outline" className="fc-btn fc-btn-secondary" onClick={retryLoad}>
              Повторить
            </Button>
          </Alert>
        )}

        {statusText && (
          <Alert className="fc-notice" aria-live="polite">
            {prototypeState === "no-results"
              ? <CircleAlert size={16} aria-hidden="true" />
              : <Check size={16} aria-hidden="true" />}
            <AlertDescription>{statusText}</AlertDescription>
          </Alert>
        )}

        <div className="fc-result-line" aria-live="polite">
          {showCollectionCount && <span>{collectionCountLabel(filteredCollections.length)}</span>}
        </div>

        {prototypeState === "filter-error" && (
          <Alert variant="destructive" className="fc-load-error">
            <CircleAlert size={18} aria-hidden="true" />
            <AlertDescription>Не удалось применить фильтр.</AlertDescription>
            <Button type="button" variant="outline" className="fc-btn fc-btn-secondary" onClick={resetSearch}>
              Сбросить фильтр
            </Button>
          </Alert>
        )}
        {cartMessageCollection && (
          <Alert className="fc-notice">
            <Check size={16} aria-hidden="true" />
            <AlertDescription>«{cartMessageCollection.name}» добавлена в корзину</AlertDescription>
          </Alert>
        )}

        {showNoResults ? (
          <div className="fc-empty-state">
            <div className="fc-empty-mark"><CookingPot size={22} aria-hidden="true" /></div>
            <h2>Попробуйте другой тег</h2>
            <p>Например, «ужин» или «быстро».</p>
            <Button
              type="button"
              className="fc-btn"
              onClick={() => {
                setTag("");
                setPrototypeState("success");
              }}
            >
              Сбросить фильтр
            </Button>
          </div>
        ) : showEmptyFavorites ? (
          <div className="fc-empty-state">
            <div className="fc-empty-mark"><Heart size={22} aria-hidden="true" /></div>
            <h2>Пока пусто. Добавьте подборку в избранное</h2>
            <p>Нажмите на сердечко у понравившейся идеи.</p>
            <Button type="button" variant="outline" className="fc-btn fc-btn-secondary" onClick={() => setActiveTab("all")}>
              Смотреть все подборки
            </Button>
          </div>
        ) : shouldShowSkeletons ? (
          <div className="fc-card-grid" aria-label="Подборки загружаются" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div className="fc-skeleton-card" key={item}>
                <div className="fc-skeleton-row">
                  <Skeleton className="h-8 w-8 rounded-xl" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-7 w-1/2 rounded-full" />
                <div className="grid gap-3 pt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <div className="mt-auto"><Skeleton className="h-12 w-full rounded-full" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="fc-card-grid">
            {filteredCollections.map((collection) => {
              const total = collection.items.reduce((sum, item) => sum + item.price, 0);
              const isFavorite = favorites.includes(collection.id);
              const cartPending = prototypeState === "cart-pending" && collection.id === filteredCollections[0]?.id;
              const hasCartError = prototypeState === "cart-error" && collection.id === filteredCollections[0]?.id;
              return (
                <div className="fc-card-wrap" key={collection.id}>
                  <Card className="fc-card">
                    <div className="fc-card-top">
                      <div className="fc-card-heading" style={{ padding: 0, minWidth: 0 }}>
                        <h2 className="fc-card-title">{collection.name}</h2>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="fc-heart"
                        data-favorite={isFavorite}
                        aria-label={isFavorite ? `Убрать «${collection.name}» из избранного` : `Добавить «${collection.name}» в избранное`}
                        aria-pressed={isFavorite}
                        onClick={() => toggleFavorite(collection.id)}
                      >
                        <Heart size={19} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
                      </Button>
                    </div>
                    <p className="fc-card-subtitle" style={{ marginTop: 0, paddingInline: 24 }}>
                      {collection.subtitle}
                    </p>
                    <div className="fc-card-badges">
                      {collection.tags.map((item) => <Badge className="fc-badge" key={item}>{item}</Badge>)}
                    </div>
                    <ul className="fc-items" aria-label="Продукты в подборке">
                      {collection.items.map((item) => (
                        <li
                          key={`${item.name}-${item.quantity}`}
                          style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "baseline" }}
                        >
                          <span className="fc-item-name">{item.name}</span>
                          <span style={{ color: "var(--fc-muted)", whiteSpace: "nowrap" }}>{item.quantity}</span>
                          <span className="fc-item-price">{money(item.price)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="fc-card-total">
                      <div>
                        <span className="fc-total-label">Итого</span>
                        <strong className="fc-total-price">{money(total)}</strong>
                      </div>
                      <span className="fc-budget">
                        {collection.budget == null ? "Без лимита" : `Лимит ${money(collection.budget)}`}
                      </span>
                    </div>
                    <div className="fc-card-footer">
                      <Button
                        type="button"
                        className="fc-cart-button"
                        disabled={cartPending}
                        onClick={() => addToCart(collection.id)}
                      >
                        {cartPending ? (
                          <><RefreshCw size={16} className="animate-spin" aria-hidden="true" /> Собираем корзину…</>
                        ) : (
                          <><ShoppingBasket size={17} aria-hidden="true" /> В корзину</>
                        )}
                      </Button>
                    </div>
                  </Card>
                  {hasCartError && (
                    <p className="fc-card-error" role="alert">
                      Не получилось собрать корзину. Попробуйте ещё раз.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <footer className="fc-footer">
          <span className="fc-footer-note"><Sparkles size={15} aria-hidden="true" /> Учебный проект · цены указаны для примера</span>
          <span>Идеи для простых домашних блюд</span>
        </footer>
      </div>

    </main>
  );
}
