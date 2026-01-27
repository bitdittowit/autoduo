// ==UserScript==
// @name         AutoDuo
// @namespace    https://github.com/bitdittowit/autoduo
// @version      1.0.0
// @description  Auto-solve Duolingo Math challenges
// @author       bitdittowit
// @match        https://www.duolingo.com/*
// @grant        none
// ==/UserScript==

var AutoDuo = (function (exports) {
    'use strict';

    /**
     * Конфигурация AutoDuo
     */
    const CONFIG = {
        /**
         * Задержки (в миллисекундах)
         */
        delays: {
            betweenActions: 300,
            afterSolve: 500,
            waitForElement: 5000,
            pollInterval: 100,
        },
        /**
         * Включить отладочные логи
         */
        debug: false,
        /**
         * Автоматически нажимать CHECK/CONTINUE
         */
        autoSubmit: true,
        /**
         * Версия скрипта
         */
        version: '1.0.0',
    };
    /**
     * CSS селекторы элементов Duolingo
     */
    const SELECTORS = {
        // Challenge containers
        CHALLENGE: '[data-test^="challenge"]',
        CHALLENGE_HEADER: '[data-test="challenge-header"]',
        CHALLENGE_CHOICE: '[data-test="challenge-choice"]',
        // Inputs
        TEXT_INPUT: '[data-test="challenge-text-input"]',
        TAP_TOKEN: '[data-test="challenge-tap-token"]',
        // Buttons
        CHECK_BUTTON: '[data-test="player-next"]',
        SKIP_BUTTON: '[data-test="player-skip"]',
        // Math elements
        KATEX: '.katex',
        ANNOTATION: 'annotation',
        MATH_IFRAME: 'iframe[title="Math Web Element"]',
        // Specific challenge types
        PATTERN_TABLE: '[data-test="challenge-patternTable"]',
        EQUATION_CONTAINER: '._1KXkZ',
    };
    /**
     * Регулярные выражения для парсинга
     */
    const PATTERNS = {
        // LaTeX patterns
        MATHBF: /\\mathbf\{([^}]+)\}/g,
        TEXTBF: /\\textbf\{([^}]+)\}/g,
        FRAC: /\\frac\{([^}]+)\}\{([^}]+)\}/,
        DUOBLANK: /\\duoblank/,
        HTML_CLASS: /\\htmlClass\{[^}]*\}\{([^}]+)\}/g,
        // Rounding
        NEAREST: /nearest\s*(\d+)/i,
        // Math operations
        SIMPLE_FRACTION: /^(\d+)\s*\/\s*(\d+)$/,
        MATH_EXPRESSION: /^[\d+\-*/×÷().]+$/,
    };

    /**
     * Цвета для разных уровней логирования
     */
    const LOG_COLORS = {
        debug: '#00aaff',
        info: '#00ff00',
        warn: '#ffff00',
        error: '#ff4444',
    };
    let logPanel = null;
    /**
     * Устанавливает панель логов для вывода сообщений
     */
    function setLogPanel(panel) {
        logPanel = panel;
    }
    /**
     * Форматирует текущее время для логов
     */
    function getTimestamp() {
        const now = new Date();
        return now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }
    /**
     * Выводит сообщение в лог
     */
    function log(level, message, ...args) {
        if (level === 'debug' && !CONFIG.debug) {
            return;
        }
        const timestamp = getTimestamp();
        const formattedArgs = args.length > 0
            ? ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
            : '';
        const fullMessage = `[${timestamp}] ${message}${formattedArgs}`;
        const color = LOG_COLORS[level];
        if (logPanel) {
            logPanel.log(fullMessage, color);
        }
        // Дублируем в консоль для отладки
        // (на Duolingo console.log может быть заблокирован)
        try {
            const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
            console[consoleMethod](`[AutoDuo] ${fullMessage}`);
        }
        catch {
            // Игнорируем ошибки консоли
        }
    }
    /**
     * Логгер с методами для разных уровней
     */
    const logger = {
        debug: (message, ...args) => log('debug', message, ...args),
        info: (message, ...args) => log('info', message, ...args),
        warn: (message, ...args) => log('warn', message, ...args),
        error: (message, ...args) => log('error', message, ...args),
    };
    /**
     * Алиасы для совместимости с существующим кодом
     */
    const LOG = logger.info;
    const LOG_DEBUG = logger.debug;
    const LOG_WARN = logger.warn;
    const LOG_ERROR = logger.error;

    /**
     * Задержка выполнения
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Проверяет, является ли значение числом
     */
    function isNumber(value) {
        return typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);
    }
    /**
     * Безопасный parseInt с проверкой результата
     */
    function safeParseInt(value) {
        const parsed = parseInt(value, 10);
        return isNumber(parsed) ? parsed : null;
    }
    /**
     * Безопасный parseFloat с проверкой результата
     */
    function safeParseFloat(value) {
        const parsed = parseFloat(value);
        return isNumber(parsed) ? parsed : null;
    }
    /**
     * Убирает лишние пробелы из строки
     */
    function normalizeWhitespace(str) {
        return str.replace(/\s+/g, ' ').trim();
    }
    /**
     * Проверяет, содержит ли строка только цифры
     */
    function isDigitsOnly(str) {
        return /^\d+$/.test(str);
    }
    /**
     * Clamp значение в диапазон
     */
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Вычисляет наибольший общий делитель (НОД) двух чисел
     */
    function gcd(a, b) {
        a = Math.abs(a);
        b = Math.abs(b);
        while (b !== 0) {
            const temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }
    /**
     * Вычисляет наименьшее общее кратное (НОК) двух чисел
     */
    function lcm(a, b) {
        return Math.abs(a * b) / gcd(a, b);
    }
    /**
     * Упрощает дробь до несократимого вида
     */
    function simplifyFraction(numerator, denominator) {
        if (denominator === 0) {
            throw new Error('Denominator cannot be zero');
        }
        const divisor = gcd(numerator, denominator);
        let simplifiedNum = numerator / divisor;
        let simplifiedDen = denominator / divisor;
        // Обеспечиваем положительный знаменатель
        if (simplifiedDen < 0) {
            simplifiedNum = -simplifiedNum;
            simplifiedDen = -simplifiedDen;
        }
        return {
            numerator: simplifiedNum,
            denominator: simplifiedDen,
        };
    }
    /**
     * Упрощает дробь и вычисляет её значение
     */
    function simplifyFractionWithValue(numerator, denominator) {
        const simplified = simplifyFraction(numerator, denominator);
        return {
            ...simplified,
            value: simplified.numerator / simplified.denominator,
        };
    }
    /**
     * Сравнивает две дроби
     * @returns -1 если a < b, 0 если a = b, 1 если a > b
     */
    function compareFractions(numA, denA, numB, denB) {
        // Используем перекрёстное умножение для избежания погрешностей с плавающей точкой
        const left = numA * denB;
        const right = numB * denA;
        if (left < right)
            return -1;
        if (left > right)
            return 1;
        return 0;
    }
    /**
     * Проверяет, являются ли дроби эквивалентными
     */
    function areFractionsEqual(numA, denA, numB, denB) {
        return compareFractions(numA, denA, numB, denB) === 0;
    }
    /**
     * Складывает две дроби
     */
    function addFractions(numA, denA, numB, denB) {
        const commonDen = lcm(denA, denB);
        const newNumA = numA * (commonDen / denA);
        const newNumB = numB * (commonDen / denB);
        return simplifyFraction(newNumA + newNumB, commonDen);
    }
    /**
     * Вычитает две дроби (a - b)
     */
    function subtractFractions(numA, denA, numB, denB) {
        return addFractions(numA, denA, -numB, denB);
    }
    /**
     * Умножает две дроби
     */
    function multiplyFractions(numA, denA, numB, denB) {
        return simplifyFraction(numA * numB, denA * denB);
    }
    /**
     * Делит две дроби (a / b)
     */
    function divideFractions(numA, denA, numB, denB) {
        if (numB === 0) {
            throw new Error('Cannot divide by zero');
        }
        return multiplyFractions(numA, denA, denB, numB);
    }

    /**
     * Округляет число до ближайшего значения с заданной базой
     * @param value - число для округления
     * @param base - база округления (10, 100, 1000 и т.д.)
     * @returns округлённое значение
     *
     * @example
     * roundToNearest(41, 10) // 40
     * roundToNearest(18, 10) // 20
     * roundToNearest(250, 100) // 300
     */
    function roundToNearest(value, base) {
        if (base <= 0) {
            throw new Error('Base must be positive');
        }
        return Math.round(value / base) * base;
    }
    /**
     * Округляет число вниз до ближайшего значения с заданной базой
     * @param value - число для округления
     * @param base - база округления
     * @returns округлённое значение
     *
     * @example
     * floorToNearest(45, 10) // 40
     * floorToNearest(99, 100) // 0
     */
    function floorToNearest(value, base) {
        if (base <= 0) {
            throw new Error('Base must be positive');
        }
        return Math.floor(value / base) * base;
    }
    /**
     * Округляет число вверх до ближайшего значения с заданной базой
     * @param value - число для округления
     * @param base - база округления
     * @returns округлённое значение
     *
     * @example
     * ceilToNearest(41, 10) // 50
     * ceilToNearest(101, 100) // 200
     */
    function ceilToNearest(value, base) {
        if (base <= 0) {
            throw new Error('Base must be positive');
        }
        return Math.ceil(value / base) * base;
    }
    /**
     * Определяет базу округления из текста
     * @param text - текст содержащий "nearest 10", "nearest 100" и т.д.
     * @returns база округления или null
     */
    function extractRoundingBase(text) {
        const match = text.toLowerCase().match(/nearest\s*(\d+)/);
        if (match?.[1]) {
            const base = parseInt(match[1], 10);
            return Number.isNaN(base) ? null : base;
        }
        return null;
    }

    /**
     * Утилиты для работы с LaTeX разметкой
     */
    /**
     * Извлекает содержимое из LaTeX команды с вложенными скобками
     * @param str - исходная строка
     * @param command - LaTeX команда (например, '\\mathbf')
     * @returns строка с удалённой командой и её скобками
     *
     * @example
     * extractLatexContent('\\mathbf{42}', '\\mathbf') // '42'
     * extractLatexContent('\\frac{1}{2}', '\\frac') // '1}{2}' (только первые скобки)
     */
    function extractLatexContent(str, command) {
        const cmdIndex = str.indexOf(command);
        if (cmdIndex === -1)
            return str;
        const startBrace = str.indexOf('{', cmdIndex + command.length);
        if (startBrace === -1)
            return str;
        let depth = 1;
        let endBrace = startBrace + 1;
        while (depth > 0 && endBrace < str.length) {
            if (str[endBrace] === '{')
                depth++;
            else if (str[endBrace] === '}')
                depth--;
            endBrace++;
        }
        const content = str.substring(startBrace + 1, endBrace - 1);
        return str.substring(0, cmdIndex) + content + str.substring(endBrace);
    }
    /**
     * Удаляет все LaTeX обёртки из строки
     * @param str - исходная строка с LaTeX
     * @returns очищенная строка
     */
    function cleanLatexWrappers(str) {
        let result = str;
        const wrappers = ['\\mathbf', '\\textbf', '\\text', '\\mbox'];
        for (const wrapper of wrappers) {
            while (result.includes(wrapper + '{')) {
                result = extractLatexContent(result, wrapper);
            }
        }
        return result;
    }
    /**
     * Конвертирует LaTeX операторы в стандартные символы
     * @param str - строка с LaTeX операторами
     * @returns строка со стандартными операторами
     */
    function convertLatexOperators(str) {
        return str
            .replace(/\\cdot/g, '*') // \cdot -> *
            .replace(/\\times/g, '*') // \times -> *
            .replace(/\\div/g, '/') // \div -> /
            .replace(/\\pm/g, '±') // \pm -> ±
            .replace(/×/g, '*') // Unicode multiplication
            .replace(/÷/g, '/') // Unicode division
            .replace(/−/g, '-') // Unicode minus
            .replace(/⋅/g, '*'); // Unicode middle dot
    }
    /**
     * Конвертирует \frac{a}{b} в (a/b)
     * @param str - строка с LaTeX дробями
     * @returns строка с обычными дробями
     */
    function convertLatexFractions(str) {
        let result = str;
        while (result.includes('\\frac{')) {
            const fracMatch = result.match(/\\frac\{/);
            if (fracMatch?.index === undefined)
                break;
            const fracStart = fracMatch.index;
            // Find numerator
            const numStart = fracStart + 6; // after \frac{
            let depth = 1;
            let numEnd = numStart;
            while (depth > 0 && numEnd < result.length) {
                if (result[numEnd] === '{')
                    depth++;
                else if (result[numEnd] === '}')
                    depth--;
                numEnd++;
            }
            const numerator = result.substring(numStart, numEnd - 1);
            // Find denominator
            const denomStart = numEnd + 1; // after }{
            depth = 1;
            let denomEnd = denomStart;
            while (depth > 0 && denomEnd < result.length) {
                if (result[denomEnd] === '{')
                    depth++;
                else if (result[denomEnd] === '}')
                    depth--;
                denomEnd++;
            }
            const denominator = result.substring(denomStart, denomEnd - 1);
            const replacement = '(' + numerator + '/' + denominator + ')';
            result = result.substring(0, fracStart) + replacement + result.substring(denomEnd);
        }
        return result;
    }
    /**
     * Полная очистка LaTeX строки для вычисления
     * @param str - LaTeX строка
     * @returns очищенная строка готовая для eval
     */
    function cleanLatexForEval(str) {
        let result = str;
        result = cleanLatexWrappers(result);
        result = convertLatexOperators(result);
        result = convertLatexFractions(result);
        result = result.replace(/\s+/g, ''); // Remove whitespace
        logger.debug('cleanLatexForEval:', str, '->', result);
        return result;
    }

    /**
     * Вычисление математических выражений
     */
    /**
     * Безопасно вычисляет математическое выражение
     * Поддерживает: +, -, *, /, скобки, числа
     *
     * @param expr - математическое выражение
     * @returns результат вычисления или null при ошибке
     *
     * @example
     * evaluateMathExpression('2 + 3') // 5
     * evaluateMathExpression('(1/2) + (1/2)') // 1
     * evaluateMathExpression('10 * 5') // 50
     */
    function evaluateMathExpression(expr) {
        if (!expr) {
            logger.debug('evaluateMathExpression: expression is null/empty');
            return null;
        }
        logger.debug('evaluateMathExpression: input', expr);
        // Clean the expression
        let cleaned = expr.toString()
            .replace(/\s+/g, ''); // Remove whitespace
        // Convert LaTeX operators
        cleaned = convertLatexOperators(cleaned);
        // Remove any remaining non-math characters
        cleaned = cleaned.replace(/[^\d+\-*/().]/g, '');
        logger.debug('evaluateMathExpression: cleaned', cleaned);
        // Validate - only allow safe characters
        if (!/^[\d+\-*/().]+$/.test(cleaned)) {
            logger.warn('evaluateMathExpression: invalid expression after cleaning', cleaned);
            return null;
        }
        // Check for empty or invalid expressions
        if (cleaned === '' || cleaned === '()') {
            return null;
        }
        try {
            // Using Function constructor for safer eval
            const result = new Function('return ' + cleaned)();
            if (typeof result !== 'number' || !Number.isFinite(result)) {
                logger.warn('evaluateMathExpression: result is not a valid number', result);
                return null;
            }
            logger.debug('evaluateMathExpression: result', result);
            return result;
        }
        catch (e) {
            logger.error('evaluateMathExpression: eval error', e instanceof Error ? e.message : String(e));
            return null;
        }
    }
    /**
     * Проверяет, является ли строка валидным математическим выражением
     */
    function isValidMathExpression(expr) {
        const cleaned = expr.replace(/\s+/g, '');
        return /^[\d+\-*/().]+$/.test(cleaned) && cleaned.length > 0;
    }

    /**
     * Парсер для KaTeX элементов
     */
    /**
     * Извлекает значение из KaTeX элемента
     *
     * Поддерживает три метода извлечения:
     * 1. Из тега <annotation> (содержит сырой LaTeX)
     * 2. Из .katex-html (видимая часть)
     * 3. Из textContent (fallback)
     *
     * @param element - DOM элемент с KaTeX
     * @returns очищенное значение или null
     *
     * @example
     * // HTML: <span class="katex"><annotation>\\mathbf{42}</annotation></span>
     * extractKatexValue(element) // '42'
     */
    function extractKatexValue(element) {
        if (!element) {
            logger.debug('extractKatexValue: element is null');
            return null;
        }
        logger.debug('extractKatexValue: processing element');
        // Method 1: Try to get from annotation tag (contains raw LaTeX)
        const annotation = element.querySelector('annotation');
        if (annotation?.textContent) {
            let raw = annotation.textContent;
            logger.debug('extractKatexValue: found annotation', raw);
            // Clean LaTeX markup
            raw = cleanLatexWrappers(raw);
            // Convert LaTeX operators to standard symbols
            raw = convertLatexOperators(raw);
            // Convert \frac to (a/b)
            raw = convertLatexFractions(raw);
            // Remove whitespace
            raw = raw.replace(/\s+/g, '');
            logger.debug('extractKatexValue: cleaned annotation value', raw);
            return raw;
        }
        // Method 2: Get from katex-html (visible part)
        const katexHtml = element.querySelector('.katex-html');
        if (katexHtml?.textContent) {
            const text = katexHtml.textContent.trim();
            logger.debug('extractKatexValue: found katex-html text', text);
            return text;
        }
        // Method 3: Just get text content
        const text = element.textContent?.trim() ?? null;
        logger.debug('extractKatexValue: fallback to textContent', text);
        return text;
    }
    /**
     * Извлекает числовое значение из KaTeX элемента
     *
     * @param element - DOM элемент с KaTeX
     * @returns число или null
     */
    function extractKatexNumber(element) {
        const value = extractKatexValue(element);
        if (value === null)
            return null;
        // Try to parse as integer first
        const intValue = parseInt(value, 10);
        if (!Number.isNaN(intValue) && String(intValue) === value) {
            return intValue;
        }
        // Try to parse as float
        const floatValue = parseFloat(value);
        if (!Number.isNaN(floatValue)) {
            return floatValue;
        }
        return null;
    }
    /**
     * Извлекает текст из annotation элемента в контейнере
     *
     * @param container - контейнер для поиска
     * @returns текст annotation или null
     */
    function extractAnnotationText(container) {
        const annotation = container.querySelector('annotation');
        return annotation?.textContent?.trim() ?? null;
    }
    /**
     * Очищает LaTeX текст annotation от обёрток
     *
     * @param text - текст из annotation
     * @returns очищенный текст
     */
    function cleanAnnotationText(text) {
        let cleaned = text;
        cleaned = cleanLatexWrappers(cleaned);
        cleaned = cleaned.replace(/\\htmlClass\{[^}]*\}\{([^}]+)\}/g, '$1');
        return cleaned.trim();
    }

    /**
     * Парсер для дробей из LaTeX выражений
     */
    /**
     * Парсит дробь из LaTeX выражения
     *
     * Поддерживает форматы:
     * - \frac{a}{b}
     * - a/b
     * - Составные выражения: \frac{1}{5}+\frac{2}{5}
     *
     * @param expr - LaTeX выражение
     * @returns объект с числителем, знаменателем и значением, или null
     *
     * @example
     * parseFractionExpression('\\frac{1}{2}') // { numerator: 1, denominator: 2, value: 0.5 }
     * parseFractionExpression('3/4') // { numerator: 3, denominator: 4, value: 0.75 }
     */
    function parseFractionExpression(expr) {
        logger.debug('parseFractionExpression: input', expr);
        let cleaned = expr;
        // Remove LaTeX wrappers
        while (cleaned.includes('\\mathbf{')) {
            cleaned = extractLatexContent(cleaned, '\\mathbf');
        }
        while (cleaned.includes('\\textbf{')) {
            cleaned = extractLatexContent(cleaned, '\\textbf');
        }
        logger.debug('parseFractionExpression: after removing wrappers:', cleaned);
        // Try to match single \frac{numerator}{denominator} (whole string)
        const fracMatch = cleaned.match(/^\\frac\{(\d+)\}\{(\d+)\}$/);
        if (fracMatch?.[1] && fracMatch[2]) {
            const numerator = parseInt(fracMatch[1], 10);
            const denominator = parseInt(fracMatch[2], 10);
            return {
                numerator,
                denominator,
                value: numerator / denominator,
            };
        }
        // Try simple fraction format: number/number
        const simpleFracMatch = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (simpleFracMatch?.[1] && simpleFracMatch[2]) {
            const numerator = parseInt(simpleFracMatch[1], 10);
            const denominator = parseInt(simpleFracMatch[2], 10);
            return {
                numerator,
                denominator,
                value: numerator / denominator,
            };
        }
        // Try to evaluate expression with multiple fractions
        // Convert all \frac to (a/b)
        cleaned = convertLatexFractions(cleaned);
        cleaned = cleaned.replace(/\s+/g, '');
        logger.debug('parseFractionExpression: converted expression:', cleaned);
        // If it's a compound expression with + or -, evaluate it
        if (cleaned.includes('+') || cleaned.includes('-')) {
            const result = evaluateMathExpression(cleaned);
            if (result !== null) {
                // Try to convert back to a simple fraction
                // Find a reasonable denominator (try common ones)
                const commonDenominators = [2, 3, 4, 5, 6, 8, 10, 12, 100];
                for (const testDenom of commonDenominators) {
                    const testNum = Math.round(result * testDenom);
                    if (Math.abs(testNum / testDenom - result) < 0.0001) {
                        return {
                            numerator: testNum,
                            denominator: testDenom,
                            value: result,
                        };
                    }
                }
            }
        }
        return null;
    }
    /**
     * Извлекает простую дробь из строки формата "a/b"
     *
     * @param str - строка с дробью
     * @returns объект дроби или null
     */
    function parseSimpleFraction(str) {
        const match = str.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
        if (!match?.[1] || !match[2])
            return null;
        const numerator = parseInt(match[1], 10);
        const denominator = parseInt(match[2], 10);
        if (Number.isNaN(numerator) || Number.isNaN(denominator) || denominator === 0) {
            return null;
        }
        return { numerator, denominator };
    }
    /**
     * Проверяет, является ли строка дробью
     */
    function isFractionString(str) {
        return /^\d+\s*\/\s*\d+$/.test(str.trim()) || /\\frac\{\d+\}\{\d+\}/.test(str);
    }

    /**
     * Парсер для блок-диаграмм (используются в заданиях на округление)
     *
     * Блок-диаграммы показывают столбцы по 10 блоков каждый,
     * используются для визуализации чисел в десятичной системе.
     */
    /**
     * Извлекает часть SVG для анализа (предпочитает dark-img)
     */
    function extractSvgContent$1(srcdoc) {
        // Prefer dark-img since Duolingo Math often uses dark theme
        const darkImgMatch = srcdoc.match(/<span class="dark-img">([\s\S]*?)<\/span>/);
        if (darkImgMatch?.[1]) {
            logger.debug('extractBlockDiagramValue: using dark-img SVG');
            return darkImgMatch[1];
        }
        // Fallback to light-img
        const lightImgMatch = srcdoc.match(/<span class="light-img">([\s\S]*?)<\/span>/);
        if (lightImgMatch?.[1]) {
            logger.debug('extractBlockDiagramValue: using light-img SVG');
            return lightImgMatch[1];
        }
        return srcdoc;
    }
    /**
     * Подсчитывает "сотенные" блоки (структуры с clip-rule="evenodd")
     */
    function countHundredBlocks(svgContent) {
        const allPaths = svgContent.match(/<path[^>]*>/gi) ?? [];
        let count = 0;
        for (const pathTag of allPaths) {
            const hasClipRule = /clip-rule=["']evenodd["']/i.test(pathTag);
            const hasFillColor = /fill=["']#(?:1CB0F6|49C0F8)["']/i.test(pathTag);
            if (hasClipRule && hasFillColor) {
                count += 100;
            }
        }
        return count;
    }
    /**
     * Подсчитывает обычные блоки (rect и простые path без clip-rule)
     */
    function countRegularBlocks(svgContent) {
        let count = 0;
        // Count rects with fill color
        const rectPattern = /<rect[^>]*fill=["']#(?:1CB0F6|49C0F8)["'][^>]*>/gi;
        const rectMatches = svgContent.match(rectPattern);
        if (rectMatches) {
            count += rectMatches.length;
        }
        // Count simple paths (without clip-rule) with fill color
        const allPaths = svgContent.match(/<path[^>]*>/gi) ?? [];
        for (const pathTag of allPaths) {
            const hasClipRule = /clip-rule=["']evenodd["']/i.test(pathTag);
            const hasFillColor = /fill=["']#(?:1CB0F6|49C0F8)["']/i.test(pathTag);
            if (!hasClipRule && hasFillColor) {
                count++;
            }
        }
        return count;
    }
    /**
     * Извлекает значение из блок-диаграммы SVG
     *
     * Блок-диаграммы используются в заданиях "Round to Nearest 10/100".
     * Каждый столбец = 10 блоков. Специальные структуры = 100 блоков.
     *
     * @param srcdoc - srcdoc атрибут iframe с SVG
     * @returns числовое значение (10, 20, 100, 200...) или null
     *
     * @example
     * // SVG с 4 столбцами по 10 блоков
     * extractBlockDiagramValue(srcdoc) // 40
     */
    function extractBlockDiagramValue(srcdoc) {
        if (!srcdoc)
            return null;
        const svgContent = extractSvgContent$1(srcdoc);
        // Count "hundred block" structures first
        const hundredBlocks = countHundredBlocks(svgContent);
        if (hundredBlocks > 0) {
            logger.debug('extractBlockDiagramValue: found hundred-block structures =', hundredBlocks);
        }
        // Count regular blocks
        const regularBlocks = countRegularBlocks(svgContent);
        if (regularBlocks > 0) {
            const total = regularBlocks + hundredBlocks;
            logger.debug('extractBlockDiagramValue: regular =', regularBlocks, '+ hundreds =', hundredBlocks, '=', total);
            return total;
        }
        // Alternative method: count rect elements with specific height
        // Each column has 8 rects with height 14.1755 or 14.1323
        const heightRectMatches = svgContent.match(/<rect[^>]*height=["']14\.1(?:755|323)["'][^>]*>/gi);
        if (heightRectMatches && heightRectMatches.length > 0) {
            // 8 rects per column, each column represents 10
            const columns = Math.round(heightRectMatches.length / 8);
            const total = columns * 10 + hundredBlocks;
            logger.debug('extractBlockDiagramValue: columns =', columns, '+ hundreds =', hundredBlocks, '=', total);
            return total;
        }
        // If only hundred blocks found
        if (hundredBlocks > 0) {
            return hundredBlocks;
        }
        logger.debug('extractBlockDiagramValue: no blocks found');
        return null;
    }
    /**
     * Проверяет, содержит ли srcdoc блок-диаграмму
     */
    function isBlockDiagram(srcdoc) {
        if (!srcdoc)
            return false;
        // Block diagrams have rect elements with specific fill colors
        const hasBlockColors = /#(?:1CB0F6|49C0F8)/i.test(srcdoc);
        const hasRects = /<rect[^>]*>/i.test(srcdoc);
        return hasBlockColors && hasRects;
    }

    /**
     * Парсер для круговых диаграмм (pie charts)
     */
    /**
     * Извлекает часть SVG для анализа (предпочитает dark-img)
     */
    function extractSvgContent(svgContent) {
        // Try to extract just the dark mode SVG
        const darkImgMatch = svgContent.match(/<span class="dark-img">([\s\S]*?)<\/span>/);
        if (darkImgMatch?.[1]) {
            logger.debug('extractPieChartFraction: using dark mode SVG');
            return darkImgMatch[1];
        }
        // Fallback: try light mode
        const lightImgMatch = svgContent.match(/<span class="light-img">([\s\S]*?)<\/span>/);
        if (lightImgMatch?.[1]) {
            logger.debug('extractPieChartFraction: using light mode SVG');
            return lightImgMatch[1];
        }
        return svgContent;
    }
    /**
     * Метод 1: Подсчёт цветных/нецветных секторов
     */
    function extractByColoredSectors(svgContent) {
        // Count colored sectors (blue)
        const coloredPattern = /<path[^>]*fill="(#49C0F8|#1CB0F6)"[^>]*>/g;
        const coloredMatches = svgContent.match(coloredPattern) ?? [];
        // Count uncolored sectors (background)
        const uncoloredPattern = /<path[^>]*fill="(#131F24|#FFFFFF)"[^>]*>/g;
        const uncoloredMatches = svgContent.match(uncoloredPattern) ?? [];
        // Filter to only count paths that look like pie sectors (have stroke attribute)
        const coloredCount = coloredMatches.filter(m => m.includes('stroke=')).length;
        const uncoloredCount = uncoloredMatches.filter(m => m.includes('stroke=')).length;
        const totalCount = coloredCount + uncoloredCount;
        if (totalCount > 0) {
            logger.debug('extractPieChartFraction: (method 1) colored =', coloredCount, ', total =', totalCount);
            return {
                numerator: coloredCount,
                denominator: totalCount,
                value: coloredCount / totalCount,
            };
        }
        return null;
    }
    /**
     * Метод 2: Анализ путей с кругом (для "Show this another way")
     */
    function extractByCircleAndPaths(svgContent) {
        const hasCircle = svgContent.includes('<circle');
        if (!hasCircle)
            return null;
        logger.debug('extractPieChartFraction: detected circle-based pie chart');
        // Count all path elements with stroke
        const allPathsPattern = /<path[^>]*stroke[^>]*>/g;
        const allPaths = svgContent.match(allPathsPattern) ?? [];
        const pathCount = allPaths.length;
        logger.debug('extractPieChartFraction: found', pathCount, 'path elements');
        if (pathCount === 0) {
            // Circle with no paths = full circle = 1
            return { numerator: 1, denominator: 1, value: 1.0 };
        }
        // Extract path data for analysis
        const pathDataMatch = svgContent.match(/<path[^>]*d="([^"]+)"[^>]*>/);
        const pathData = pathDataMatch?.[1];
        // Look for paths that go to center (L100 100)
        const sectorPaths = allPaths.filter(p => p.includes('L100 100') || p.includes('L 100 100') || p.includes('100L100'));
        if (sectorPaths.length > 0) {
            const numSectors = sectorPaths.length;
            if (numSectors === 1 && pathData) {
                // Detect quarter-circle by path coordinates
                if (pathData.includes('198') || pathData.includes('2 ') ||
                    pathData.includes(' 2C') || pathData.includes(' 2V') ||
                    pathData.includes('V2') || pathData.includes('V100')) {
                    logger.debug('extractPieChartFraction: (method 2) detected 1/4 sector');
                    return { numerator: 1, denominator: 4, value: 0.25 };
                }
                // Check for half-circle
                if (pathData.includes('180') || (pathData.match(/100/g)?.length ?? 0) >= 4) {
                    logger.debug('extractPieChartFraction: (method 2) detected 1/2 sector');
                    return { numerator: 1, denominator: 2, value: 0.5 };
                }
            }
            // Fallback: estimate based on sector count
            logger.debug('extractPieChartFraction: (method 2) fallback - sectors =', numSectors);
            return { numerator: numSectors, denominator: 4, value: numSectors / 4 };
        }
        // Last resort: single path with circle = 1/4
        if (pathCount === 1) {
            logger.debug('extractPieChartFraction: (method 2) single path with circle - assuming 1/4');
            return { numerator: 1, denominator: 4, value: 0.25 };
        }
        return null;
    }
    /**
     * Извлекает дробь из круговой диаграммы SVG
     *
     * @param svgContent - содержимое SVG или srcdoc iframe
     * @returns объект с дробью или null
     *
     * @example
     * // Диаграмма с 3 закрашенными секторами из 4
     * extractPieChartFraction(svg) // { numerator: 3, denominator: 4, value: 0.75 }
     */
    function extractPieChartFraction(svgContent) {
        if (!svgContent)
            return null;
        const svg = extractSvgContent(svgContent);
        // Try method 1: colored/uncolored sectors
        const result1 = extractByColoredSectors(svg);
        if (result1)
            return result1;
        // Try method 2: circle + paths analysis
        const result2 = extractByCircleAndPaths(svg);
        if (result2)
            return result2;
        logger.debug('extractPieChartFraction: no pie sectors found');
        return null;
    }
    /**
     * Проверяет, содержит ли SVG круговую диаграмму
     */
    function isPieChart(svgContent) {
        if (!svgContent)
            return false;
        // Pie charts typically have colored paths or circles
        const hasColoredPaths = /#(?:49C0F8|1CB0F6)/i.test(svgContent);
        const hasCircle = /<circle/i.test(svgContent);
        const hasPaths = /<path[^>]*stroke[^>]*>/i.test(svgContent);
        return (hasColoredPaths && hasPaths) || hasCircle;
    }

    /**
     * Базовый абстрактный класс для всех солверов
     */
    /**
     * Абстрактный базовый класс солвера
     *
     * Все конкретные солверы должны наследоваться от этого класса
     * и реализовывать методы canSolve и solve
     */
    class BaseSolver {
        /**
         * Логирует сообщение с именем солвера
         */
        log(...args) {
            logger.info(`[${this.name}]`, ...args);
        }
        /**
         * Логирует debug сообщение с именем солвера
         */
        logDebug(...args) {
            logger.debug(`[${this.name}]`, ...args);
        }
        /**
         * Логирует ошибку с именем солвера
         */
        logError(...args) {
            logger.error(`[${this.name}]`, ...args);
        }
        /**
         * Создаёт результат успеха
         */
        success(result) {
            return { ...result, success: true };
        }
        /**
         * Создаёт результат ошибки
         */
        failure(type, error) {
            this.logError(error);
            return {
                type,
                success: false,
                error,
            };
        }
        /**
         * Симулирует клик по элементу
         */
        click(element) {
            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
            });
            element.dispatchEvent(event);
        }
        /**
         * Симулирует ввод текста в input
         */
        typeInput(input, value) {
            // Set value via native setter to trigger React's change detection
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(input, value);
            }
            else {
                input.value = value;
            }
            // Dispatch input event
            const inputEvent = new Event('input', { bubbles: true });
            input.dispatchEvent(inputEvent);
        }
        /**
         * Извлекает текст из header (всегда в нижнем регистре)
         */
        getHeaderText(context) {
            if (context.headerText)
                return context.headerText.toLowerCase();
            if (context.header?.textContent) {
                return context.header.textContent.toLowerCase();
            }
            return '';
        }
        /**
         * Проверяет, содержит ли header определённые слова
         */
        headerContains(context, ...words) {
            const text = this.getHeaderText(context);
            return words.every(word => text.includes(word.toLowerCase()));
        }
    }

    /**
     * Солвер для заданий "Round to the nearest X"
     *
     * Поддерживает два режима:
     * 1. С выбором ответа (блок-диаграммы или KaTeX числа)
     * 2. С вводом ответа (текстовое поле)
     */
    class RoundToNearestSolver extends BaseSolver {
        name = 'RoundToNearestSolver';
        /**
         * Проверяет, является ли задание заданием на округление
         */
        canSolve(context) {
            return this.headerContains(context, 'round', 'nearest');
        }
        /**
         * Решает задание на округление
         */
        solve(context) {
            this.log('starting');
            // Extract rounding base from header
            const headerText = this.getHeaderText(context);
            const roundingBase = extractRoundingBase(headerText);
            if (!roundingBase) {
                return this.failure('roundToNearest', 'could not extract rounding base from header');
            }
            this.log('rounding base =', roundingBase);
            // Extract number to round from equation container
            const numberToRound = this.extractNumberToRound(context);
            if (numberToRound === null) {
                return this.failure('roundToNearest', 'could not extract number to round');
            }
            // Calculate rounded value
            const roundedValue = roundToNearest(numberToRound, roundingBase);
            this.log(numberToRound, 'rounds to', roundedValue);
            // Solve based on input type
            if (context.textInput) {
                return this.solveWithTextInput(context.textInput, numberToRound, roundingBase, roundedValue);
            }
            if (context.choices && context.choices.length > 0) {
                return this.solveWithChoices(context.choices, numberToRound, roundingBase, roundedValue);
            }
            return this.failure('roundToNearest', 'no text input or choices found');
        }
        /**
         * Извлекает число для округления из контекста
         */
        extractNumberToRound(context) {
            if (!context.equationContainer) {
                this.logError('equationContainer is null');
                return null;
            }
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent) {
                this.logError('annotation not found');
                return null;
            }
            const cleaned = cleanAnnotationText(annotation.textContent);
            const number = parseInt(cleaned, 10);
            if (Number.isNaN(number)) {
                this.logError('could not parse number from:', cleaned);
                return null;
            }
            this.log('number to round =', number);
            return number;
        }
        /**
         * Решает задание с текстовым вводом
         */
        solveWithTextInput(textInput, numberToRound, roundingBase, roundedValue) {
            this.typeInput(textInput, roundedValue.toString());
            this.log('typed answer:', roundedValue);
            return this.success({
                type: 'roundToNearest',
                numberToRound,
                roundingBase,
                roundedValue,
                answer: roundedValue,
            });
        }
        /**
         * Решает задание с выбором ответа
         */
        solveWithChoices(choices, numberToRound, roundingBase, roundedValue) {
            let matchedIndex = -1;
            for (let i = 0; i < choices.length; i++) {
                const choice = choices[i];
                if (!choice)
                    continue;
                // Try block diagram first
                const blockValue = this.getBlockDiagramValue(choice);
                if (blockValue !== null) {
                    this.logDebug('choice', i, 'has', blockValue, 'blocks');
                    if (blockValue === roundedValue) {
                        matchedIndex = i;
                        this.log('found matching choice', i, 'with', blockValue, 'blocks');
                        break;
                    }
                    continue;
                }
                // Try KaTeX number
                const katexValue = this.getKatexValue(choice);
                if (katexValue !== null) {
                    this.logDebug('choice', i, 'KaTeX value =', katexValue);
                    if (katexValue === roundedValue) {
                        matchedIndex = i;
                        this.log('found matching choice', i, 'with KaTeX value', katexValue);
                        break;
                    }
                }
            }
            if (matchedIndex === -1) {
                return this.failure('roundToNearest', `no matching choice found for rounded value ${roundedValue}`);
            }
            const matchedChoice = choices[matchedIndex];
            if (matchedChoice) {
                this.click(matchedChoice);
                this.log('clicked choice', matchedIndex);
            }
            return this.success({
                type: 'roundToNearest',
                numberToRound,
                roundingBase,
                roundedValue,
                selectedChoice: matchedIndex,
            });
        }
        /**
         * Извлекает значение из блок-диаграммы в choice
         */
        getBlockDiagramValue(choice) {
            const iframe = choice.querySelector('iframe[title="Math Web Element"]');
            if (!iframe)
                return null;
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc)
                return null;
            return extractBlockDiagramValue(srcdoc);
        }
        /**
         * Извлекает числовое значение из KaTeX в choice
         */
        getKatexValue(choice) {
            const annotation = choice.querySelector('annotation');
            if (!annotation?.textContent)
                return null;
            const cleaned = cleanAnnotationText(annotation.textContent);
            const value = parseInt(cleaned, 10);
            return Number.isNaN(value) ? null : value;
        }
    }

    /**
     * Солвер для заданий с вводом ответа (Type the answer)
     *
     * Поддерживает:
     * - Уравнения с пропуском (X + 4 = 7)
     * - Упрощение дробей (2/4 -> 1/2)
     * - Неравенства с пропуском (5/5 > ?)
     */
    class TypeAnswerSolver extends BaseSolver {
        name = 'TypeAnswerSolver';
        /**
         * Проверяет, является ли задание заданием с вводом ответа
         * Это catch-all солвер для заданий с текстовым полем
         */
        canSolve(context) {
            // Must have text input and equation container
            return context.textInput != null && context.equationContainer != null;
        }
        /**
         * Решает задание с вводом ответа
         */
        solve(context) {
            if (!context.textInput || !context.equationContainer) {
                return this.failure('typeAnswer', 'missing textInput or equationContainer');
            }
            this.log('starting');
            // Extract equation from annotation
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent) {
                return this.failure('typeAnswer', 'annotation not found');
            }
            const equation = annotation.textContent;
            this.log('equation =', equation);
            // Try different solving strategies
            const result = this.trySolveSimplifyFraction(context.textInput, equation)
                ?? this.trySolveInequality(context.textInput, equation)
                ?? this.trySolveEquationWithBlank(context.textInput, equation);
            return result;
        }
        /**
         * Пробует решить как задание на упрощение дроби
         */
        trySolveSimplifyFraction(textInput, equation) {
            // Check if it's a simplify fraction type (no =, no \duoblank)
            if (equation.includes('=') || equation.includes('\\duoblank')) {
                return null;
            }
            this.log('detected SIMPLIFY FRACTION type');
            const fractionResult = parseFractionExpression(equation);
            if (!fractionResult) {
                this.logDebug('could not parse fraction from expression');
                return null;
            }
            this.log('parsed fraction:', `${fractionResult.numerator}/${fractionResult.denominator}`);
            // Simplify the fraction
            const simplified = simplifyFraction(fractionResult.numerator, fractionResult.denominator);
            this.log('simplified to:', `${simplified.numerator}/${simplified.denominator}`);
            // Format and type the answer
            const answer = `${simplified.numerator}/${simplified.denominator}`;
            this.typeInput(textInput, answer);
            this.log('typed answer:', answer);
            return this.success({
                type: 'simplifyFraction',
                original: fractionResult,
                simplified,
                answer,
            });
        }
        /**
         * Пробует решить как неравенство с пропуском
         */
        trySolveInequality(textInput, equation) {
            const hasInequality = equation.includes('>') || equation.includes('<') ||
                equation.includes('\\gt') || equation.includes('\\lt') ||
                equation.includes('\\ge') || equation.includes('\\le');
            const hasBlank = equation.includes('\\duoblank');
            if (!hasInequality || !hasBlank) {
                return null;
            }
            this.log('detected INEQUALITY with blank type');
            const answer = this.solveInequalityWithBlank(equation);
            if (answer === null) {
                this.logDebug('could not solve inequality');
                return null;
            }
            this.typeInput(textInput, answer);
            this.log('typed answer:', answer);
            return this.success({
                type: 'typeAnswer',
                equation,
                answer,
            });
        }
        /**
         * Пробует решить как уравнение с пропуском
         */
        trySolveEquationWithBlank(textInput, equation) {
            this.log('solving as equation with blank');
            const answer = this.solveEquationWithBlank(equation);
            if (answer === null) {
                return this.failure('typeAnswer', 'could not solve equation');
            }
            this.typeInput(textInput, answer.toString());
            this.log('typed answer:', answer);
            return this.success({
                type: 'typeAnswer',
                equation,
                answer,
            });
        }
        /**
         * Решает уравнение с пропуском (e.g., "_ + 4 = 7")
         */
        solveEquationWithBlank(equation) {
            // Clean and prepare the equation
            let cleaned = equation
                .replace(/\\duoblank\{[^}]*\}/g, 'X') // Replace \duoblank with X
                .replace(/\s+/g, ''); // Remove whitespace
            cleaned = cleanLatexWrappers(cleaned);
            cleaned = cleanLatexForEval(cleaned);
            this.logDebug('cleaned equation:', cleaned);
            // Split by = to get left and right sides
            const parts = cleaned.split('=');
            if (parts.length !== 2) {
                this.logDebug('equation does not have exactly one =');
                return null;
            }
            const [left, right] = parts;
            // Determine which side has X and solve
            if (left?.includes('X') && right) {
                return this.solveForX(left, right);
            }
            else if (right?.includes('X') && left) {
                return this.solveForX(right, left);
            }
            this.logDebug('X not found in equation');
            return null;
        }
        /**
         * Решает выражение с X
         */
        solveForX(exprWithX, otherSide) {
            const targetValue = evaluateMathExpression(otherSide);
            if (targetValue === null) {
                this.logDebug('could not evaluate other side');
                return null;
            }
            // Try different values for X using binary search or simple iteration
            // For simple cases like "X + 4" or "X - 3", we can solve algebraically
            const simplePatterns = [
                { pattern: /^X\+(\d+)$/, solve: (n) => targetValue - n },
                { pattern: /^X-(\d+)$/, solve: (n) => targetValue + n },
                { pattern: /^(\d+)\+X$/, solve: (n) => targetValue - n },
                { pattern: /^(\d+)-X$/, solve: (n) => n - targetValue },
                { pattern: /^X\*(\d+)$/, solve: (n) => targetValue / n },
                { pattern: /^(\d+)\*X$/, solve: (n) => targetValue / n },
                { pattern: /^X\/(\d+)$/, solve: (n) => targetValue * n },
                { pattern: /^(\d+)\/X$/, solve: (n) => n / targetValue },
                { pattern: /^X$/, solve: () => targetValue },
            ];
            for (const { pattern, solve } of simplePatterns) {
                const match = exprWithX.match(pattern);
                if (match) {
                    const n = match[1] ? parseInt(match[1], 10) : 0;
                    const result = solve(n);
                    if (Number.isFinite(result) && Number.isInteger(result)) {
                        return result;
                    }
                }
            }
            // Fallback: try brute force for small integers
            for (let x = -100; x <= 100; x++) {
                const testExpr = exprWithX.replace(/X/g, `(${x})`);
                const testResult = evaluateMathExpression(testExpr);
                if (testResult !== null && Math.abs(testResult - targetValue) < 0.0001) {
                    return x;
                }
            }
            this.logDebug('could not solve for X');
            return null;
        }
        /**
         * Решает неравенство с пропуском
         */
        solveInequalityWithBlank(equation) {
            let cleaned = cleanLatexWrappers(equation);
            // Detect operator
            let operator = null;
            if (cleaned.includes('>=') || cleaned.includes('\\ge')) {
                operator = '>=';
            }
            else if (cleaned.includes('<=') || cleaned.includes('\\le')) {
                operator = '<=';
            }
            else if (cleaned.includes('>') || cleaned.includes('\\gt')) {
                operator = '>';
            }
            else if (cleaned.includes('<') || cleaned.includes('\\lt')) {
                operator = '<';
            }
            if (!operator)
                return null;
            // Normalize the operator in the string
            cleaned = cleaned
                .replace(/\\ge/g, '>=')
                .replace(/\\le/g, '<=')
                .replace(/\\gt/g, '>')
                .replace(/\\lt/g, '<');
            // Split by operator
            const operatorRegex = />=|<=|>|</;
            const parts = cleaned.split(operatorRegex);
            if (parts.length !== 2)
                return null;
            const [leftStr, rightStr] = parts;
            // Find which side has the blank
            const leftHasBlank = leftStr?.includes('\\duoblank');
            const rightHasBlank = rightStr?.includes('\\duoblank');
            if (!leftHasBlank && !rightHasBlank)
                return null;
            // Evaluate the known side
            const knownSide = leftHasBlank ? rightStr : leftStr;
            if (!knownSide)
                return null;
            const fractionResult = parseFractionExpression(knownSide);
            if (!fractionResult)
                return null;
            const knownValue = fractionResult.value;
            const knownDenom = fractionResult.denominator;
            // Find a fraction that satisfies the inequality
            // Use the same denominator for simplicity
            let targetNum;
            if (leftHasBlank) {
                // ? [op] known
                switch (operator) {
                    case '>':
                        targetNum = Math.floor(knownValue * knownDenom) + 1;
                        break;
                    case '>=':
                        targetNum = Math.ceil(knownValue * knownDenom);
                        break;
                    case '<':
                        targetNum = Math.ceil(knownValue * knownDenom) - 1;
                        break;
                    case '<=':
                        targetNum = Math.floor(knownValue * knownDenom);
                        break;
                    default: return null;
                }
            }
            else {
                // known [op] ?
                switch (operator) {
                    case '>':
                        targetNum = Math.ceil(knownValue * knownDenom) - 1;
                        break;
                    case '>=':
                        targetNum = Math.floor(knownValue * knownDenom);
                        break;
                    case '<':
                        targetNum = Math.floor(knownValue * knownDenom) + 1;
                        break;
                    case '<=':
                        targetNum = Math.ceil(knownValue * knownDenom);
                        break;
                    default: return null;
                }
            }
            // Return as fraction string
            if (targetNum <= 0)
                targetNum = 1; // Ensure positive
            return `${targetNum}/${knownDenom}`;
        }
    }

    /**
     * Солвер для заданий "Select the equivalent fraction"
     *
     * Находит дробь с равным значением среди вариантов ответа.
     * Например: 2/4 эквивалентна 1/2
     */
    class SelectEquivalentFractionSolver extends BaseSolver {
        name = 'SelectEquivalentFractionSolver';
        /**
         * Проверяет, является ли задание на выбор эквивалентной дроби
         */
        canSolve(context) {
            // Check header for "equivalent" or "equal"
            const headerText = this.getHeaderText(context);
            const isEquivalent = headerText.includes('equivalent') ||
                headerText.includes('equal') ||
                headerText.includes('same');
            // Must have choices and equation container with fraction
            const hasChoices = context.choices != null && context.choices.length > 0;
            const hasEquation = context.equationContainer != null;
            return isEquivalent && hasChoices && hasEquation;
        }
        /**
         * Решает задание
         */
        solve(context) {
            if (!context.equationContainer || !context.choices?.length) {
                return this.failure('selectFraction', 'missing equationContainer or choices');
            }
            this.log('starting');
            // Extract target fraction from equation
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent) {
                return this.failure('selectFraction', 'annotation not found');
            }
            const targetFraction = parseFractionExpression(annotation.textContent);
            if (!targetFraction) {
                return this.failure('selectFraction', 'could not parse target fraction');
            }
            this.log('target =', `${targetFraction.numerator}/${targetFraction.denominator}`, '=', targetFraction.value);
            // Find equivalent fraction among choices
            let matchedIndex = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const choiceAnnotation = choice.querySelector('annotation');
                if (!choiceAnnotation?.textContent)
                    continue;
                const choiceFraction = parseFractionExpression(choiceAnnotation.textContent);
                if (!choiceFraction)
                    continue;
                this.logDebug('choice', i, '=', `${choiceFraction.numerator}/${choiceFraction.denominator}`);
                if (areFractionsEqual(targetFraction.numerator, targetFraction.denominator, choiceFraction.numerator, choiceFraction.denominator)) {
                    matchedIndex = i;
                    this.log('found equivalent at choice', i);
                    break;
                }
            }
            if (matchedIndex === -1) {
                return this.failure('selectFraction', 'no equivalent fraction found');
            }
            const matchedChoice = context.choices[matchedIndex];
            if (matchedChoice) {
                this.click(matchedChoice);
                this.log('clicked choice', matchedIndex);
            }
            return this.success({
                type: 'selectFraction',
                original: targetFraction,
                selectedChoice: matchedIndex,
            });
        }
    }

    /**
     * Солвер для заданий на сравнение с выбором ответа
     *
     * Например: "1/4 > ?" с вариантами "1/5" и "5/4"
     * Нужно найти вариант, который делает сравнение истинным.
     */
    class ComparisonChoiceSolver extends BaseSolver {
        name = 'ComparisonChoiceSolver';
        /**
         * Проверяет, является ли задание на сравнение
         */
        canSolve(context) {
            if (!context.equationContainer || !context.choices?.length) {
                return false;
            }
            // Check if equation contains comparison operator and blank
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent)
                return false;
            const text = annotation.textContent;
            const hasComparison = text.includes('>') || text.includes('<') ||
                text.includes('\\gt') || text.includes('\\lt') ||
                text.includes('\\ge') || text.includes('\\le');
            const hasBlank = text.includes('\\duoblank');
            return hasComparison && hasBlank;
        }
        /**
         * Решает задание
         */
        solve(context) {
            if (!context.equationContainer || !context.choices?.length) {
                return this.failure('comparison', 'missing equationContainer or choices');
            }
            this.log('starting');
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent) {
                return this.failure('comparison', 'annotation not found');
            }
            const eqText = annotation.textContent;
            this.log('equation =', eqText);
            // Detect comparison operator
            const operator = this.detectOperator(eqText);
            if (!operator) {
                return this.failure('comparison', 'no comparison operator found');
            }
            this.log('operator =', operator);
            // Extract and evaluate left side value
            const leftValue = this.extractLeftValue(eqText, operator);
            if (leftValue === null) {
                return this.failure('comparison', 'could not evaluate left side');
            }
            this.log('left value =', leftValue);
            // Find choice that makes comparison true
            let matchedIndex = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const choiceAnnotation = choice.querySelector('annotation');
                if (!choiceAnnotation?.textContent)
                    continue;
                const choiceFraction = parseFractionExpression(choiceAnnotation.textContent);
                if (!choiceFraction)
                    continue;
                const choiceValue = choiceFraction.value;
                this.logDebug('choice', i, '=', choiceValue);
                if (this.compareValues(leftValue, operator, choiceValue)) {
                    matchedIndex = i;
                    this.log('found matching choice', i, ':', leftValue, operator, choiceValue);
                    break;
                }
            }
            if (matchedIndex === -1) {
                return this.failure('comparison', 'no choice satisfies comparison');
            }
            const matchedChoice = context.choices[matchedIndex];
            if (matchedChoice) {
                this.click(matchedChoice);
                this.log('clicked choice', matchedIndex);
            }
            return this.success({
                type: 'comparison',
                leftValue,
                operator,
                selectedChoice: matchedIndex,
            });
        }
        /**
         * Определяет оператор сравнения
         */
        detectOperator(text) {
            if (text.includes('<=') || text.includes('\\le'))
                return '<=';
            if (text.includes('>=') || text.includes('\\ge'))
                return '>=';
            if (text.includes('<') || text.includes('\\lt'))
                return '<';
            if (text.includes('>') || text.includes('\\gt'))
                return '>';
            return null;
        }
        /**
         * Извлекает значение левой части выражения
         */
        extractLeftValue(eqText, _operator) {
            const cleaned = cleanLatexWrappers(eqText);
            // Split by operator to get left side
            const operators = ['<=', '>=', '\\le', '\\ge', '<', '>', '\\lt', '\\gt'];
            let leftSide = cleaned;
            for (const op of operators) {
                if (leftSide.includes(op)) {
                    const splitResult = leftSide.split(op)[0];
                    if (splitResult !== undefined) {
                        leftSide = splitResult;
                    }
                    break;
                }
            }
            // Convert fractions to evaluable format
            leftSide = convertLatexFractions(leftSide);
            return evaluateMathExpression(leftSide);
        }
        /**
         * Сравнивает два значения
         */
        compareValues(left, operator, right) {
            switch (operator) {
                case '<': return left < right;
                case '>': return left > right;
                case '<=': return left <= right;
                case '>=': return left >= right;
            }
        }
    }

    /**
     * Солвер для заданий на выбор оператора сравнения
     *
     * Например: "1/2 _ 1/4" с вариантами "<", ">", "="
     * Нужно выбрать правильный оператор.
     */
    class SelectOperatorSolver extends BaseSolver {
        name = 'SelectOperatorSolver';
        /**
         * Проверяет, является ли задание на выбор оператора
         */
        canSolve(context) {
            if (!context.equationContainer || !context.choices?.length) {
                return false;
            }
            // Check if equation contains blank between two values
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent)
                return false;
            const text = annotation.textContent;
            const hasBlank = text.includes('\\duoblank');
            // Check if choices contain operators
            const hasOperatorChoices = context.choices.some(choice => {
                const choiceText = choice?.textContent?.trim() ?? '';
                return choiceText === '<' || choiceText === '>' || choiceText === '=' ||
                    choiceText.includes('\\lt') || choiceText.includes('\\gt');
            });
            return hasBlank && hasOperatorChoices;
        }
        /**
         * Решает задание
         */
        solve(context) {
            if (!context.equationContainer || !context.choices?.length) {
                return this.failure('selectOperator', 'missing equationContainer or choices');
            }
            this.log('starting');
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent) {
                return this.failure('selectOperator', 'annotation not found');
            }
            const eqText = annotation.textContent;
            this.log('equation =', eqText);
            // Extract left and right values
            const values = this.extractValues(eqText);
            if (!values) {
                return this.failure('selectOperator', 'could not extract values');
            }
            const { leftValue, rightValue } = values;
            this.log('left =', leftValue, ', right =', rightValue);
            // Determine correct operator
            const correctOperator = this.determineOperator(leftValue, rightValue);
            this.log('correct operator =', correctOperator);
            // Find choice with correct operator
            let matchedIndex = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const choiceOperator = this.parseOperatorFromChoice(choice);
                this.logDebug('choice', i, '=', choiceOperator);
                if (choiceOperator === correctOperator) {
                    matchedIndex = i;
                    this.log('found matching choice', i);
                    break;
                }
            }
            if (matchedIndex === -1) {
                return this.failure('selectOperator', 'no choice matches correct operator');
            }
            const matchedChoice = context.choices[matchedIndex];
            if (matchedChoice) {
                this.click(matchedChoice);
                this.log('clicked choice', matchedIndex);
            }
            return this.success({
                type: 'selectOperator',
                leftValue,
                rightValue,
                operator: correctOperator,
                selectedChoice: matchedIndex,
            });
        }
        /**
         * Извлекает левое и правое значения из уравнения
         */
        extractValues(eqText) {
            let cleaned = cleanLatexWrappers(eqText);
            // Replace blank with marker
            cleaned = cleaned.replace(/\\duoblank\{[^}]*\}/g, ' BLANK ');
            // Remove LaTeX spacing
            cleaned = cleaned.replace(/\\[;,]/g, ' ');
            cleaned = cleaned.replace(/\\quad/g, ' ');
            cleaned = cleaned.replace(/\s+/g, ' ').trim();
            // Split by BLANK
            const parts = cleaned.split('BLANK');
            if (parts.length !== 2 || !parts[0] || !parts[1]) {
                this.logError('could not split by BLANK');
                return null;
            }
            let leftPart = parts[0].trim();
            let rightPart = parts[1].trim();
            // Remove outer braces
            leftPart = this.removeBraces(leftPart);
            rightPart = this.removeBraces(rightPart);
            // Convert fractions
            leftPart = convertLatexFractions(leftPart);
            rightPart = convertLatexFractions(rightPart);
            // Remove remaining braces
            leftPart = leftPart.replace(/[{}]/g, '').trim();
            rightPart = rightPart.replace(/[{}]/g, '').trim();
            // Evaluate
            const leftValue = evaluateMathExpression(leftPart);
            const rightValue = evaluateMathExpression(rightPart);
            if (leftValue === null || rightValue === null) {
                this.logError('could not evaluate values');
                return null;
            }
            return { leftValue, rightValue };
        }
        /**
         * Удаляет внешние скобки
         */
        removeBraces(str) {
            let result = str.trim();
            if (result.startsWith('{') && result.endsWith('}')) {
                result = result.substring(1, result.length - 1);
            }
            return result;
        }
        /**
         * Определяет правильный оператор
         */
        determineOperator(left, right) {
            const epsilon = 0.0001;
            if (Math.abs(left - right) < epsilon)
                return '=';
            if (left < right)
                return '<';
            return '>';
        }
        /**
         * Извлекает оператор из варианта ответа
         */
        parseOperatorFromChoice(choice) {
            const text = choice.textContent?.trim() ?? '';
            // Check annotation first (for KaTeX)
            const annotation = choice.querySelector('annotation');
            const annotationText = annotation?.textContent?.trim() ?? '';
            const checkText = annotationText || text;
            if (checkText.includes('\\lt') || checkText === '<')
                return '<';
            if (checkText.includes('\\gt') || checkText === '>')
                return '>';
            if (checkText === '=' || checkText.includes('='))
                return '=';
            return null;
        }
    }

    /**
     * AutoDuo - Auto-solve Duolingo Math challenges
     *
     * Точка входа приложения
     */
    /**
     * Инициализация скрипта
     */
    function init() {
        logger.info(`AutoDuo v${CONFIG.version} initialized`);
        // TODO: Здесь будет инициализация UI и основного цикла
        // После миграции всей логики из script.js
    }
    // Запуск при загрузке страницы
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        }
        else {
            init();
        }
    }

    exports.BaseSolver = BaseSolver;
    exports.CONFIG = CONFIG;
    exports.ComparisonChoiceSolver = ComparisonChoiceSolver;
    exports.LOG = LOG;
    exports.LOG_DEBUG = LOG_DEBUG;
    exports.LOG_ERROR = LOG_ERROR;
    exports.LOG_WARN = LOG_WARN;
    exports.PATTERNS = PATTERNS;
    exports.RoundToNearestSolver = RoundToNearestSolver;
    exports.SELECTORS = SELECTORS;
    exports.SelectEquivalentFractionSolver = SelectEquivalentFractionSolver;
    exports.SelectOperatorSolver = SelectOperatorSolver;
    exports.TypeAnswerSolver = TypeAnswerSolver;
    exports.addFractions = addFractions;
    exports.areFractionsEqual = areFractionsEqual;
    exports.ceilToNearest = ceilToNearest;
    exports.clamp = clamp;
    exports.cleanAnnotationText = cleanAnnotationText;
    exports.cleanLatexForEval = cleanLatexForEval;
    exports.cleanLatexWrappers = cleanLatexWrappers;
    exports.compareFractions = compareFractions;
    exports.convertLatexFractions = convertLatexFractions;
    exports.convertLatexOperators = convertLatexOperators;
    exports.delay = delay;
    exports.divideFractions = divideFractions;
    exports.evaluateMathExpression = evaluateMathExpression;
    exports.extractAnnotationText = extractAnnotationText;
    exports.extractBlockDiagramValue = extractBlockDiagramValue;
    exports.extractKatexNumber = extractKatexNumber;
    exports.extractKatexValue = extractKatexValue;
    exports.extractLatexContent = extractLatexContent;
    exports.extractPieChartFraction = extractPieChartFraction;
    exports.extractRoundingBase = extractRoundingBase;
    exports.floorToNearest = floorToNearest;
    exports.gcd = gcd;
    exports.isBlockDiagram = isBlockDiagram;
    exports.isDigitsOnly = isDigitsOnly;
    exports.isFractionString = isFractionString;
    exports.isNumber = isNumber;
    exports.isPieChart = isPieChart;
    exports.isValidMathExpression = isValidMathExpression;
    exports.lcm = lcm;
    exports.logger = logger;
    exports.multiplyFractions = multiplyFractions;
    exports.normalizeWhitespace = normalizeWhitespace;
    exports.parseFractionExpression = parseFractionExpression;
    exports.parseSimpleFraction = parseSimpleFraction;
    exports.roundToNearest = roundToNearest;
    exports.safeParseFloat = safeParseFloat;
    exports.safeParseInt = safeParseInt;
    exports.setLogPanel = setLogPanel;
    exports.simplifyFraction = simplifyFraction;
    exports.simplifyFractionWithValue = simplifyFractionWithValue;
    exports.subtractFractions = subtractFractions;

    return exports;

})({});
