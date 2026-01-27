/**
 * Конфигурация AutoDuo
 */
export const CONFIG = {
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
} as const;

/**
 * CSS селекторы элементов Duolingo
 */
export const SELECTORS = {
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
} as const;

/**
 * Регулярные выражения для парсинга
 */
export const PATTERNS = {
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
} as const;
