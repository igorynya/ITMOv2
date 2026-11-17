import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Heart,
  Leaf,
  Minus,
  Plus,
  ShoppingBasket,
  Sparkles,
  Utensils,
} from "lucide-react";
import "./MenuJourney.css";

type MealKind = "Завтрак" | "Обед" | "Ужин";

type Recipe = {
  id: string;
  meal: MealKind;
  name: string;
  description: string;
  time: number;
  tags: string[];
  vegetarian: boolean;
  items: { name: string; amount: string; price: number }[];
};

const recipes: Recipe[] = [
  {
    id: "warm-salad",
    meal: "Ужин",
    name: "Тёплый ужин без суеты",
    description: "Запечённая курица, молодой картофель и хрустящий салат.",
    time: 30,
    tags: ["ужин", "сытно", "духовка"],
    vegetarian: false,
    items: [
      { name: "Филе куриное", amount: "400 г", price: 219 },
      { name: "Картофель", amount: "500 г", price: 68 },
      { name: "Огурцы", amount: "2 шт.", price: 76 },
      { name: "Сметана", amount: "180 г", price: 89 },
    ],
  },
  {
    id: "tomato-pasta",
    meal: "Ужин",
    name: "Паста с томатами",
    description: "Яркий соус, свежий базилик и немного твёрдого сыра.",
    time: 20,
    tags: ["ужин", "быстро", "бюджет"],
    vegetarian: true,
    items: [
      { name: "Паста", amount: "250 г", price: 94 },
      { name: "Томаты", amount: "400 г", price: 149 },
      { name: "Сыр твёрдый", amount: "80 г", price: 138 },
      { name: "Базилик", amount: "1 пучок", price: 79 },
    ],
  },
  {
    id: "fish-tray",
    meal: "Ужин",
    name: "Рыба и овощи на противне",
    description: "Минимум посуды, много цвета и лимонная корочка.",
    time: 35,
    tags: ["ужин", "полезно", "духовка"],
    vegetarian: false,
    items: [
      { name: "Филе трески", amount: "350 г", price: 289 },
      { name: "Перец сладкий", amount: "2 шт.", price: 118 },
      { name: "Кабачок", amount: "1 шт.", price: 92 },
      { name: "Лимон", amount: "1 шт.", price: 54 },
    ],
  },
  {
    id: "apple-oats",
    meal: "Завтрак",
    name: "Овсянка с яблоком",
    description: "Тёплые хлопья с мёдом, йогуртом и хрустящими орехами.",
    time: 12,
    tags: ["завтрак", "быстро", "сытно"],
    vegetarian: true,
    items: [
      { name: "Овсяные хлопья", amount: "200 г", price: 78 },
      { name: "Яблоки", amount: "2 шт.", price: 64 },
      { name: "Орехи", amount: "60 г", price: 119 },
      { name: "Мёд", amount: "100 г", price: 96 },
    ],
  },
  {
    id: "green-toast",
    meal: "Завтрак",
    name: "Тосты с авокадо",
    description: "Хрустящий хлеб, яйцо и зелёный соус с лимоном.",
    time: 15,
    tags: ["завтрак", "быстро"],
    vegetarian: true,
    items: [
      { name: "Хлеб зерновой", amount: "4 ломтика", price: 89 },
      { name: "Авокадо", amount: "1 шт.", price: 179 },
      { name: "Яйца", amount: "2 шт.", price: 54 },
      { name: "Лимон", amount: "1 шт.", price: 54 },
    ],
  },
  {
    id: "lunch-bowl",
    meal: "Обед",
    name: "Обеденная тарелка",
    description: "Гречка, грибы и прохладный соус из зелени.",
    time: 25,
    tags: ["обед", "просто", "сытно"],
    vegetarian: true,
    items: [
      { name: "Гречка", amount: "200 г", price: 72 },
      { name: "Шампиньоны", amount: "250 г", price: 145 },
      { name: "Йогурт натуральный", amount: "150 г", price: 82 },
      { name: "Укроп", amount: "1 пучок", price: 39 },
    ],
  },
  {
    id: "lentil-soup",
    meal: "Обед",
    name: "Суп из красной чечевицы",
    description: "Нежный, пряный и сразу на два обеда.",
    time: 40,
    tags: ["обед", "заготовка", "полезно"],
    vegetarian: true,
    items: [
      { name: "Чечевица", amount: "250 г", price: 129 },
      { name: "Морковь", amount: "2 шт.", price: 38 },
      { name: "Лук репчатый", amount: "2 шт.", price: 31 },
      { name: "Сливки", amount: "200 мл", price: 115 },
    ],
  },
];

