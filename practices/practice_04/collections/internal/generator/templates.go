package generator

type TemplateItem struct {
	Query     string
	Quantity  float64
	MinRating float64
	Optional  bool
}

type Template struct {
	Slug     string
	Title    string
	Subtitle string
	Budget   int
	Tags     []string
	Items    []TemplateItem
}

func Templates() []Template {
	return []Template{
		{
			Slug:     "dinner-500",
			Title:    "Ужин на двоих",
			Subtitle: "Простой ужин без лишних трат",
			Tags:     []string{"ужин", "бюджет"},
			Items: []TemplateItem{
				{Query: "куриное филе", Quantity: 1},
				{Query: "гречка", Quantity: 1},
				{Query: "овощи для жарки", Quantity: 1},
				{Query: "хлеб", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "friends-lunch",
			Title:    "Обед с друзьями",
			Subtitle: "Паста, салат и напитки на компанию",
			Budget:   1500,
			Tags:     []string{"обед", "компания"},
			Items: []TemplateItem{
				{Query: "паста", Quantity: 2},
				{Query: "томатный соус", Quantity: 2},
				{Query: "салат", Quantity: 1},
				{Query: "сыр", Quantity: 1},
				{Query: "лимонад", Quantity: 2, Optional: true},
			},
		},
		{
			Slug:     "romantic-dinner",
			Title:    "Романтический ужин",
			Subtitle: "Рыба, овощи и что-нибудь сладкое",
			Tags:     []string{"ужин", "свидание"},
			Items: []TemplateItem{
				{Query: "лосось", Quantity: 1},
				{Query: "сливки", Quantity: 1},
				{Query: "брокколи", Quantity: 1},
				{Query: "десерт", Quantity: 1, Optional: true},
				{Query: "виноград", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "quick-breakfast",
			Title:    "Завтрак за 7 минут",
			Subtitle: "Быстрый старт без плиты",
			Tags:     []string{"завтрак", "быстро"},
			Items: []TemplateItem{
				{Query: "творог", Quantity: 1},
				{Query: "гранола", Quantity: 1},
				{Query: "банан", Quantity: 1},
				{Query: "йогурт", Quantity: 1, Optional: true},
				{Query: "кофе", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "picnic",
			Title:    "Пикник в парке",
			Subtitle: "Сыр, хлеб и фрукты в дорогу",
			Budget:   1000,
			Tags:     []string{"пикник", "выходные"},
			Items: []TemplateItem{
				{Query: "хлеб", Quantity: 1},
				{Query: "сыр", Quantity: 1},
				{Query: "помидоры", Quantity: 1},
				{Query: "фрукты", Quantity: 1},
				{Query: "вода", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "healthy-snack",
			Title:    "Здоровый перекус",
			Subtitle: "Овощи, хумус и орехи",
			Tags:     []string{"перекус", "здоровое"},
			Items: []TemplateItem{
				{Query: "хумус", Quantity: 1},
				{Query: "морковь", Quantity: 1},
				{Query: "яблоко", Quantity: 1},
				{Query: "миндаль", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "pasta-night",
			Title:    "Паста-вечер",
			Subtitle: "Сливочный соус и пармезан",
			Budget:   800,
			Tags:     []string{"ужин", "паста"},
			Items: []TemplateItem{
				{Query: "паста", Quantity: 1},
				{Query: "сливки", Quantity: 1},
				{Query: "пармезан", Quantity: 1},
				{Query: "базилик", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "russian-breakfast",
			Title:    "Русский завтрак",
			Subtitle: "Сырники, сметана и варенье",
			Tags:     []string{"завтрак", "домашнее"},
			Items: []TemplateItem{
				{Query: "сырники", Quantity: 1},
				{Query: "сметана", Quantity: 1},
				{Query: "варенье", Quantity: 1},
				{Query: "хлеб", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "kids-lunch",
			Title:    "Детский обед",
			Subtitle: "Простое меню, которое съедят",
			Tags:     []string{"дети", "обед"},
			Items: []TemplateItem{
				{Query: "наггетсы", Quantity: 1},
				{Query: "картофельное пюре", Quantity: 1},
				{Query: "яблочный сок", Quantity: 1},
				{Query: "йогурт", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "road-trip",
			Title:    "В дорогу",
			Subtitle: "Перекус, который не испортится",
			Budget:   900,
			Tags:     []string{"дорога", "перекус"},
			Items: []TemplateItem{
				{Query: "хлеб", Quantity: 1},
				{Query: "сыр", Quantity: 1},
				{Query: "колбаса", Quantity: 1},
				{Query: "вода", Quantity: 1},
				{Query: "печенье", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "coffee-break",
			Title:    "Кофе-брейк",
			Subtitle: "Круассан, кофе и что-то к чаю",
			Budget:   600,
			Tags:     []string{"кофе", "перекус"},
			Items: []TemplateItem{
				{Query: "круассан", Quantity: 2},
				{Query: "кофе", Quantity: 1},
				{Query: "сливки", Quantity: 1, Optional: true},
				{Query: "печенье", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "vegetarian-dinner",
			Title:    "Вегетарианский ужин",
			Subtitle: "Тофу, рис и овощи",
			Tags:     []string{"ужин", "вегетарианское"},
			Items: []TemplateItem{
				{Query: "тофу", Quantity: 1},
				{Query: "рис", Quantity: 1},
				{Query: "овощи", Quantity: 1},
				{Query: "соевый соус", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "protein-dinner",
			Title:    "Белковый ужин",
			Subtitle: "Курица, яйца и творог",
			Tags:     []string{"ужин", "белок"},
			Items: []TemplateItem{
				{Query: "куриное филе", Quantity: 1},
				{Query: "яйца", Quantity: 1},
				{Query: "творог", Quantity: 1},
				{Query: "овощи", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "sunday-brunch",
			Title:    "Воскресный бранч",
			Subtitle: "Неспешный завтрак на двоих",
			Tags:     []string{"завтрак", "выходные"},
			Items: []TemplateItem{
				{Query: "круассан", Quantity: 2},
				{Query: "сыр", Quantity: 1},
				{Query: "виноград", Quantity: 1},
				{Query: "сок", Quantity: 1},
				{Query: "яйца", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "cold-dinner",
			Title:    "Холодный ужин",
			Subtitle: "Без плиты и лишней посуды",
			Tags:     []string{"ужин", "быстро"},
			Items: []TemplateItem{
				{Query: "салат", Quantity: 1},
				{Query: "сыр", Quantity: 1},
				{Query: "хлеб", Quantity: 1},
				{Query: "виноград", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "soup-day",
			Title:    "Супный день",
			Subtitle: "Суп, хлеб и сметана",
			Budget:   600,
			Tags:     []string{"обед", "суп"},
			Items: []TemplateItem{
				{Query: "суп", Quantity: 1},
				{Query: "хлеб", Quantity: 1},
				{Query: "сметана", Quantity: 1},
				{Query: "зелень", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "cheese-plate",
			Title:    "Сырная тарелка",
			Subtitle: "Сыр, виноград и орехи",
			Tags:     []string{"перекус", "вечер"},
			Items: []TemplateItem{
				{Query: "сыр", Quantity: 2},
				{Query: "виноград", Quantity: 1},
				{Query: "орехи", Quantity: 1},
				{Query: "хлеб", Quantity: 1, Optional: true},
			},
		},
		{
			Slug:     "sweet-evening",
			Title:    "Сладкий вечер",
			Subtitle: "Шоколад, печенье и чай",
			Budget:   700,
			Tags:     []string{"десерт", "вечер"},
			Items: []TemplateItem{
				{Query: "шоколад", Quantity: 1},
				{Query: "печенье", Quantity: 1},
				{Query: "мороженое", Quantity: 1},
				{Query: "чай", Quantity: 1, Optional: true},
			},
		},
	}
}
