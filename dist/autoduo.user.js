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

    exports.CONFIG = CONFIG;
    exports.LOG = LOG;
    exports.LOG_DEBUG = LOG_DEBUG;
    exports.LOG_ERROR = LOG_ERROR;
    exports.LOG_WARN = LOG_WARN;
    exports.PATTERNS = PATTERNS;
    exports.SELECTORS = SELECTORS;
    exports.addFractions = addFractions;
    exports.areFractionsEqual = areFractionsEqual;
    exports.ceilToNearest = ceilToNearest;
    exports.clamp = clamp;
    exports.compareFractions = compareFractions;
    exports.delay = delay;
    exports.divideFractions = divideFractions;
    exports.extractRoundingBase = extractRoundingBase;
    exports.floorToNearest = floorToNearest;
    exports.gcd = gcd;
    exports.isDigitsOnly = isDigitsOnly;
    exports.isNumber = isNumber;
    exports.lcm = lcm;
    exports.logger = logger;
    exports.multiplyFractions = multiplyFractions;
    exports.normalizeWhitespace = normalizeWhitespace;
    exports.roundToNearest = roundToNearest;
    exports.safeParseFloat = safeParseFloat;
    exports.safeParseInt = safeParseInt;
    exports.setLogPanel = setLogPanel;
    exports.simplifyFraction = simplifyFraction;
    exports.simplifyFractionWithValue = simplifyFractionWithValue;
    exports.subtractFractions = subtractFractions;

    return exports;

})({});
