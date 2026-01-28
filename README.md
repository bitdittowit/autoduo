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

### v1.0.8 (2026-01-29)
- **Исправлено:** Непрерывные sliders не распознавались ("Get as close as you can")
  - InteractiveSliderSolver пропускал NumberLine iframe с упоминанием "ExpressionBuild"
  - Добавлена проверка признаков настоящего slider:
    * `disableSnapping: true` - непрерывный slider
    * `fillToValue: true` - дискретный slider с fill
    * `density` конфигурация (TWO_PRIMARY, SEVEN_PRIMARY)
  - Теперь решает оба типа: дискретные (`150÷25=?`) и непрерывные (`?÷30=3`)

### v1.0.7 (2026-01-29)
- **Исправлено:** NumberLine slider не распознавался для заданий "Answer on the line"
  - ExpressionBuildSolver ошибочно срабатывал на NumberLine iframe
  - Изменён порядок регистрации: InteractiveSliderSolver → ExpressionBuildSolver
  - Добавлена проверка исключения NumberLine iframe в ExpressionBuildSolver
  - Теперь правильно решает задания: `150÷25 = ?` с интерактивным слайдером

### v1.0.6 (2026-01-29)
- **Исправлено:** MatchPairsSolver неправильно решал задания с делением
  - `isCompoundExpression` теперь распознаёт `/` и `÷` как составные выражения
  - Fallback режим предпочитает сопоставлять выражения с простыми числами
  - Двухпроходная логика: (1) expr→num, (2) any→any для edge cases
  - Теперь правильно решает задания типа: `45÷5` ↔ `9`, `25÷5` ↔ `5`, `80÷10` ↔ `8`

### v1.0.5 (2026-01-25)
- **Улучшено:** Factor Tree (Дерево факторов) - улучшен алгоритм решения
  - Реализован post-order обход дерева (дети обрабатываются перед родителями)
  - Добавлен итеративный refinement для сложных случаев
  - Расчет из родителя и сиблинга когда дети неизвестны (child = parent / sibling)
  - Множественные проходы до тех пор, пока больше нельзя вычислить значения
  - Теперь решает деревья с несколькими неизвестными
- **Добавлено:** Поддержка списков факторов в MatchPairsSolver
  - Определение токенов с comma-separated числами (e.g., "1, 4, 5, 10")
  - Сопоставление чисел со списками их факторов
- **Добавлено:** Поддержка LaTeX скобок и возведения в степень
  - `\left(` `\right)` `\left[` `\right]` и др. → стандартные скобки
  - Возведение в степень: `base^exponent` → `base**exponent`
  - Улучшена обработка математических выражений

### v1.0.4 (2026-01-25)
- **Исправлено:** Задания "Show this another way" с блок-диаграммами в вариантах выбора (число → блок-диаграмма)
  - `BlockDiagramChoiceSolver` теперь поддерживает новый вариант: уравнение показывает число (200), выборы показывают блок-диаграммы
  - Исправлена логика подсчета блоков: теперь считаются ВСЕ rect и path элементы (каждый = 1 блок), а не столбцы
  - Добавлены fallback-методы для извлечения целевого значения из уравнения
  - Улучшено логирование для отладки
- **Исправлено:** Нестабильное автоматическое нажатие кнопки "Continue"
  - Реализована асинхронная функция `clickContinueButtonAsync` с MutationObserver
  - Использует polling + MutationObserver для надежного ожидания активации кнопки
  - `AutoRunner` обновлен для использования асинхронной версии во всех местах

### v1.0.3 (2026-01-25)
- **Исправлено:** Неполное решение заданий типа "Match the Pairs"
  - `MatchPairsSolver` теперь кликает все пары последовательно, а не только первую
  - Улучшена логика `canSolve()`: теперь проверяет наличие активных (незаблокированных) токенов
  - Добавлена обработка случая, когда все пары уже сопоставлены (задание завершено)
  - Теперь задания "Match the Pairs" решаются полностью до завершения

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