const mealOptions: { name: MealKind; note: string }[] = [
  { name: "Завтрак", note: "Начать день мягко" },
  { name: "Обед", note: "Перезагрузиться днём" },
  { name: "Ужин", note: "Собраться за столом" },
];

const money = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;

export function MenuJourney() {
  const [step, setStep] = useState(1);
  const [meal, setMeal] = useState<MealKind>("Ужин");
  const [people, setPeople] = useState(2);
  const [vegetarianOnly, setVegetarianOnly] = useState(false);
  const [quickOnly, setQuickOnly] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [confirmed, setConfirmed] = useState(false);

  const visibleRecipes = useMemo(
    () =>
      recipes.filter((recipe) => {
        if (recipe.meal !== meal) return false;
        if (vegetarianOnly && !recipe.vegetarian) return false;
        if (quickOnly && recipe.time > 30) return false;
        return true;
      }),
    [meal, vegetarianOnly, quickOnly],
  );

  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId);
  const basketItems =
    selectedRecipe?.items.filter((item) => (quantities[item.name] ?? 0) > 0) ?? [];
  const portionScale = people / 2;
  const basketTotal = basketItems.reduce(
    (sum, item) => sum + item.price * portionScale * (quantities[item.name] ?? 0),
    0,
  );

  const openRecipes = () => {
    setSelectedRecipeId("");
    setStep(2);
  };

  const buildBasket = () => {
    if (!selectedRecipe) return;
    setQuantities(Object.fromEntries(selectedRecipe.items.map((item) => [item.name, 1])));
    setConfirmed(false);
    setStep(3);
  };

  const setQuantity = (name: string, amount: number) => {
    setQuantities((current) => ({ ...current, [name]: Math.max(0, amount) }));
    setConfirmed(false);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((favorite) => favorite !== id) : [...current, id],
    );
  };

  return (
    <main className="mj-app">
      <div className="mj-shell">
        <header className="mj-header">
          <div className="mj-brand">
            <span className="mj-brand-mark"><Leaf size={18} aria-hidden="true" /></span>
            Домашнее меню
          </div>
          <span className="mj-head-note">ПОДБОРКИ ПРОДУКТОВ · 01</span>
        </header>

        <section className="mj-intro">
          <div>
            <div className="mj-eyebrow"><Sparkles size={14} aria-hidden="true" /> Пара минут — и план готов</div>
            <h1 className="mj-title">Сегодня на столе —<br /><em>что-то хорошее.</em></h1>
          </div>
          <p className="mj-intro-aside">
            Выберите повод, найдите блюдо по настроению — мы соберём список продуктов.
          </p>
        </section>

        <nav className="mj-steps" aria-label="Шаги подбора меню">
          {[
            { number: 1, title: "Повод" },
            { number: 2, title: "Подборка" },
            { number: 3, title: "Продукты" },
          ].map((item) => {
            const allowed = item.number === 1 || (item.number === 2 && step >= 2) || (item.number === 3 && step === 3);
            return (
              <button
                type="button"
                key={item.number}
                className="mj-step"
                data-active={step === item.number}
                data-complete={step > item.number}
                disabled={!allowed}
                onClick={() => setStep(item.number)}
                aria-current={step === item.number ? "step" : undefined}
              >
                <span className="mj-step-number">{step > item.number ? <Check size={13} aria-hidden="true" /> : `0${item.number}`}</span>
                <span className="mj-step-name">{item.title}</span>
              </button>
            );
          })}
        </nav>

        {step === 1 && (
          <section className="mj-panel" aria-labelledby="mj-step-one-title">
            <div className="mj-panel-heading">
              <div>
                <h2 className="mj-panel-title" id="mj-step-one-title">Для какого момента?</h2>
                <p className="mj-panel-copy">С чего начнём сегодняшний список?</p>
              </div>
            </div>

            <div className="mj-meal-grid">
              {mealOptions.map((option, index) => (
                <button
                  type="button"
                  key={option.name}
                  className="mj-meal-option"
                  data-selected={meal === option.name}
                  aria-pressed={meal === option.name}
                  onClick={() => setMeal(option.name)}
                >
                  <span className="mj-meal-num">0{index + 1} / МЕНЮ</span>
                  <span className="mj-meal-icon">
                    {index === 0 ? <Sparkles size={20} aria-hidden="true" /> : index === 1 ? <Leaf size={20} aria-hidden="true" /> : <Utensils size={20} aria-hidden="true" />}
                  </span>
                  <span className="mj-meal-name">{option.name}</span>
                  <span className="mj-meal-meta">{option.note}</span>
                  <span className="mj-choice-check">{meal === option.name && <Check size={14} aria-hidden="true" />}</span>
                </button>
              ))}
            </div>

            <div className="mj-config-row">
              <span className="mj-config-label">На сколько человек готовим?</span>
              <div className="mj-counter" aria-label="Количество человек">
                <button type="button" aria-label="Уменьшить количество человек" disabled={people <= 2} onClick={() => setPeople((value) => Math.max(2, value - 2))}>
                  <Minus size={14} aria-hidden="true" />
                </button>
                <strong>{people} человека</strong>
                <button type="button" aria-label="Увеличить количество человек" disabled={people >= 6} onClick={() => setPeople((value) => Math.min(6, value + 2))}>
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mj-actions">
              <span className="mj-step-hint">Подборки рассчитаны на {people} {people === 2 ? "порции" : "порций"}</span>
              <button type="button" className="mj-button" onClick={openRecipes}>
                К подборкам <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="mj-panel" aria-labelledby="mj-step-two-title">
            <div className="mj-panel-heading">
              <div>
                <h2 className="mj-panel-title" id="mj-step-two-title">Что звучит вкусно?</h2>
                <p className="mj-panel-copy">{meal} · {people} {people === 2 ? "порции" : "порций"} · выберите одну идею</p>
              </div>
              <button type="button" className="mj-button mj-button-quiet" onClick={() => setStep(1)}>
                <ArrowLeft size={15} aria-hidden="true" /> Назад
              </button>
            </div>

            <div className="mj-filter-row" aria-label="Фильтры подборок">
              <button type="button" className="mj-filter" data-active={quickOnly} aria-pressed={quickOnly} onClick={() => setQuickOnly((value) => !value)}>
                <Clock3 size={13} aria-hidden="true" /> До 30 минут
              </button>
              <button type="button" className="mj-filter" data-active={vegetarianOnly} aria-pressed={vegetarianOnly} onClick={() => setVegetarianOnly((value) => !value)}>
                <Leaf size={13} aria-hidden="true" /> Без мяса
              </button>
              {favorites.length > 0 && <span className="mj-step-hint">{favorites.length} в избранном</span>}
            </div>

            {visibleRecipes.length > 0 ? (
              <div className="mj-recipe-grid">
                {visibleRecipes.map((recipe, index) => {
                  const active = selectedRecipeId === recipe.id;
                  const total = recipe.items.reduce((sum, item) => sum + item.price, 0) * portionScale;
                  return (
                    <article className="mj-recipe" data-selected={active} key={recipe.id}>
                      <div className="mj-recipe-top">
                        <span className="mj-recipe-index">ИДЕЯ 0{index + 1}</span>
                        <button
                          type="button"
                          className="mj-icon-button"
                          data-active={favorites.includes(recipe.id)}
                          aria-label={favorites.includes(recipe.id) ? `Убрать «${recipe.name}» из избранного` : `Добавить «${recipe.name}» в избранное`}
                          aria-pressed={favorites.includes(recipe.id)}
                          onClick={() => toggleFavorite(recipe.id)}
                        >
                          <Heart size={16} fill={favorites.includes(recipe.id) ? "currentColor" : "none"} aria-hidden="true" />
                        </button>
                      </div>
                      <span className="mj-recipe-emblem"><Utensils size={23} aria-hidden="true" /></span>
                      <h3>{recipe.name}</h3>
                      <p className="mj-recipe-desc">{recipe.description}</p>
                      <div className="mj-recipe-meta">
                        <span><Clock3 size={12} aria-hidden="true" /> {recipe.time} мин</span>
                        <span>{recipe.vegetarian ? "Без мяса" : "Сытный ужин"}</span>
                      </div>
                      <div className="mj-recipe-items">
                        {recipe.items.map((item) => <span className="mj-ingredient" key={item.name}>{item.name}</span>)}
                      </div>
                      <div className="mj-recipe-bottom">
                        <span className="mj-recipe-price"><small>Примерная стоимость</small><strong>{money(total)}</strong></span>
                        <button type="button" className="mj-pick-button" data-selected={active} aria-pressed={active} onClick={() => setSelectedRecipeId(recipe.id)}>
                          {active ? <><Check size={14} aria-hidden="true" /> Выбрано</> : "Выбрать"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mj-empty">
                <div>
                  <Leaf size={22} aria-hidden="true" />
                  <p>Под эти фильтры пока ничего не попало. Снимите один из фильтров — найдём ещё идеи.</p>
                  <button type="button" className="mj-button" onClick={() => { setQuickOnly(false); setVegetarianOnly(false); }}>
                    Показать все варианты
                  </button>
                </div>
              </div>
            )}

            <div className="mj-actions">
              <span className="mj-step-hint">{selectedRecipe ? `Выбрано: ${selectedRecipe.name}` : "Можно сохранить понравившееся сердечком"}</span>
              <button type="button" className="mj-button" disabled={!selectedRecipe} onClick={buildBasket}>
                К продуктам <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {step === 3 && selectedRecipe && (
          <section className="mj-panel" aria-labelledby="mj-step-three-title">
            <div className="mj-panel-heading">
              <div>
                <h2 className="mj-panel-title" id="mj-step-three-title">Список на готовку</h2>
                <p className="mj-panel-copy">{selectedRecipe.name} · {people} {people === 2 ? "порции" : "порций"}</p>
              </div>
              <button type="button" className="mj-button mj-button-quiet" onClick={() => setStep(2)}>
                <ArrowLeft size={15} aria-hidden="true" /> Другая подборка
              </button>
            </div>

            <div className="mj-basket-layout">
              <div className="mj-basket-list">
                <div className="mj-basket-list-head">
                  <h3>В корзину</h3>
                  <span>{basketItems.length} позиции</span>
                </div>
                {selectedRecipe.items.map((item) => {
                  const quantity = quantities[item.name] ?? 0;
                  if (!quantity) return null;
                  return (
                    <div className="mj-basket-line" key={item.name}>
                      <div className="mj-basket-product">
                        <span className="mj-product-dot" aria-hidden="true" />
                        <div><strong>{item.name}</strong><small>{item.amount} · {money(item.price)} за набор</small></div>
                      </div>
                      <div className="mj-quantity" aria-label={`Количество: ${item.name}`}>
                        <button type="button" aria-label={`Уменьшить количество: ${item.name}`} onClick={() => setQuantity(item.name, quantity - 1)}><Minus size={12} aria-hidden="true" /></button>
                        <span>{quantity}</span>
                        <button type="button" aria-label={`Увеличить количество: ${item.name}`} onClick={() => setQuantity(item.name, quantity + 1)}><Plus size={12} aria-hidden="true" /></button>
                      </div>
                      <strong className="mj-line-total">{money(item.price * portionScale * quantity)}</strong>
                    </div>
                  );
                })}
                {basketItems.length === 0 && (
                  <div className="mj-empty">
                    <div>
                      <ShoppingBasket size={22} aria-hidden="true" />
                      <p>Список пока пуст. Вернитесь к подборке и добавьте продукты заново.</p>
                      <button type="button" className="mj-button" onClick={() => setStep(2)}>Выбрать продукты</button>
                    </div>
                  </div>
                )}
              </div>

              <aside className="mj-summary">
                <p className="mj-summary-kicker">ваш план · 0{step}</p>
                <h3>Уже почти на столе.</h3>
                <div className="mj-summary-row"><span>Блюдо</span><strong>{selectedRecipe.name}</strong></div>
                <div className="mj-summary-row"><span>Порции</span><strong>{people}</strong></div>
                <div className="mj-summary-row"><span>Готовить</span><strong>{selectedRecipe.time} мин</strong></div>
                <div className="mj-summary-total"><span>Итого примерно</span><strong>{money(basketTotal)}</strong></div>
                <button type="button" className="mj-button" disabled={basketItems.length === 0} onClick={() => setConfirmed(true)}>
                  {confirmed ? <><Check size={16} aria-hidden="true" /> Список собран</> : <><ShoppingBasket size={16} aria-hidden="true" /> Собрать список</>}
                </button>
                {confirmed && <p className="mj-confirmed" role="status">Готово — продукты собраны в вашем списке. Можно менять количество или выбрать другое блюдо.</p>}
              </aside>
            </div>
            <div className="mj-actions">
              <span className="mj-step-hint">Цены ориентировочные и зависят от магазина</span>
              <button type="button" className="mj-button mj-button-quiet" onClick={() => { setStep(1); setSelectedRecipeId(""); setQuantities({}); setConfirmed(false); }}>
                Начать новый выбор <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        <footer className="mj-footnote">
          <span>Идеи для простых домашних блюд</span>
          <span>ПОДБОРКИ · {favorites.length} СОХРАНЕНО</span>
        </footer>
      </div>
    </main>
  );
}
