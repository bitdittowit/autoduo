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

    let logPanel = null;
    /**
     * Устанавливает панель логов для вывода сообщений
     */
    function setLogPanel(panel) {
        logPanel = panel;
    }
    /**
     * Выводит сообщение в лог
     */
    function log(level, message, ...args) {
        if (level === 'debug' && !CONFIG.debug) {
            return;
        }
        const formattedArgs = args.length > 0
            ? ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
            : '';
        const fullMessage = `${message}${formattedArgs}`;
        if (logPanel) {
            logPanel.log(fullMessage, level);
        }
        // Дублируем в консоль для отладки
        // (на Duolingo console.log может быть заблокирован)
        // try {
        //     const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
        //     console[consoleMethod](`[AutoDuo] ${fullMessage}`);
        // } catch {
        //     // Игнорируем ошибки консоли
        // }
    }
    /**
     * Логгер с методами для разных уровней
     */
    const logger = {
        debug: (message, ...args) => log('debug', message, ...args),
        info: (message, ...args) => log('info', message, ...args),
        warn: (message, ...args) => log('warn', message, ...args),
        error: (message, ...args) => log('error', message, ...args),
        setLogPanel,
    };
    /**
     * Алиасы для совместимости с существующим кодом
     */
    const LOG = logger.info;
    const LOG_DEBUG = logger.debug;
    const LOG_WARN = logger.warn;
    const LOG_ERROR = logger.error;

    /**
     * Панель логов для отображения в интерфейсе
     */
    class LogPanel {
        container = null;
        content = null;
        maxLines = 100;
        isVisible = true;
        /**
         * Создаёт и показывает панель логов
         */
        show() {
            if (this.container)
                return;
            this.container = document.createElement('div');
            this.container.id = 'autoduo-log-panel';
            this.container.innerHTML = `
            <div style="
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 400px;
                max-height: 300px;
                background: rgba(0, 0, 0, 0.9);
                border: 1px solid #333;
                border-radius: 8px;
                font-family: monospace;
                font-size: 11px;
                color: #fff;
                z-index: 99999;
                overflow: hidden;
            ">
                <div style="
                    padding: 8px 12px;
                    background: #1a1a2e;
                    border-bottom: 1px solid #333;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <span style="font-weight: bold; color: #58cc02;">
                        AutoDuo ${CONFIG.version}
                    </span>
                    <button id="autoduo-log-toggle" style="
                        background: none;
                        border: none;
                        color: #888;
                        cursor: pointer;
                        font-size: 14px;
                    ">−</button>
                </div>
                <div id="autoduo-log-content" style="
                    padding: 8px;
                    max-height: 250px;
                    overflow-y: auto;
                "></div>
            </div>
        `;
            document.body.appendChild(this.container);
            this.content = document.getElementById('autoduo-log-content');
            // Toggle visibility
            const toggle = document.getElementById('autoduo-log-toggle');
            toggle?.addEventListener('click', () => this.toggle());
        }
        /**
         * Скрывает панель
         */
        hide() {
            if (this.container) {
                this.container.remove();
                this.container = null;
                this.content = null;
            }
        }
        /**
         * Переключает видимость контента
         */
        toggle() {
            if (!this.content)
                return;
            this.isVisible = !this.isVisible;
            this.content.style.display = this.isVisible ? 'block' : 'none';
            const toggle = document.getElementById('autoduo-log-toggle');
            if (toggle) {
                toggle.textContent = this.isVisible ? '−' : '+';
            }
        }
        /**
         * Добавляет сообщение в лог
         */
        log(message, level = 'info') {
            if (!this.content)
                return;
            const colors = {
                info: '#fff',
                warn: '#ffc107',
                error: '#dc3545',
                debug: '#6c757d',
            };
            const line = document.createElement('div');
            line.style.color = colors[level] ?? '#fff';
            line.style.marginBottom = '2px';
            line.style.wordBreak = 'break-word';
            const time = new Date().toLocaleTimeString();
            line.textContent = `[${time}] ${message}`;
            this.content.appendChild(line);
            // Limit lines
            while (this.content.children.length > this.maxLines) {
                this.content.firstChild?.remove();
            }
            // Auto-scroll to bottom
            this.content.scrollTop = this.content.scrollHeight;
        }
        /**
         * Очищает лог
         */
        clear() {
            if (this.content) {
                this.content.innerHTML = '';
            }
        }
    }
    // Singleton
    let logPanelInstance = null;
    function getLogPanel() {
        if (!logPanelInstance) {
            logPanelInstance = new LogPanel();
        }
        return logPanelInstance;
    }

    /**
     * Утилиты для взаимодействия с DOM
     */
    /**
     * Симулирует клик по элементу
     */
    function click(element) {
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        });
        element.dispatchEvent(event);
    }
    /**
     * Симулирует нажатие Enter
     */
    function pressEnter() {
        const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
        });
        document.dispatchEvent(event);
    }
    /**
     * Симулирует ввод текста в input (работает с React)
     */
    function typeInput(input, value) {
        // Use native setter to work with React
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
     * Кликает кнопку продолжения/проверки
     */
    function clickContinueButton() {
        const selectors = [
            '[data-test="player-next"]',
            'button[data-test="player-next"]',
        ];
        for (const selector of selectors) {
            const button = document.querySelector(selector);
            if (button && !button.disabled) {
                click(button);
                return true;
            }
        }
        return false;
    }
    /**
     * Задержка выполнения
     */
    function delay$1(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * CSS селекторы для элементов Duolingo
     */
    const SELECTORS = {
        // Challenge containers
        CHALLENGE_CONTAINER: '[data-test="challenge challenge-listenTap"]',
        CHALLENGE_HEADER: '[data-test="challenge-header"]',
        // Choices
        CHALLENGE_CHOICE: '[data-test="challenge-choice"]',
        CHALLENGE_TAP_TOKEN: '[data-test="challenge-tap-token"]',
        // Input elements
        TEXT_INPUT: '[data-test="challenge-text-input"]',
        EQUATION_CONTAINER: '[data-test="challenge-translate-prompt"]',
        // Buttons
        PLAYER_NEXT: '[data-test="player-next"]',
        PRACTICE_AGAIN: '[data-test="practice-again-button"]',
        // States
        BLAME_INCORRECT: '[data-test="blame blame-incorrect"]',
        SESSION_COMPLETE: '[data-test="session-complete-slide"]',
        // Iframes
        MATH_IFRAME: 'iframe[title="Math Web Element"]',
        SANDBOX_IFRAME: 'iframe[sandbox][srcdoc]',
    };
    /**
     * Находит все iframe в контейнере
     */
    function findAllIframes(container) {
        const titled = container.querySelectorAll(SELECTORS.MATH_IFRAME);
        const sandbox = container.querySelectorAll(SELECTORS.SANDBOX_IFRAME);
        // Unique set
        const set = new Set([...titled, ...sandbox]);
        return Array.from(set);
    }
    /**
     * Находит iframe с определённым контентом
     */
    function findIframeByContent(iframes, contentSubstring) {
        for (const iframe of iframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (srcdoc?.includes(contentSubstring)) {
                return iframe;
            }
        }
        return null;
    }

    /**
     * Определяет тип задания и извлекает контекст
     */
    /**
     * Определяет и создаёт контекст текущего задания
     */
    function detectChallenge() {
        // Try to find challenge container
        const containers = document.querySelectorAll('[data-test*="challenge"]');
        for (const container of containers) {
            const dataTest = container.getAttribute('data-test') ?? '';
            if (dataTest.startsWith('challenge ')) {
                return createChallengeContext(container);
            }
        }
        // Fallback: look for specific elements
        const header = document.querySelector(SELECTORS.CHALLENGE_HEADER);
        if (header) {
            const container = header.closest('[data-test]') ?? document.body;
            return createChallengeContext(container);
        }
        logger.debug('detectChallenge: no challenge container found');
        return null;
    }
    /**
     * Создаёт контекст задания из контейнера
     */
    function createChallengeContext(container) {
        const header = container.querySelector(SELECTORS.CHALLENGE_HEADER);
        const equationContainer = container.querySelector(SELECTORS.EQUATION_CONTAINER);
        const textInput = container.querySelector(SELECTORS.TEXT_INPUT);
        const choices = Array.from(container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE));
        const tapTokens = Array.from(container.querySelectorAll(SELECTORS.CHALLENGE_TAP_TOKEN));
        const iframe = container.querySelector(SELECTORS.MATH_IFRAME);
        // Use tap tokens as choices if no regular choices
        const finalChoices = choices.length > 0 ? choices : tapTokens;
        const context = {
            container,
            header,
            headerText: header?.textContent?.toLowerCase() ?? '',
            equationContainer,
            textInput,
            choices: finalChoices.length > 0 ? finalChoices : [],
            iframe,
        };
        logger.debug('createChallengeContext:', {
            hasHeader: !!header,
            hasEquation: !!equationContainer,
            hasInput: !!textInput,
            choicesCount: finalChoices.length,
            hasIframe: !!iframe,
        });
        return context;
    }
    /**
     * Проверяет, находимся ли на экране результата
     */
    function isOnResultScreen() {
        return document.querySelector(SELECTORS.SESSION_COMPLETE) !== null;
    }
    /**
     * Проверяет, был ли ответ неправильным
     */
    function isIncorrect() {
        return document.querySelector(SELECTORS.BLAME_INCORRECT) !== null;
    }
    /**
     * Проверяет, находимся ли на домашней странице
     */
    function isOnHomePage() {
        const url = window.location.href;
        return url.includes('/learn') && !url.includes('/lesson') && !url.includes('/practice');
    }

    var ChallengeDetector = /*#__PURE__*/Object.freeze({
        __proto__: null,
        detectChallenge: detectChallenge,
        isIncorrect: isIncorrect,
        isOnHomePage: isOnHomePage,
        isOnResultScreen: isOnResultScreen
    });

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
     * Солвер для заданий с выбором круговой диаграммы
     *
     * Показывается уравнение (например, 1/3 + 1/3 = ?) или дробь (1/4),
     * и несколько вариантов круговых диаграмм. Нужно выбрать подходящую.
     */
    class SelectPieChartSolver extends BaseSolver {
        name = 'SelectPieChartSolver';
        /**
         * Проверяет, является ли задание на выбор круговой диаграммы
         */
        canSolve(context) {
            if (!context.choices?.length)
                return false;
            // Check if choices contain pie chart iframes
            const hasPieChartChoices = context.choices.some(choice => {
                const iframe = choice?.querySelector('iframe[title="Math Web Element"]');
                if (!iframe)
                    return false;
                const srcdoc = iframe.getAttribute('srcdoc');
                return srcdoc?.includes('<circle') || srcdoc?.includes('fill="#');
            });
            return hasPieChartChoices;
        }
        /**
         * Решает задание
         */
        solve(context) {
            if (!context.choices?.length) {
                return this.failure('selectPieChart', 'no choices found');
            }
            this.log('starting');
            // Get target value from equation
            const targetValue = this.extractTargetValue(context);
            if (targetValue === null) {
                return this.failure('selectPieChart', 'could not determine target value');
            }
            this.log('target value =', targetValue);
            // Find matching pie chart
            let matchedIndex = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const iframe = choice.querySelector('iframe[title="Math Web Element"]');
                if (!iframe)
                    continue;
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                const fraction = extractPieChartFraction(srcdoc);
                if (!fraction)
                    continue;
                this.logDebug('choice', i, '=', `${fraction.numerator}/${fraction.denominator}`, '=', fraction.value);
                // Check if values match (with tolerance for floating point)
                if (Math.abs(fraction.value - targetValue) < 0.0001) {
                    matchedIndex = i;
                    this.log('found matching choice', i);
                    break;
                }
            }
            if (matchedIndex === -1) {
                return this.failure('selectPieChart', 'no matching pie chart found');
            }
            const matchedChoice = context.choices[matchedIndex];
            if (matchedChoice) {
                this.click(matchedChoice);
                this.log('clicked choice', matchedIndex);
            }
            return this.success({
                type: 'selectPieChart',
                targetValue,
                selectedChoice: matchedIndex,
            });
        }
        /**
         * Извлекает целевое значение из уравнения
         */
        extractTargetValue(context) {
            if (!context.equationContainer)
                return null;
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent)
                return null;
            const equation = annotation.textContent;
            this.log('equation =', equation);
            // Clean and convert the expression
            let cleaned = cleanLatexWrappers(equation);
            cleaned = cleaned.replace(/\\duoblank\{[^}]*\}/g, '');
            cleaned = convertLatexFractions(cleaned);
            cleaned = cleaned.replace(/\s+/g, '');
            // If there's an = sign, evaluate the left side
            if (cleaned.includes('=')) {
                const leftSide = cleaned.split('=')[0];
                if (leftSide) {
                    return evaluateMathExpression(leftSide);
                }
            }
            // Otherwise evaluate the whole expression
            return evaluateMathExpression(cleaned);
        }
    }

    /**
     * Солвер для заданий с круговой диаграммой и текстовым вводом
     *
     * Показывается круговая диаграмма, нужно ввести соответствующую дробь.
     */
    class PieChartTextInputSolver extends BaseSolver {
        name = 'PieChartTextInputSolver';
        /**
         * Проверяет, является ли задание на ввод дроби по круговой диаграмме
         */
        canSolve(context) {
            // Must have iframe with pie chart and text input
            if (!context.iframe || !context.textInput)
                return false;
            // Check if iframe contains a pie chart
            const srcdoc = context.iframe.getAttribute('srcdoc');
            if (!srcdoc)
                return false;
            return srcdoc.includes('<circle') || srcdoc.includes('fill="#');
        }
        /**
         * Решает задание
         */
        solve(context) {
            if (!context.iframe || !context.textInput) {
                return this.failure('pieChartTextInput', 'missing iframe or textInput');
            }
            this.log('starting');
            const srcdoc = context.iframe.getAttribute('srcdoc');
            if (!srcdoc) {
                return this.failure('pieChartTextInput', 'no srcdoc in iframe');
            }
            const fraction = extractPieChartFraction(srcdoc);
            if (!fraction) {
                return this.failure('pieChartTextInput', 'could not extract fraction from pie chart');
            }
            this.log('extracted fraction:', `${fraction.numerator}/${fraction.denominator}`, '=', fraction.value);
            // Format as "numerator/denominator"
            const answer = `${fraction.numerator}/${fraction.denominator}`;
            this.typeInput(context.textInput, answer);
            this.log('typed answer:', answer);
            return this.success({
                type: 'selectFraction',
                original: fraction,
                answer,
            });
        }
    }

    /**
     * Солвер для уравнений с пропуском и выбором ответа
     *
     * Например: "_ + 4 = 7" с вариантами "1", "2", "3"
     * Нужно выбрать правильный вариант.
     */
    class EquationBlankSolver extends BaseSolver {
        name = 'EquationBlankSolver';
        /**
         * Проверяет, является ли задание уравнением с пропуском и выбором
         */
        canSolve(context) {
            if (!context.equationContainer || !context.choices?.length)
                return false;
            // Check if equation has blank and equals sign
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent)
                return false;
            const text = annotation.textContent;
            return text.includes('\\duoblank') && text.includes('=');
        }
        /**
         * Решает задание
         */
        solve(context) {
            if (!context.equationContainer || !context.choices?.length) {
                return this.failure('equationBlank', 'missing equationContainer or choices');
            }
            this.log('starting');
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent) {
                return this.failure('equationBlank', 'annotation not found');
            }
            const equation = annotation.textContent;
            this.log('equation =', equation);
            // Solve for the blank
            const answer = this.solveEquation(equation);
            if (answer === null) {
                return this.failure('equationBlank', 'could not solve equation');
            }
            this.log('solved answer =', answer);
            // Find and click matching choice(s)
            const matchingIndices = [];
            const isMultiSelect = context.choices[0]?.getAttribute('role') === 'checkbox';
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const choiceValue = extractKatexValue(choice);
                if (choiceValue === null)
                    continue;
                this.logDebug('choice', i, '=', choiceValue);
                // Try to evaluate as expression or parse as number
                let choiceNum = null;
                if (/[+\-*/]/.test(choiceValue)) {
                    choiceNum = evaluateMathExpression(choiceValue);
                }
                else {
                    choiceNum = parseFloat(choiceValue);
                    if (Number.isNaN(choiceNum))
                        choiceNum = null;
                }
                if (choiceNum !== null && Math.abs(choiceNum - answer) < 0.0001) {
                    matchingIndices.push(i);
                    this.log('found matching choice at index', i);
                    if (!isMultiSelect)
                        break;
                }
            }
            if (matchingIndices.length === 0) {
                return this.failure('equationBlank', `no matching choice for answer ${answer}`);
            }
            // Click matching choices
            for (const idx of matchingIndices) {
                const choice = context.choices[idx];
                if (choice) {
                    this.click(choice);
                    this.log('clicked choice', idx);
                }
            }
            const firstMatch = matchingIndices[0];
            if (firstMatch === undefined) {
                return this.failure('equationBlank', 'unexpected: no matching indices');
            }
            return this.success({
                type: 'equationBlank',
                equation,
                answer,
                selectedChoice: firstMatch,
            });
        }
        /**
         * Решает уравнение с пропуском
         */
        solveEquation(equation) {
            let cleaned = equation
                .replace(/\\duoblank\{[^}]*\}/g, 'X')
                .replace(/\s+/g, '');
            cleaned = cleanLatexWrappers(cleaned);
            cleaned = convertLatexOperators(cleaned);
            cleaned = convertLatexFractions(cleaned);
            // Split by = to get both sides
            const parts = cleaned.split('=');
            if (parts.length !== 2 || !parts[0] || !parts[1])
                return null;
            const [left, right] = parts;
            // Determine which side has X
            if (left.includes('X')) {
                return this.solveForX(left, right);
            }
            else if (right.includes('X')) {
                return this.solveForX(right, left);
            }
            return null;
        }
        /**
         * Решает выражение относительно X
         */
        solveForX(exprWithX, otherSide) {
            const target = evaluateMathExpression(otherSide);
            if (target === null)
                return null;
            // Simple patterns
            const patterns = [
                { pattern: /^X\+(\d+)$/, solve: (n) => target - n },
                { pattern: /^X-(\d+)$/, solve: (n) => target + n },
                { pattern: /^(\d+)\+X$/, solve: (n) => target - n },
                { pattern: /^(\d+)-X$/, solve: (n) => n - target },
                { pattern: /^X\*(\d+)$/, solve: (n) => target / n },
                { pattern: /^(\d+)\*X$/, solve: (n) => target / n },
                { pattern: /^X\/(\d+)$/, solve: (n) => target * n },
                { pattern: /^X$/, solve: () => target },
            ];
            for (const { pattern, solve } of patterns) {
                const match = exprWithX.match(pattern);
                if (match) {
                    const n = match[1] ? parseInt(match[1], 10) : 0;
                    const result = solve(n);
                    if (Number.isFinite(result))
                        return result;
                }
            }
            // Brute force for complex expressions
            for (let x = -100; x <= 100; x++) {
                const testExpr = exprWithX.replace(/X/g, `(${x})`);
                const testResult = evaluateMathExpression(testExpr);
                if (testResult !== null && Math.abs(testResult - target) < 0.0001) {
                    return x;
                }
            }
            return null;
        }
    }

    /**
     * Солвер для заданий "Match the pairs"
     * Сопоставляет элементы по значениям: дроби, pie charts, округление
     */
    class MatchPairsSolver extends BaseSolver {
        name = 'MatchPairsSolver';
        canSolve(context) {
            // Match pairs have tap tokens and usually "Match" in header
            const hasHeader = this.headerContains(context, 'match', 'pair');
            const hasTapTokens = (context.choices?.length ?? 0) >= 4;
            // Check for tap token elements specifically
            const tapTokens = context.container.querySelectorAll('[data-test="challenge-tap-token"]');
            return (hasHeader || tapTokens.length >= 4) && hasTapTokens;
        }
        solve(context) {
            this.log('starting');
            const tapTokens = context.container.querySelectorAll('[data-test="challenge-tap-token"]');
            if (tapTokens.length < 2) {
                return this.failure('matchPairs', 'Not enough tap tokens');
            }
            // Extract values from all tokens
            const tokens = this.extractTokens(Array.from(tapTokens));
            this.log('active tokens:', tokens.length);
            if (tokens.length < 2) {
                return this.failure('matchPairs', 'Not enough active tokens');
            }
            // Find matching pairs
            const pairs = this.findPairs(tokens);
            if (pairs.length === 0) {
                this.logError('no matching pairs found');
                return this.failure('matchPairs', 'No matching pairs found');
            }
            // Click the first pair
            const pair = pairs[0];
            if (!pair) {
                return this.failure('matchPairs', 'No pair to click');
            }
            this.log('clicking pair:', pair.first.rawValue, '↔', pair.second.rawValue);
            this.click(pair.first.element);
            // Click second with delay
            setTimeout(() => {
                this.click(pair.second.element);
            }, 100);
            return this.success({
                type: 'matchPairs',
                pairs: pairs.map(p => ({
                    first: p.first.rawValue,
                    second: p.second.rawValue,
                })),
                clickedPair: {
                    first: pair.first.rawValue,
                    second: pair.second.rawValue,
                },
            });
        }
        extractTokens(tapTokens) {
            const tokens = [];
            let hasNearestRounding = false;
            let roundingBase = 10;
            for (let i = 0; i < tapTokens.length; i++) {
                const token = tapTokens[i];
                if (!token)
                    continue;
                // Skip disabled tokens
                if (token.getAttribute('aria-disabled') === 'true') {
                    continue;
                }
                // Check for "Nearest X" label
                const nearestLabel = token.querySelector('._27M4R');
                if (nearestLabel) {
                    const labelText = nearestLabel.textContent ?? '';
                    const nearestMatch = labelText.match(/Nearest\s*(\d+)/i);
                    if (nearestMatch?.[1]) {
                        hasNearestRounding = true;
                        roundingBase = parseInt(nearestMatch[1], 10);
                        const tokenData = this.extractRoundingToken(token, i, roundingBase);
                        if (tokenData) {
                            tokens.push(tokenData);
                            continue;
                        }
                    }
                }
                // Check for iframe with pie chart or block diagram
                const iframe = token.querySelector('iframe[title="Math Web Element"]');
                if (iframe && !nearestLabel) {
                    const srcdoc = iframe.getAttribute('srcdoc');
                    if (srcdoc?.includes('<svg')) {
                        const fraction = extractPieChartFraction(srcdoc);
                        if (fraction) {
                            tokens.push({
                                index: i,
                                element: token,
                                rawValue: `${fraction.numerator}/${fraction.denominator} (pie)`,
                                numericValue: fraction.value,
                                isPieChart: true,
                            });
                            continue;
                        }
                    }
                }
                // Extract KaTeX value
                const value = extractKatexValue(token);
                if (value) {
                    const evaluated = evaluateMathExpression(value);
                    const isCompound = this.isCompoundExpression(value);
                    tokens.push({
                        index: i,
                        element: token,
                        rawValue: value,
                        numericValue: evaluated,
                        isExpression: isCompound,
                        isPieChart: false,
                    });
                }
            }
            // Store for use in findPairs
            this.hasNearestRounding = hasNearestRounding;
            this.roundingBase = roundingBase;
            return tokens;
        }
        hasNearestRounding = false;
        roundingBase = 10;
        extractRoundingToken(token, index, roundingBase) {
            // Check for block diagram first
            const iframe = token.querySelector('iframe[title="Math Web Element"]');
            if (iframe) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc) {
                    const blockCount = extractBlockDiagramValue(srcdoc);
                    if (blockCount !== null) {
                        return {
                            index,
                            element: token,
                            rawValue: `${blockCount} blocks`,
                            numericValue: blockCount,
                            isBlockDiagram: true,
                            isRoundingTarget: true,
                            roundingBase,
                        };
                    }
                }
            }
            // Otherwise KaTeX number
            const value = extractKatexValue(token);
            if (value) {
                const evaluated = evaluateMathExpression(value);
                return {
                    index,
                    element: token,
                    rawValue: value,
                    numericValue: evaluated,
                    isBlockDiagram: false,
                    isRoundingTarget: true,
                    roundingBase,
                };
            }
            return null;
        }
        isCompoundExpression(value) {
            return (value.includes('+') ||
                value.includes('*') ||
                /\)\s*-/.test(value) ||
                /\d\s*-\s*\(/.test(value));
        }
        findPairs(tokens) {
            const pairs = [];
            const usedIndices = new Set();
            const pieCharts = tokens.filter(t => t.isPieChart);
            const roundingTargets = tokens.filter(t => t.isRoundingTarget);
            const numbers = tokens.filter(t => !t.isPieChart && !t.isBlockDiagram);
            // MODE 1: Rounding matching
            if (this.hasNearestRounding && roundingTargets.length > 0) {
                this.matchRounding(tokens, roundingTargets, pairs, usedIndices);
            }
            // MODE 2: Pie chart matching
            else if (pieCharts.length > 0 && numbers.length > 0) {
                this.matchPieCharts(pieCharts, numbers, pairs, usedIndices);
            }
            // MODE 3: Expression matching
            else {
                this.matchExpressions(tokens, pairs, usedIndices);
            }
            return pairs;
        }
        matchRounding(tokens, roundingTargets, pairs, usedIndices) {
            const numbers = tokens.filter(t => !t.isPieChart && !t.isBlockDiagram && !t.isRoundingTarget);
            for (const num of numbers) {
                if (usedIndices.has(num.index) || num.numericValue === null)
                    continue;
                const rounded = roundToNearest(num.numericValue, this.roundingBase);
                for (const target of roundingTargets) {
                    if (usedIndices.has(target.index))
                        continue;
                    if (target.numericValue === rounded) {
                        pairs.push({ first: num, second: target });
                        usedIndices.add(num.index);
                        usedIndices.add(target.index);
                        this.log('found rounding pair:', num.rawValue, '→', rounded);
                        break;
                    }
                }
            }
        }
        matchPieCharts(pieCharts, numbers, pairs, usedIndices) {
            for (const pie of pieCharts) {
                if (pie.numericValue === null)
                    continue;
                for (const frac of numbers) {
                    if (usedIndices.has(frac.index) || frac.numericValue === null) {
                        continue;
                    }
                    if (Math.abs(pie.numericValue - frac.numericValue) < 0.0001) {
                        pairs.push({ first: pie, second: frac });
                        usedIndices.add(frac.index);
                        this.log('found pie chart pair:', pie.rawValue, '=', frac.rawValue);
                        break;
                    }
                }
            }
        }
        matchExpressions(tokens, pairs, usedIndices) {
            const expressions = tokens.filter(t => t.isExpression && !t.isRoundingTarget);
            const simpleFractions = tokens.filter(t => !t.isExpression && !t.isRoundingTarget && !t.isPieChart && !t.isBlockDiagram);
            if (expressions.length > 0 && simpleFractions.length > 0) {
                for (const expr of expressions) {
                    if (expr.numericValue === null)
                        continue;
                    for (const frac of simpleFractions) {
                        if (usedIndices.has(frac.index) || frac.numericValue === null) {
                            continue;
                        }
                        if (Math.abs(expr.numericValue - frac.numericValue) < 0.0001) {
                            pairs.push({ first: expr, second: frac });
                            usedIndices.add(frac.index);
                            this.log('found expression pair:', expr.rawValue, '=', frac.rawValue);
                            break;
                        }
                    }
                }
            }
            else {
                // Fallback: match any tokens with same numeric value
                this.matchFallback(tokens, pairs, usedIndices);
            }
        }
        matchFallback(tokens, pairs, usedIndices) {
            const fallbackTokens = tokens.filter(t => !t.isRoundingTarget);
            for (let i = 0; i < fallbackTokens.length; i++) {
                const t1 = fallbackTokens[i];
                if (!t1 || usedIndices.has(t1.index) || t1.numericValue === null) {
                    continue;
                }
                for (let j = i + 1; j < fallbackTokens.length; j++) {
                    const t2 = fallbackTokens[j];
                    if (!t2 || usedIndices.has(t2.index) || t2.numericValue === null) {
                        continue;
                    }
                    if (Math.abs(t1.numericValue - t2.numericValue) < 0.0001 &&
                        t1.rawValue !== t2.rawValue) {
                        pairs.push({ first: t1, second: t2 });
                        usedIndices.add(t1.index);
                        usedIndices.add(t2.index);
                        this.log('found fallback pair:', t1.rawValue, '=', t2.rawValue);
                        break;
                    }
                }
            }
        }
    }

    /**
     * Солвер для интерактивного слайдера
     * Работает с NumberLine в iframe
     */
    class InteractiveSliderSolver extends BaseSolver {
        name = 'InteractiveSliderSolver';
        canSolve(context) {
            // Check for iframe with NumberLine
            const allIframes = findAllIframes(context.container);
            for (const iframe of allIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc?.includes('NumberLine')) {
                    return true;
                }
            }
            return false;
        }
        solve(context) {
            this.log('starting');
            const allIframes = findAllIframes(context.container);
            let targetValue = null;
            let equation = null;
            let sliderIframe = null;
            // Find pie chart + slider combination
            if (allIframes.length >= 2) {
                const pieChartIframe = findIframeByContent(allIframes, '<svg');
                if (pieChartIframe) {
                    const pieSrcdoc = pieChartIframe.getAttribute('srcdoc');
                    if (pieSrcdoc) {
                        const fraction = extractPieChartFraction(pieSrcdoc);
                        if (fraction && fraction.value !== null) {
                            targetValue = fraction.value;
                            equation = `pie chart: ${fraction.numerator}/${fraction.denominator}`;
                            this.log('found pie chart fraction:', equation);
                        }
                    }
                    // Find the slider iframe
                    for (const ifrm of allIframes) {
                        if (ifrm !== pieChartIframe) {
                            const srcdoc = ifrm.getAttribute('srcdoc');
                            if (srcdoc?.includes('NumberLine')) {
                                sliderIframe = ifrm;
                                break;
                            }
                        }
                    }
                }
            }
            // Try rounding challenge
            if (targetValue === null) {
                const result = this.tryRoundingChallenge(context);
                if (result) {
                    targetValue = result.value;
                    equation = result.equation;
                }
            }
            // Try equation with blank
            if (targetValue === null) {
                const result = this.tryEquationChallenge(context);
                if (result) {
                    targetValue = result.value;
                    equation = result.equation;
                }
            }
            // Try expression in KaTeX
            if (targetValue === null) {
                const result = this.tryKatexExpression(context);
                if (result) {
                    targetValue = result.value;
                    equation = result.equation;
                }
            }
            if (targetValue === null) {
                this.logError('could not determine target value');
                return this.failure('interactiveSlider', 'Could not determine target value');
            }
            // Find slider iframe if not found yet
            if (!sliderIframe) {
                sliderIframe = findIframeByContent(allIframes, 'NumberLine');
            }
            if (!sliderIframe) {
                return this.failure('interactiveSlider', 'No slider iframe found');
            }
            // Set the value
            const success = this.setSliderValue(sliderIframe, targetValue);
            this.log('target value =', targetValue, ', success =', success);
            const result = {
                type: 'interactiveSlider',
                success: true,
                answer: targetValue,
            };
            if (equation) {
                result.equation = equation;
            }
            return result;
        }
        tryRoundingChallenge(context) {
            const headerText = this.getHeaderText(context);
            if (!headerText.includes('round') || !headerText.includes('nearest')) {
                return null;
            }
            const baseMatch = headerText.match(/nearest\s*(\d+)/);
            if (!baseMatch?.[1])
                return null;
            const roundingBase = parseInt(baseMatch[1], 10);
            const annotations = context.container.querySelectorAll('annotation');
            for (const annotation of annotations) {
                let text = annotation.textContent?.trim() ?? '';
                text = text.replace(/\\mathbf\{([^}]+)\}/g, '$1');
                text = text.replace(/\\textbf\{([^}]+)\}/g, '$1');
                text = text.replace(/\\htmlClass\{[^}]*\}\{([^}]+)\}/g, '$1');
                const numberToRound = parseInt(text, 10);
                if (!isNaN(numberToRound) && numberToRound > 0) {
                    const rounded = roundToNearest(numberToRound, roundingBase);
                    return {
                        value: rounded,
                        equation: `round(${numberToRound}) to nearest ${roundingBase}`,
                    };
                }
            }
            return null;
        }
        tryEquationChallenge(context) {
            const annotations = context.container.querySelectorAll('annotation');
            for (const annotation of annotations) {
                const text = annotation.textContent;
                if (!text)
                    continue;
                // Equation with blank (duoblank)
                if (text.includes('\\duoblank')) {
                    const result = this.solveEquationWithBlank(text);
                    if (result !== null) {
                        return { value: result, equation: text };
                    }
                }
                // Simple equation like "2+4=?"
                if (text.includes('=') && text.includes('?')) {
                    const match = text.match(/(.+)=\s*\?/);
                    if (match?.[1]) {
                        const leftSide = match[1]
                            .replace(/\\mathbf\{([^}]+)\}/g, '$1')
                            .replace(/\s+/g, '');
                        const result = evaluateMathExpression(leftSide);
                        if (result !== null) {
                            return { value: result, equation: text };
                        }
                    }
                }
            }
            return null;
        }
        tryKatexExpression(context) {
            const katexElements = context.container.querySelectorAll('.katex');
            for (const katex of katexElements) {
                const value = extractKatexValue(katex);
                if (!value)
                    continue;
                const cleanValue = value.replace(/\s/g, '');
                if (/^[\d+\-*/×÷().]+$/.test(cleanValue) &&
                    (value.includes('+') ||
                        value.includes('-') ||
                        value.includes('*') ||
                        value.includes('/'))) {
                    const result = evaluateMathExpression(value);
                    if (result !== null) {
                        return { value: result, equation: value };
                    }
                }
            }
            return null;
        }
        solveEquationWithBlank(equation) {
            // Simple equation solver for duoblank
            // e.g., "3 + \\duoblank{1} = 7" -> 4
            const cleaned = equation
                .replace(/\\mathbf\{([^}]+)\}/g, '$1')
                .replace(/\\duoblank\{\d*\}/g, 'X')
                .replace(/\\times/g, '*')
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .trim();
            // Parse as "left = right" where one side has X
            const eqParts = cleaned.split('=');
            if (eqParts.length !== 2)
                return null;
            const left = eqParts[0]?.trim();
            const right = eqParts[1]?.trim();
            if (!left || !right)
                return null;
            // If X is on left side
            if (left.includes('X')) {
                const rightValue = evaluateMathExpression(right);
                if (rightValue === null)
                    return null;
                // Simple cases: X + a = b, a + X = b, X - a = b, etc.
                if (left === 'X')
                    return rightValue;
                const addMatch = left.match(/X\s*\+\s*(\d+)/);
                if (addMatch?.[1]) {
                    return rightValue - parseInt(addMatch[1], 10);
                }
                const subMatch = left.match(/X\s*-\s*(\d+)/);
                if (subMatch?.[1]) {
                    return rightValue + parseInt(subMatch[1], 10);
                }
                const prefixAddMatch = left.match(/(\d+)\s*\+\s*X/);
                if (prefixAddMatch?.[1]) {
                    return rightValue - parseInt(prefixAddMatch[1], 10);
                }
            }
            // If X is on right side
            if (right.includes('X')) {
                const leftValue = evaluateMathExpression(left);
                if (leftValue === null)
                    return null;
                if (right === 'X')
                    return leftValue;
            }
            return null;
        }
        setSliderValue(iframe, value) {
            let success = false;
            try {
                const iframeWindow = iframe.contentWindow;
                if (!iframeWindow)
                    return false;
                // Method 1: getOutputVariables
                if (typeof iframeWindow.getOutputVariables === 'function') {
                    const vars = iframeWindow.getOutputVariables();
                    if (vars && typeof vars === 'object') {
                        vars.value = value;
                        success = true;
                        this.log('set value via getOutputVariables');
                    }
                }
                // Method 2: OUTPUT_VARS
                if (!success && iframeWindow.OUTPUT_VARS) {
                    iframeWindow.OUTPUT_VARS.value = value;
                    success = true;
                    this.log('set value via OUTPUT_VARS');
                }
                // Trigger callbacks
                if (typeof iframeWindow.postOutputVariables === 'function') {
                    iframeWindow.postOutputVariables();
                }
                if (iframeWindow.duo?.onFirstInteraction) {
                    iframeWindow.duo.onFirstInteraction();
                }
                if (iframeWindow.duoDynamic?.onInteraction) {
                    iframeWindow.duoDynamic.onInteraction();
                }
                // Method 3: mathDiagram
                const diagram = iframeWindow.mathDiagram;
                if (diagram) {
                    if (diagram.sliderInstance?.setValue) {
                        diagram.sliderInstance.setValue(value);
                        success = true;
                    }
                    else if (diagram.slider?.setValue) {
                        diagram.slider.setValue(value);
                        success = true;
                    }
                    else if (diagram.setValue) {
                        diagram.setValue(value);
                        success = true;
                    }
                }
                // Method 4: postMessage fallback
                iframeWindow.postMessage({ type: 'outputVariables', payload: { value } }, '*');
            }
            catch (e) {
                this.logError('error setting slider value:', e);
            }
            return success;
        }
    }

    /**
     * Солвер для интерактивного спиннера (выбор сегментов)
     * Работает с Spinner в iframe
     */
    class InteractiveSpinnerSolver extends BaseSolver {
        name = 'InteractiveSpinnerSolver';
        canSolve(context) {
            const allIframes = findAllIframes(context.container);
            for (const iframe of allIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc?.includes('segments:')) {
                    return true;
                }
            }
            return false;
        }
        solve(context) {
            this.log('starting');
            const allIframes = findAllIframes(context.container);
            const spinnerIframe = findIframeByContent(allIframes, 'segments:');
            if (!spinnerIframe) {
                return this.failure('interactiveSpinner', 'No spinner iframe found');
            }
            const srcdoc = spinnerIframe.getAttribute('srcdoc') ?? '';
            // Get spinner segment count
            const segmentsMatch = srcdoc.match(/segments:\s*(\d+)/);
            const spinnerSegments = segmentsMatch?.[1]
                ? parseInt(segmentsMatch[1], 10)
                : null;
            if (!spinnerSegments) {
                return this.failure('interactiveSpinner', 'Could not determine spinner segments');
            }
            this.logDebug('spinner has', spinnerSegments, 'segments');
            // Try different methods to find the target fraction
            let numerator = null;
            let denominator = null;
            let equation = null;
            // Method 1: Inequality with blank
            const inequalityResult = this.tryInequalityWithBlank(context, spinnerSegments);
            if (inequalityResult) {
                numerator = inequalityResult.numerator;
                denominator = inequalityResult.denominator;
                equation = inequalityResult.equation;
            }
            // Method 2: Equation with fractions
            if (numerator === null) {
                const equationResult = this.tryEquationWithFractions(context, spinnerSegments);
                if (equationResult) {
                    numerator = equationResult.numerator;
                    denominator = equationResult.denominator;
                    equation = equationResult.equation;
                }
            }
            // Method 3: Simple fraction
            if (numerator === null) {
                const fractionResult = this.trySimpleFraction(context);
                if (fractionResult) {
                    numerator = fractionResult.numerator;
                    denominator = fractionResult.denominator;
                    equation = fractionResult.equation;
                }
            }
            // Method 4: KaTeX expression
            if (numerator === null) {
                const katexResult = this.tryKatexExpression(context, spinnerSegments);
                if (katexResult) {
                    numerator = katexResult.numerator;
                    denominator = katexResult.denominator;
                    equation = katexResult.equation;
                }
            }
            if (numerator === null || denominator === null) {
                this.logError('could not extract fraction from challenge');
                return this.failure('interactiveSpinner', 'Could not extract fraction');
            }
            // Adjust numerator if spinner segments don't match denominator
            if (spinnerSegments !== denominator) {
                const fractionValue = numerator / denominator;
                numerator = Math.round(fractionValue * spinnerSegments);
                denominator = spinnerSegments;
                this.log('adjusted to', numerator, '/', denominator);
            }
            // Validate
            if (numerator < 0 || numerator > spinnerSegments) {
                this.logError('invalid numerator', numerator);
                return this.failure('interactiveSpinner', 'Invalid numerator');
            }
            // Set the spinner value
            const success = this.setSpinnerValue(spinnerIframe, numerator);
            this.log('select', numerator, 'segments, success =', success);
            const result = {
                type: 'interactiveSpinner',
                success: true,
                numerator,
                denominator,
            };
            if (equation) {
                result.equation = equation;
            }
            return result;
        }
        tryInequalityWithBlank(context, spinnerSegments) {
            const annotations = context.container.querySelectorAll('annotation');
            for (const annotation of annotations) {
                const text = annotation.textContent ?? '';
                const hasInequality = text.includes('>') ||
                    text.includes('<') ||
                    text.includes('\\gt') ||
                    text.includes('\\lt');
                const hasBlank = text.includes('\\duoblank');
                if (!hasInequality || !hasBlank)
                    continue;
                // Clean LaTeX wrappers
                let cleaned = text;
                while (cleaned.includes('\\mathbf{')) {
                    cleaned = extractLatexContent(cleaned, '\\mathbf');
                }
                // Detect operator
                let operator = null;
                let operatorStr = '';
                if (cleaned.includes('>=') || cleaned.includes('\\ge')) {
                    operator = '>=';
                    operatorStr = cleaned.includes('>=') ? '>=' : '\\ge';
                }
                else if (cleaned.includes('<=') || cleaned.includes('\\le')) {
                    operator = '<=';
                    operatorStr = cleaned.includes('<=') ? '<=' : '\\le';
                }
                else if (cleaned.includes('>') || cleaned.includes('\\gt')) {
                    operator = '>';
                    operatorStr = cleaned.includes('>') ? '>' : '\\gt';
                }
                else if (cleaned.includes('<') || cleaned.includes('\\lt')) {
                    operator = '<';
                    operatorStr = cleaned.includes('<') ? '<' : '\\lt';
                }
                if (!operator)
                    continue;
                const parts = cleaned.split(operatorStr);
                if (parts.length !== 2)
                    continue;
                const leftPart = parts[0]?.trim() ?? '';
                const rightPart = parts[1]?.trim() ?? '';
                const leftHasBlank = leftPart.includes('\\duoblank');
                const knownPart = leftHasBlank ? rightPart : leftPart;
                // Parse known fraction
                let knownValue = null;
                const fracMatch = knownPart.match(/\\frac\{(\d+)\}\{(\d+)\}/);
                if (fracMatch?.[1] && fracMatch[2]) {
                    knownValue =
                        parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10);
                }
                else {
                    const numMatch = knownPart.match(/(\d+)/);
                    if (numMatch?.[1]) {
                        knownValue = parseFloat(numMatch[1]);
                    }
                }
                if (knownValue === null)
                    continue;
                // Find valid numerator based on inequality
                let targetNumerator = null;
                if (leftHasBlank) {
                    // Blank on LEFT
                    if (operator === '>' || operator === '>=') {
                        for (let n = 0; n <= spinnerSegments; n++) {
                            const testValue = n / spinnerSegments;
                            if (operator === '>='
                                ? testValue >= knownValue
                                : testValue > knownValue) {
                                targetNumerator = n;
                                break;
                            }
                        }
                    }
                    else {
                        for (let n = spinnerSegments; n >= 0; n--) {
                            const testValue = n / spinnerSegments;
                            if (operator === '<='
                                ? testValue <= knownValue
                                : testValue < knownValue) {
                                targetNumerator = n;
                                break;
                            }
                        }
                    }
                }
                else {
                    // Blank on RIGHT
                    if (operator === '>' || operator === '>=') {
                        for (let n = spinnerSegments; n >= 0; n--) {
                            const testValue = n / spinnerSegments;
                            if (operator === '>='
                                ? testValue <= knownValue
                                : testValue < knownValue) {
                                targetNumerator = n;
                                break;
                            }
                        }
                    }
                    else {
                        for (let n = 0; n <= spinnerSegments; n++) {
                            const testValue = n / spinnerSegments;
                            if (operator === '<='
                                ? testValue >= knownValue
                                : testValue > knownValue) {
                                targetNumerator = n;
                                break;
                            }
                        }
                    }
                }
                if (targetNumerator !== null) {
                    return {
                        numerator: targetNumerator,
                        denominator: spinnerSegments,
                        equation: text,
                    };
                }
            }
            return null;
        }
        tryEquationWithFractions(context, spinnerSegments) {
            const annotations = context.container.querySelectorAll('annotation');
            for (const annotation of annotations) {
                const text = annotation.textContent ?? '';
                if (!text.includes('=') || !text.includes('\\frac'))
                    continue;
                let cleanText = text;
                while (cleanText.includes('\\mathbf{')) {
                    cleanText = extractLatexContent(cleanText, '\\mathbf');
                }
                // Extract left side
                const leftSide = cleanText.split(/=(?:\\duoblank\{[^}]*\})?/)[0] ?? '';
                // Convert fractions and evaluate
                const converted = convertLatexFractions(leftSide);
                const result = evaluateMathExpression(converted.replace(/\s+/g, ''));
                if (result !== null) {
                    const calculatedNumerator = Math.round(result * spinnerSegments);
                    if (calculatedNumerator >= 0 && calculatedNumerator <= spinnerSegments) {
                        return {
                            numerator: calculatedNumerator,
                            denominator: spinnerSegments,
                            equation: text,
                        };
                    }
                }
            }
            return null;
        }
        trySimpleFraction(context) {
            const annotations = context.container.querySelectorAll('annotation');
            for (const annotation of annotations) {
                let text = annotation.textContent ?? '';
                // Clean wrappers
                while (text.includes('\\mathbf{')) {
                    text = extractLatexContent(text, '\\mathbf');
                }
                // Try \frac{a}{b}
                const fracMatch = text.match(/\\frac\{(\d+)\}\{(\d+)\}/);
                if (fracMatch?.[1] && fracMatch[2]) {
                    return {
                        numerator: parseInt(fracMatch[1], 10),
                        denominator: parseInt(fracMatch[2], 10),
                        equation: annotation.textContent ?? '',
                    };
                }
                // Try a/b
                const simpleFracMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
                if (simpleFracMatch?.[1] && simpleFracMatch[2]) {
                    return {
                        numerator: parseInt(simpleFracMatch[1], 10),
                        denominator: parseInt(simpleFracMatch[2], 10),
                        equation: annotation.textContent ?? '',
                    };
                }
            }
            return null;
        }
        tryKatexExpression(context, spinnerSegments) {
            const katexElements = context.container.querySelectorAll('.katex');
            for (const katex of katexElements) {
                const value = extractKatexValue(katex);
                if (!value)
                    continue;
                // Check for expression
                if (value.includes('+') && value.includes('/')) {
                    const cleanValue = value.replace(/=.*$/, '');
                    const result = evaluateMathExpression(cleanValue);
                    if (result !== null) {
                        const calculatedNumerator = Math.round(result * spinnerSegments);
                        if (calculatedNumerator >= 0 &&
                            calculatedNumerator <= spinnerSegments) {
                            return {
                                numerator: calculatedNumerator,
                                denominator: spinnerSegments,
                                equation: value,
                            };
                        }
                    }
                }
                // Try fraction format
                const fracMatch = value.match(/\((\d+)\/(\d+)\)/);
                if (fracMatch?.[1] && fracMatch[2]) {
                    return {
                        numerator: parseInt(fracMatch[1], 10),
                        denominator: parseInt(fracMatch[2], 10),
                        equation: value,
                    };
                }
            }
            return null;
        }
        setSpinnerValue(iframe, numerator) {
            let success = false;
            try {
                const iframeWindow = iframe.contentWindow;
                if (!iframeWindow)
                    return false;
                // Create selected indices array [0, 1, 2, ...]
                const selectedIndices = [];
                for (let i = 0; i < numerator; i++) {
                    selectedIndices.push(i);
                }
                // Method 1: getOutputVariables
                if (typeof iframeWindow.getOutputVariables === 'function') {
                    const vars = iframeWindow.getOutputVariables();
                    if (vars && 'selected' in vars) {
                        vars.selected = selectedIndices;
                        success = true;
                        this.log('set selected via getOutputVariables');
                    }
                }
                // Method 2: OUTPUT_VARIABLES
                if (!success && iframeWindow.OUTPUT_VARIABLES) {
                    iframeWindow.OUTPUT_VARIABLES.selected = selectedIndices;
                    success = true;
                    this.log('set selected via OUTPUT_VARIABLES');
                }
                // Trigger callbacks
                if (typeof iframeWindow.postOutputVariables === 'function') {
                    iframeWindow.postOutputVariables();
                }
                if (iframeWindow.duo?.onFirstInteraction) {
                    iframeWindow.duo.onFirstInteraction();
                }
                if (iframeWindow.duoDynamic?.onInteraction) {
                    iframeWindow.duoDynamic.onInteraction();
                }
                // PostMessage fallback
                iframeWindow.postMessage({ type: 'outputVariables', payload: { selected: selectedIndices } }, '*');
            }
            catch (e) {
                this.logError('error setting spinner value:', e);
            }
            return success;
        }
    }

    /**
     * Регистр всех доступных солверов
     */
    /**
     * Регистр солверов - выбирает подходящий солвер для задания
     */
    class SolverRegistry {
        solvers = [];
        constructor() {
            this.registerDefaultSolvers();
        }
        /**
         * Регистрирует солвер
         */
        register(solver) {
            this.solvers.push(solver);
            logger.debug('SolverRegistry: registered', solver.name);
        }
        /**
         * Находит подходящий солвер для задания
         */
        findSolver(context) {
            for (const solver of this.solvers) {
                if (solver.canSolve(context)) {
                    logger.info('SolverRegistry: selected', solver.name);
                    return solver;
                }
            }
            return null;
        }
        /**
         * Решает задание используя подходящий солвер
         */
        solve(context) {
            const solver = this.findSolver(context);
            if (!solver) {
                logger.warn('SolverRegistry: no solver found for challenge');
                return null;
            }
            try {
                return solver.solve(context);
            }
            catch (error) {
                logger.error('SolverRegistry: solver error', error);
                return null;
            }
        }
        /**
         * Регистрирует все солверы по умолчанию
         * Порядок важен - более специфичные солверы должны быть первыми
         */
        registerDefaultSolvers() {
            // Interactive iframe solvers (most specific)
            this.register(new InteractiveSliderSolver());
            this.register(new InteractiveSpinnerSolver());
            this.register(new MatchPairsSolver());
            // Specific challenge type solvers
            this.register(new RoundToNearestSolver());
            this.register(new SelectEquivalentFractionSolver());
            this.register(new ComparisonChoiceSolver());
            this.register(new SelectOperatorSolver());
            this.register(new PieChartTextInputSolver());
            this.register(new SelectPieChartSolver());
            this.register(new EquationBlankSolver());
            // Generic solvers last (catch-all)
            this.register(new TypeAnswerSolver());
        }
        /**
         * Возвращает список всех зарегистрированных солверов
         */
        getSolvers() {
            return [...this.solvers];
        }
    }
    // Singleton instance
    let registryInstance = null;
    function getSolverRegistry() {
        if (!registryInstance) {
            registryInstance = new SolverRegistry();
        }
        return registryInstance;
    }

    var SolverRegistry$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        SolverRegistry: SolverRegistry,
        getSolverRegistry: getSolverRegistry
    });

    /**
     * Автоматический запуск решения заданий
     */
    const DEFAULT_CONFIG = {
        delayBetweenActions: CONFIG.delays.betweenActions,
        delayAfterSolve: CONFIG.delays.afterSolve,
        stopOnError: true,
    };
    /**
     * Автоматический runner для решения заданий
     */
    class AutoRunner {
        isRunning = false;
        config;
        solvedCount = 0;
        errorCount = 0;
        constructor(config = {}) {
            this.config = { ...DEFAULT_CONFIG, ...config };
        }
        /**
         * Запускает автоматическое решение
         */
        async start() {
            if (this.isRunning) {
                logger.warn('AutoRunner: already running');
                return;
            }
            logger.info('AutoRunner: starting');
            this.isRunning = true;
            this.solvedCount = 0;
            this.errorCount = 0;
            await this.runLoop();
        }
        /**
         * Останавливает автоматическое решение
         */
        stop() {
            logger.info('AutoRunner: stopping');
            this.isRunning = false;
        }
        /**
         * Возвращает статус
         */
        getStatus() {
            return {
                isRunning: this.isRunning,
                solved: this.solvedCount,
                errors: this.errorCount,
            };
        }
        /**
         * Основной цикл
         */
        async runLoop() {
            while (this.isRunning) {
                try {
                    // Check if on result screen
                    if (isOnResultScreen()) {
                        logger.info('AutoRunner: lesson complete');
                        this.stop();
                        break;
                    }
                    // Check for incorrect answer
                    if (isIncorrect()) {
                        logger.warn('AutoRunner: incorrect answer detected');
                        if (this.config.stopOnError) {
                            this.stop();
                            break;
                        }
                        clickContinueButton();
                        await delay$1(this.config.delayBetweenActions);
                        continue;
                    }
                    // Try to solve
                    const solved = await this.solveOne();
                    if (solved) {
                        this.solvedCount++;
                        await delay$1(this.config.delayAfterSolve);
                        // Click continue/check button
                        clickContinueButton();
                        await delay$1(this.config.delayBetweenActions);
                    }
                    else {
                        // No challenge found or couldn't solve, wait and retry
                        await delay$1(this.config.delayBetweenActions);
                    }
                }
                catch (error) {
                    logger.error('AutoRunner: error in loop', error);
                    this.errorCount++;
                    if (this.config.stopOnError) {
                        this.stop();
                        break;
                    }
                    await delay$1(this.config.delayBetweenActions);
                }
            }
            logger.info('AutoRunner: stopped. Solved:', this.solvedCount, 'Errors:', this.errorCount);
        }
        /**
         * Решает одно задание
         */
        async solveOne() {
            const context = detectChallenge();
            if (!context) {
                logger.debug('AutoRunner: no challenge detected');
                return false;
            }
            const registry = getSolverRegistry();
            const result = registry.solve(context);
            if (result?.success) {
                logger.info('AutoRunner: solved with', result.type);
                return true;
            }
            logger.warn('AutoRunner: failed to solve');
            return false;
        }
    }
    // Singleton instance
    let runnerInstance = null;
    function getAutoRunner() {
        if (!runnerInstance) {
            runnerInstance = new AutoRunner();
        }
        return runnerInstance;
    }

    /**
     * Панель управления AutoDuo
     */
    class ControlPanel {
        container = null;
        statusElement = null;
        /**
         * Показывает панель управления
         */
        show() {
            if (this.container)
                return;
            this.container = document.createElement('div');
            this.container.id = 'autoduo-control-panel';
            this.container.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.9);
                border: 1px solid #333;
                border-radius: 8px;
                padding: 12px 16px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 13px;
                color: #fff;
                z-index: 99999;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                ">
                    <span style="font-weight: bold; color: #58cc02;">
                        AutoDuo ${CONFIG.version}
                    </span>
                    <span id="autoduo-status" style="
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        background: #333;
                    ">Stopped</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="autoduo-start" style="
                        padding: 6px 16px;
                        border: none;
                        border-radius: 4px;
                        background: #58cc02;
                        color: #fff;
                        font-weight: bold;
                        cursor: pointer;
                    ">Start</button>
                    <button id="autoduo-stop" style="
                        padding: 6px 16px;
                        border: none;
                        border-radius: 4px;
                        background: #dc3545;
                        color: #fff;
                        font-weight: bold;
                        cursor: pointer;
                    ">Stop</button>
                    <button id="autoduo-solve-one" style="
                        padding: 6px 16px;
                        border: none;
                        border-radius: 4px;
                        background: #0d6efd;
                        color: #fff;
                        font-weight: bold;
                        cursor: pointer;
                    ">Solve 1</button>
                </div>
            </div>
        `;
            document.body.appendChild(this.container);
            this.statusElement = document.getElementById('autoduo-status');
            this.bindEvents();
        }
        /**
         * Скрывает панель
         */
        hide() {
            if (this.container) {
                this.container.remove();
                this.container = null;
                this.statusElement = null;
            }
        }
        /**
         * Обновляет статус
         */
        updateStatus(status, color = '#333') {
            if (this.statusElement) {
                this.statusElement.textContent = status;
                this.statusElement.style.background = color;
            }
        }
        /**
         * Привязывает обработчики событий
         */
        bindEvents() {
            const startBtn = document.getElementById('autoduo-start');
            const stopBtn = document.getElementById('autoduo-stop');
            const solveOneBtn = document.getElementById('autoduo-solve-one');
            startBtn?.addEventListener('click', () => this.handleStart());
            stopBtn?.addEventListener('click', () => this.handleStop());
            solveOneBtn?.addEventListener('click', () => this.handleSolveOne());
        }
        /**
         * Обработчик кнопки Start
         */
        handleStart() {
            const runner = getAutoRunner();
            const logPanel = getLogPanel();
            this.updateStatus('Running', '#28a745');
            logPanel.log('AutoRunner started');
            runner.start().then(() => {
                const status = runner.getStatus();
                this.updateStatus('Stopped', '#333');
                logPanel.log(`Finished. Solved: ${status.solved}, Errors: ${status.errors}`);
            });
        }
        /**
         * Обработчик кнопки Stop
         */
        handleStop() {
            const runner = getAutoRunner();
            const logPanel = getLogPanel();
            runner.stop();
            this.updateStatus('Stopped', '#333');
            logPanel.log('AutoRunner stopped');
        }
        /**
         * Обработчик кнопки Solve One
         */
        handleSolveOne() {
            const logPanel = getLogPanel();
            Promise.resolve().then(function () { return ChallengeDetector; }).then(({ detectChallenge }) => {
                Promise.resolve().then(function () { return SolverRegistry$1; }).then(({ getSolverRegistry }) => {
                    const context = detectChallenge();
                    if (!context) {
                        logPanel.log('No challenge detected', 'warn');
                        return;
                    }
                    const registry = getSolverRegistry();
                    const result = registry.solve(context);
                    if (result?.success) {
                        logPanel.log(`Solved: ${result.type}`, 'info');
                    }
                    else {
                        logPanel.log('Failed to solve', 'error');
                    }
                });
            });
        }
    }
    // Singleton
    let controlPanelInstance = null;
    function getControlPanel() {
        if (!controlPanelInstance) {
            controlPanelInstance = new ControlPanel();
        }
        return controlPanelInstance;
    }

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
     * Утилиты для ожидания элементов DOM
     */
    const DEFAULT_TIMEOUT = 10000;
    const DEFAULT_INTERVAL = 100;
    /**
     * Ожидает появления элемента по селектору
     */
    function waitForElement(selector, config = {}, parent = document) {
        const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = config;
        return new Promise((resolve) => {
            const startTime = Date.now();
            const check = () => {
                const element = parent.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }
                if (Date.now() - startTime > timeout) {
                    resolve(null);
                    return;
                }
                setTimeout(check, interval);
            };
            check();
        });
    }
    /**
     * Ожидает появления нескольких элементов
     */
    function waitForElements(selector, minCount = 1, config = {}, parent = document) {
        const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = config;
        return new Promise((resolve) => {
            const startTime = Date.now();
            const check = () => {
                const elements = parent.querySelectorAll(selector);
                if (elements.length >= minCount) {
                    resolve(Array.from(elements));
                    return;
                }
                if (Date.now() - startTime > timeout) {
                    resolve(Array.from(elements));
                    return;
                }
                setTimeout(check, interval);
            };
            check();
        });
    }
    /**
     * Ожидает появления любого из указанных элементов
     */
    function waitForAnyElement(selectors, config = {}) {
        const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = config;
        return new Promise((resolve) => {
            const startTime = Date.now();
            const check = () => {
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        resolve({ element, selector });
                        return;
                    }
                }
                if (Date.now() - startTime > timeout) {
                    resolve(null);
                    return;
                }
                setTimeout(check, interval);
            };
            check();
        });
    }
    /**
     * Ожидает загрузки контента iframe
     */
    function waitForIframeContent(iframe, config = {}) {
        const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = config;
        return new Promise((resolve) => {
            const startTime = Date.now();
            const check = () => {
                try {
                    const srcdoc = iframe.getAttribute('srcdoc');
                    if (srcdoc && srcdoc.length > 0) {
                        resolve(true);
                        return;
                    }
                }
                catch {
                    // Cross-origin error, continue waiting
                }
                if (Date.now() - startTime > timeout) {
                    resolve(false);
                    return;
                }
                setTimeout(check, interval);
            };
            check();
        });
    }

    /**
     * Экспорт DOM утилит
     */

    var index = /*#__PURE__*/Object.freeze({
        __proto__: null,
        SELECTORS: SELECTORS,
        click: click,
        clickContinueButton: clickContinueButton,
        delay: delay$1,
        findAllIframes: findAllIframes,
        findIframeByContent: findIframeByContent,
        pressEnter: pressEnter,
        typeInput: typeInput,
        waitForAnyElement: waitForAnyElement,
        waitForElement: waitForElement,
        waitForElements: waitForElements,
        waitForIframeContent: waitForIframeContent
    });

    /**
     * AutoDuo - Автоматическое решение заданий Duolingo Math
     *
     * Entry point для userscript
     */
    /**
     * Инициализация AutoDuo
     */
    function initAutoDuo() {
        logger.info(`AutoDuo ${CONFIG.version} initializing...`);
        // Show UI panels
        const logPanel = getLogPanel();
        const controlPanel = getControlPanel();
        logPanel.show();
        controlPanel.show();
        // Connect logger to UI
        logger.setLogPanel(logPanel);
        logger.info('AutoDuo initialized');
        logger.info('Press Start to begin auto-solving');
        // Auto-start if configured
        if (CONFIG.autoSubmit) {
            logger.info('Auto-start enabled');
            setTimeout(() => {
                getAutoRunner().start();
            }, 1000);
        }
    }
    /**
     * Запуск при загрузке страницы
     */
    function main() {
        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAutoDuo);
        }
        else {
            initAutoDuo();
        }
    }
    // Run main
    main();

    exports.AutoRunner = AutoRunner;
    exports.BaseSolver = BaseSolver;
    exports.CONFIG = CONFIG;
    exports.ComparisonChoiceSolver = ComparisonChoiceSolver;
    exports.ControlPanel = ControlPanel;
    exports.EquationBlankSolver = EquationBlankSolver;
    exports.InteractiveSliderSolver = InteractiveSliderSolver;
    exports.InteractiveSpinnerSolver = InteractiveSpinnerSolver;
    exports.LOG = LOG;
    exports.LOG_DEBUG = LOG_DEBUG;
    exports.LOG_ERROR = LOG_ERROR;
    exports.LOG_WARN = LOG_WARN;
    exports.LogPanel = LogPanel;
    exports.MatchPairsSolver = MatchPairsSolver;
    exports.PieChartTextInputSolver = PieChartTextInputSolver;
    exports.RoundToNearestSolver = RoundToNearestSolver;
    exports.SelectEquivalentFractionSolver = SelectEquivalentFractionSolver;
    exports.SelectOperatorSolver = SelectOperatorSolver;
    exports.SelectPieChartSolver = SelectPieChartSolver;
    exports.SolverRegistry = SolverRegistry;
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
    exports.detectChallenge = detectChallenge;
    exports.divideFractions = divideFractions;
    exports.dom = index;
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
    exports.getAutoRunner = getAutoRunner;
    exports.getControlPanel = getControlPanel;
    exports.getLogPanel = getLogPanel;
    exports.getSolverRegistry = getSolverRegistry;
    exports.isBlockDiagram = isBlockDiagram;
    exports.isDigitsOnly = isDigitsOnly;
    exports.isFractionString = isFractionString;
    exports.isIncorrect = isIncorrect;
    exports.isNumber = isNumber;
    exports.isOnHomePage = isOnHomePage;
    exports.isOnResultScreen = isOnResultScreen;
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
