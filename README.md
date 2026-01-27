# AutoDuo

Userscript для автоматического решения математических заданий в Duolingo Math.

## Возможности

Скрипт автоматически решает **18 типов заданий**:

| Солвер | Тип задания |
|--------|-------------|
| `InteractiveSliderSolver` | Числовые линии со слайдером (NumberLine) |
| `InteractiveSpinnerSolver` | Круговые диаграммы для выбора сегментов |
| `ExpressionBuildSolver` | Построение математических выражений |
| `FactorTreeSolver` | Разложение чисел на множители |
| `MatchPairsSolver` | Сопоставление пар (дроби, округление, блок-диаграммы) |
| `PatternTableSolver` | Таблицы с числовыми паттернами |
| `BlockDiagramChoiceSolver` | Блок-диаграмма с выбором числа из вариантов |
| `BlockDiagramTextInputSolver` | Блок-диаграмма с текстовым вводом числа |
| `RoundToNearestSolver` | Округление чисел до ближайших 10/100/1000 |
| `SelectEquivalentFractionSolver` | Выбор эквивалентной дроби |
| `ComparisonChoiceSolver` | Сравнения с выбором (`1/4 > ?`) |
| `SelectOperatorSolver` | Выбор оператора сравнения |
| `PieChartTextInputSolver` | Ввод дроби по круговой диаграмме |
| `PieChartSelectFractionSolver` | Выбор дроби по pie chart |
| `SelectPieChartSolver` | Выбор pie chart по уравнению |
| `EquationBlankSolver` | Уравнения с пропуском и выбором |
| `TypeAnswerSolver` | Ввод ответа (универсальный) |

## Установка

### Через userscript менеджер

1. Установите [Tampermonkey](https://www.tampermonkey.net/) или [Violentmonkey](https://violentmonkey.github.io/)

2. Создайте новый скрипт и вставьте содержимое из `dist/autoduo.user.js`

### Через консоль браузера

1. Откройте Duolingo Math
2. Откройте Developer Tools (F12)
3. Вставьте содержимое `dist/autoduo.user.js` в консоль
4. Нажмите Enter

## Использование

После запуска в углу экрана появятся панели:

**Панель управления (справа вверху):**
- **Start** — запустить автоматическое решение всех заданий
- **Stop** — остановить автоматический режим
- **Solve 1** — решить только текущее задание

**Панель логов (слева вверху):**
- Отображает все действия скрипта
- **Copy** — скопировать логи в буфер обмена
- **Clear** — очистить логи

## Разработка

```bash
# Клонировать репозиторий
git clone https://github.com/bitdittowit/autoduo.git
cd autoduo

# Установить зависимости
npm install

# Запустить проверки
npm run check        # typecheck + lint + tests

# Собрать бандл
npm run build        # создаёт dist/autoduo.user.js

# Отдельные команды
npm run typecheck    # проверка типов TypeScript
npm run lint         # проверка ESLint
npm run lint:fix     # автоисправление
npm run test         # запуск тестов (watch mode)
npm run test:run     # запуск тестов (single run)
```

## Архитектура

```
src/
├── config.ts           # Конфигурация
├── types.ts            # TypeScript типы
├── index.ts            # Entry point
│
├── math/               # Математические утилиты
│   ├── fractions.ts    # Операции с дробями
│   ├── rounding.ts     # Округление
│   ├── expressions.ts  # Вычисление выражений
│   └── equations.ts    # Решение уравнений
│
├── parsers/            # Парсеры DOM элементов
│   ├── latex.ts        # LaTeX утилиты
│   ├── KatexParser.ts  # KaTeX элементы
│   ├── FractionParser.ts
│   ├── BlockDiagramParser.ts
│   └── PieChartParser.ts
│
├── solvers/            # Солверы заданий (16 штук)
│   ├── BaseSolver.ts   # Базовый класс
│   └── *Solver.ts      # Конкретные солверы
│
├── dom/                # DOM утилиты
│   ├── selectors.ts    # CSS селекторы
│   ├── waiters.ts      # Ожидание элементов
│   └── interactions.ts # Клики, ввод
│
├── core/               # Ядро логики
│   ├── ChallengeDetector.ts
│   ├── SolverRegistry.ts
│   └── AutoRunner.ts
│
└── ui/                 # UI компоненты
    ├── LogPanel.ts
    └── ControlPanel.ts
```

## Статистика

- 18 солверов
- 178+ тестов
- ~60 TypeScript файлов
- 100% покрытие типами

## Последние изменения

### v1.0.2 (2026-01-25)
- **Исправлено:** Ошибочный выбор `InteractiveSpinnerSolver` для заданий типа `NumberLine`
  - Уточнена логика `InteractiveSpinnerSolver.canSolve()`: добавлена явная проверка исключения для компонентов `NumberLine` и `ExpressionBuild`
  - Это предотвращает ложное срабатывание на задания с числовой линией, которые могут содержать строку 'segments:' в HTML
  - Теперь задания с числовой линией (NumberLine) корректно обрабатываются `InteractiveSliderSolver`

### v1.0.1 (2026-01-25)
- **Исправлено:** Ошибочный выбор `ExpressionBuildSolver` для заданий типа `NumberLine`
  - Уточнена логика `ExpressionBuildSolver.canSolve()`: теперь проверяется наличие уравнения с `\duoblank`
  - Это предотвращает ложное срабатывание на чистые NumberLine задания, которые могут содержать строки 'exprBuild' или 'ExpressionBuild' в комментариях/переменных
  - Теперь задания с числовой линией (NumberLine) корректно обрабатываются `InteractiveSliderSolver`

### v1.0.0 (2026-01-27)
- **Исправлено:** Ошибочный выбор `InteractiveSliderSolver` для заданий типа `ExpressionBuild`
  - `ExpressionBuildSolver` теперь регистрируется перед `InteractiveSliderSolver` в `SolverRegistry`
  - Добавлена проверка исключения в `InteractiveSliderSolver.canSolve()` для фильтрации iframe с ExpressionBuild
  - Теперь задания "Построй выражение" (например, `300 = ___` → `3 × 100`) решаются корректно

## Лицензия

[MIT](LICENSE)

## Дисклеймер

Этот проект создан в образовательных целях. Используйте на свой страх и риск.
