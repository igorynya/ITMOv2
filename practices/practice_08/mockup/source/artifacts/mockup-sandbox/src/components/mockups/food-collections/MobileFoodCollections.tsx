import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CookingPot,
  Heart,
  Leaf,
  RefreshCw,
  Salad,
  ShoppingBasket,
  Sparkles,
  Soup,
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
import "./mobilefoodcollections.css";

type PrototypeState =
  | "success"
  | "loading"
  | "validation-empty"
  | "validation-long"
  | "submitting"
  | "no-results"
  | "empty-favorites"
  | "load-error"
  | "cart-pending"
  | "cart-error";

type Item = { name: string; price: number };
type Collection = {
  id: string;
  name: string;
  subtitle: string;
  tags: string[];
  portions: string;
  items: Item[];
  budget: number;
  mark: "soup" | "salad" | "pot";
};

const menuSets: Collection[][] = [
  [
    {
      id: "warm-salad",
      name: "Тёплый ужин без суеты",
      subtitle: "Запечённая курица, картофель и хрустящий салат.",
      tags: ["ужин", "просто", "сытно"],
      portions: "2 порции · 30 минут",
      items: [
        { name: "Филе куриное, 400 г", price: 219 },
        { name: "Картофель, 500 г", price: 68 },
        { name: "Огурцы, 2 шт.", price: 76 },
        { name: "Сметана, 180 г", price: 89 },
      ],
      budget: 520,
      mark: "pot",
    },
    {
      id: "tomato-pasta",
      name: "Паста с томатами",
      subtitle: "Яркий соус, свежий базилик и немного пармезана.",
      tags: ["ужин", "бюджет", "быстро", "вегетарианское"],
      portions: "2 порции · 20 минут",
      items: [
        { name: "Паста, 250 г", price: 94 },
        { name: "Томаты, 400 г", price: 149 },
        { name: "Сыр твёрдый, 80 г", price: 138 },
        { name: "Базилик, 1 пучок", price: 79 },
      ],
      budget: 520,
      mark: "soup",
    },
    {
      id: "apple-oats",
      name: "Овсянка с яблоком",
      subtitle: "Тёплые хлопья с мёдом и хрустящими орехами.",
      tags: ["завтрак", "бюджет", "быстро"],
      portions: "2 порции · 12 минут",
      items: [
        { name: "Овсяные хлопья, 200 г", price: 78 },
        { name: "Яблоки, 2 шт.", price: 64 },
        { name: "Мёд, 100 г", price: 96 },
        { name: "Йогурт натуральный, 150 г", price: 82 },
      ],
      budget: 360,
      mark: "soup",
    },
    {
      id: "fish-bowl",
      name: "Рыба и овощи на противне",
      subtitle: "Минимум посуды, максимум цвета на тарелке.",
      tags: ["ужин", "полезно", "духовка"],
      portions: "2 порции · 35 минут",
      items: [
        { name: "Филе трески, 350 г", price: 289 },
        { name: "Перец сладкий, 2 шт.", price: 118 },
        { name: "Кабачок, 1 шт.", price: 92 },
        { name: "Лимон, 1 шт.", price: 54 },
      ],
      budget: 650,
      mark: "salad",
    },
  ],
  [
    {
      id: "breakfast-oats",
      name: "Завтрак с яблоком",
      subtitle: "Тёплая овсянка с орехами и мёдом.",
      tags: ["завтрак", "быстро", "сытно"],
      portions: "2 порции · 12 минут",
      items: [
        { name: "Овсяные хлопья, 200 г", price: 78 },
        { name: "Яблоки, 2 шт.", price: 64 },
        { name: "Орехи, 60 г", price: 119 },
        { name: "Мёд, 100 г", price: 96 },
      ],
      budget: 410,
      mark: "soup",
    },
    {
      id: "lunch-bowl",
      name: "Обеденная тарелка",
      subtitle: "Гречка, грибы и соус из зелени.",
      tags: ["обед", "вегетарианское", "просто"],
      portions: "2 порции · 25 минут",
      items: [
        { name: "Гречка, 200 г", price: 72 },
        { name: "Шампиньоны, 250 г", price: 145 },
        { name: "Йогурт натуральный, 150 г", price: 82 },
        { name: "Укроп, 1 пучок", price: 39 },
      ],
      budget: 430,
      mark: "salad",
    },
    {
      id: "soup-day",
      name: "Суп на два дня",
      subtitle: "Нежный суп из чечевицы с паприкой.",
      tags: ["обед", "заготовка", "полезно"],
      portions: "4 порции · 40 минут",
      items: [
        { name: "Чечевица, 250 г", price: 129 },
        { name: "Морковь, 2 шт.", price: 38 },
        { name: "Лук репчатый, 2 шт.", price: 31 },
        { name: "Сливки, 200 мл", price: 115 },
      ],
      budget: 400,
      mark: "pot",
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
  "empty-favorites": "Пустое избранное",
  "load-error": "Ошибка загрузки",
  "cart-pending": "Собираем корзину",
  "cart-error": "Ошибка корзины",
};

function money(value: number) {
  return `${value} ₽`;
}

function CollectionMark({ mark }: { mark: Collection["mark"] }) {
  if (mark === "soup") return <Soup size={16} aria-hidden="true" />;
  if (mark === "salad") return <Salad size={16} aria-hidden="true" />;
  return <CookingPot size={16} aria-hidden="true" />;
}

export function MobileFoodCollections() {
  const [prototypeState, setPrototypeState] = useState<PrototypeState>("success");
  const [tag, setTag] = useState("ужин");
  const [activeTab, setActiveTab] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [menuSetIndex, setMenuSetIndex] = useState(0);
  const [cartMessage, setCartMessage] = useState("");
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const isBusy = prototypeState === "loading" || prototypeState === "submitting";
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
    setActiveTab(next === "empty-favorites" ? "favorites" : "all");
    setCartMessage("");
    if (next === "success") setTag("ужин");
    if (next === "validation-empty") setTag("");
    if (next === "validation-long") setTag("оченьдлинныйтег".repeat(6));
    if (next === "no-results") setTag("праздничный");
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

  const statusText =
    prototypeState === "success"
      ? tag
        ? `Подборки по тегу «${tag}»`
        : "Все подборки"
      : prototypeState === "submitting"
        ? "Ищем подходящие подборки…"
        : prototypeState === "no-results"
          ? `По тегу «${tag}» ничего не найдено`
          : activeTab === "favorites"
            ? `В избранном: ${filteredCollections.length}`
            : "Выберите продукты для своего меню";
  const showEmptyFavorites =
    prototypeState === "empty-favorites" || (activeTab === "favorites" && favorites.length === 0);

  return (
    <main className="mfc-app">
      <div className="mfc-shell">
        <div className="mfc-topline">
          <span className="mfc-brand-mark"><Leaf size={15} aria-hidden="true" /></span>
          <span>Домашнее меню</span>
          <span className="mfc-topline-rule" aria-hidden="true" />
          <span className="mfc-topline-count">01 / идеи</span>
        </div>

        <aside className="mfc-prototype" aria-label="Переключатель состояния прототипа">
          <Label htmlFor="mfc-prototype-state" className="mfc-prototype-label">Состояние прототипа</Label>
          <Select value={prototypeState} onValueChange={changePrototypeState}>
            <SelectTrigger id="mfc-prototype-state" className="mfc-prototype-trigger" aria-label="Состояние прототипа">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(stateLabels) as PrototypeState[]).map((state) => (
                <SelectItem value={state} key={state}>{stateLabels[state]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </aside>

        <header className="mfc-hero">
          <div className="mfc-eyebrow"><span aria-hidden="true" /> ПОДБОРКИ ПРОДУКТОВ</div>
          <h1>Что приготовить<br /><em>сегодня?</em></h1>
          <p>Хороший ужин начинается с короткого списка. Выберите идею — продукты уже собраны.</p>
          <Button
            type="button"
            variant="outline"
            className="mfc-next-button"
            onClick={() => {
              const nextIndex = (menuSetIndex + 1) % menuSets.length;
              setMenuSetIndex(nextIndex);
              setTag(menuSets[nextIndex][0].tags[0]);
              setPrototypeState("success");
              setActiveTab("all");
            }}
          >
            Другие идеи <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </header>

        <section className="mfc-controls" aria-label="Поиск и фильтр подборок">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value);
              if (prototypeState === "empty-favorites") setPrototypeState("success");
            }}
          >
            <TabsList className="mfc-tabs" aria-label="Фильтр подборок">
              <TabsTrigger value="all">Все</TabsTrigger>
              <TabsTrigger value="favorites">
                Избранное <span aria-label={`${favorites.length} в избранном`}>{favorites.length}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form className="mfc-search" onSubmit={search} noValidate>
            <Label htmlFor="mfc-tag">Найти по тегу</Label>
            <div className="mfc-search-row">
              <Input
                id="mfc-tag"
                className="mfc-input"
                value={tag}
                onChange={(event) => {
                  setTag(event.target.value);
                  if (["validation-empty", "validation-long", "no-results"].includes(prototypeState)) {
                    setPrototypeState("success");
                  }
                }}
                placeholder="Например, ужин"
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? "mfc-tag-error" : undefined}
                disabled={prototypeState === "loading"}
              />
              <Button type="submit" className="mfc-search-button" disabled={isBusy} aria-busy={prototypeState === "submitting"}>
                {prototypeState === "submitting" ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : "Найти"}
              </Button>
            </div>
            {validationError && <p className="mfc-form-error" id="mfc-tag-error">{validationError}</p>}
          </form>

          <div className="mfc-chips" aria-label="Популярные теги">
            {tagOptions.map((item) => (
              <Button
                key={item}
                type="button"
                variant="outline"
                className="mfc-chip"
                disabled={prototypeState === "loading"}
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
        </section>

        {prototypeState === "load-error" && (
          <Alert variant="destructive" className="mfc-alert mfc-error-alert">
            <CircleAlert size={18} aria-hidden="true" />
            <AlertDescription>Не удалось загрузить подборки. Попробуйте ещё раз.</AlertDescription>
            <Button type="button" variant="outline" onClick={retryLoad}>Повторить</Button>
          </Alert>
        )}
        {prototypeState === "success" && (
          <Alert className="mfc-alert mfc-success-alert">
            <Check size={16} aria-hidden="true" />
            <AlertDescription>{statusText}</AlertDescription>
          </Alert>
        )}

        <div className="mfc-result-line" aria-live="polite">
          <strong>{statusText}</strong>
          {prototypeState !== "loading" && prototypeState !== "no-results" && !showEmptyFavorites && (
            <span>{filteredCollections.length} {filteredCollections.length === 1 ? "идея" : "идеи"}</span>
          )}
        </div>

        {prototypeState === "no-results" ? (
          <div className="mfc-empty">
            <div className="mfc-empty-mark"><CookingPot size={22} aria-hidden="true" /></div>
            <h2>Пока нет такой идеи</h2>
            <p>Попробуйте «ужин», «завтрак» или «быстро».</p>
            <Button type="button" className="mfc-main-button" onClick={() => { setTag(""); setPrototypeState("success"); }}>
              Сбросить фильтр
            </Button>
          </div>
        ) : showEmptyFavorites ? (
          <div className="mfc-empty">
            <div className="mfc-empty-mark"><Heart size={22} aria-hidden="true" /></div>
            <h2>Здесь пока тихо</h2>
            <p>Сохраните понравившуюся подборку сердечком.</p>
            <Button type="button" variant="outline" onClick={() => setActiveTab("all")}>Смотреть все</Button>
          </div>
        ) : prototypeState === "loading" ? (
          <div className="mfc-card-list" aria-label="Подборки загружаются" aria-busy="true">
            {[0, 1].map((item) => (
              <div className="mfc-skeleton" key={item}>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-8 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mfc-card-list">
            {filteredCollections.map((collection, index) => {
              const total = collection.items.reduce((sum, item) => sum + item.price, 0);
              const isFavorite = favorites.includes(collection.id);
              const cartPending = prototypeState === "cart-pending" && collection.id === allCollections[0].id;
              const hasCartError = prototypeState === "cart-error" && collection.id === allCollections[0].id;
              const isExpanded = expandedItems.includes(collection.id);
              const detailsId = `mfc-items-${collection.id}`;
              return (
                <Card className="mfc-card" key={collection.id}>
                  <div className="mfc-card-topline">
                    <span className="mfc-card-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="mfc-card-meta">
                      <span className="mfc-mark"><CollectionMark mark={collection.mark} /></span>
                      {collection.portions}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mfc-heart"
                      data-favorite={isFavorite}
                      aria-label={isFavorite ? `Убрать «${collection.name}» из избранного` : `Добавить «${collection.name}» в избранное`}
                      aria-pressed={isFavorite}
                      onClick={() => toggleFavorite(collection.id)}
                    >
                      <Heart size={19} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mfc-card-content">
                    <h2>{collection.name}</h2>
                    <p className="mfc-card-subtitle">{collection.subtitle}</p>
                    <div className="mfc-card-tags">
                      {collection.tags.slice(0, 3).map((item) => <Badge className="mfc-badge" key={item}>{item}</Badge>)}
                      {collection.tags.length > 3 && <span className="mfc-more-tags">+{collection.tags.length - 3}</span>}
                    </div>
                  </div>

                  <div className="mfc-price-strip">
                    <div>
                      <span className="mfc-total-label">Примерно</span>
                      <strong>{money(total)}</strong>
                    </div>
                    <span className="mfc-budget">Бюджет <b>до {money(collection.budget)}</b></span>
                  </div>

                  <div className="mfc-ingredients">
                    <button
                      type="button"
                      className="mfc-disclosure"
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      onClick={() => setExpandedItems((current) =>
                        current.includes(collection.id)
                          ? current.filter((id) => id !== collection.id)
                          : [...current, collection.id],
                      )}
                    >
                      <span>Продукты <span className="mfc-ingredient-count">{collection.items.length}</span></span>
                      <ChevronDown size={17} aria-hidden="true" />
                    </button>
                    {isExpanded && (
                      <ul id={detailsId} className="mfc-items" aria-label={`Продукты для набора «${collection.name}»`}>
                        {collection.items.map((item) => (
                          <li key={item.name}>
                            <span>{item.name}</span><strong>{money(item.price)}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mfc-card-footer">
                    {hasCartError && <span className="mfc-card-error" role="alert">Не удалось добавить. Попробуйте ещё раз.</span>}
                    <Button
                      type="button"
                      className="mfc-cart-button"
                      disabled={cartPending}
                      onClick={() => addToCart(collection.id)}
                    >
                      {cartPending
                        ? <><RefreshCw size={16} className="animate-spin" aria-hidden="true" /> Собираем…</>
                        : <><ShoppingBasket size={17} aria-hidden="true" /> Добавить в корзину</>}
                    </Button>
                    <div className="mfc-cart-confirm" aria-live="polite">
                      {cartMessage === collection.id ? "Подборка добавлена в корзину" : "\u00a0"}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <footer className="mfc-footer">
          <span><Sparkles size={14} aria-hidden="true" /> Цены для примера</span>
          <span>Идеи для домашних блюд</span>
        </footer>
      </div>
    </main>
  );
}
