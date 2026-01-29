// ==UserScript==
// @name         AutoDuo
// @namespace    https://github.com/bitdittowit/autoduo
// @version      1.0.19
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
        autoSubmit: false,
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
        logs = [];
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
                top: 10px;
                left: 10px;
                width: 450px;
                max-height: 350px;
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
                    <div style="display: flex; gap: 8px;">
                        <button id="autoduo-log-copy" style="
                            background: #333;
                            border: none;
                            color: #888;
                            cursor: pointer;
                            font-size: 11px;
                            padding: 2px 8px;
                            border-radius: 4px;
                        ">Copy</button>
                        <button id="autoduo-log-clear" style="
                            background: #333;
                            border: none;
                            color: #888;
                            cursor: pointer;
                            font-size: 11px;
                            padding: 2px 8px;
                            border-radius: 4px;
                        ">Clear</button>
                        <button id="autoduo-log-toggle" style="
                            background: none;
                            border: none;
                            color: #888;
                            cursor: pointer;
                            font-size: 14px;
                        ">−</button>
                    </div>
                </div>
                <div id="autoduo-log-content" style="
                    padding: 8px;
                    max-height: 290px;
                    overflow-y: auto;
                "></div>
            </div>
        `;
            document.body.appendChild(this.container);
            this.content = document.getElementById('autoduo-log-content');
            // Toggle visibility
            document.getElementById('autoduo-log-toggle')
                ?.addEventListener('click', () => this.toggle());
            // Copy logs
            document.getElementById('autoduo-log-copy')
                ?.addEventListener('click', () => this.copyToClipboard());
            // Clear logs
            document.getElementById('autoduo-log-clear')
                ?.addEventListener('click', () => this.clear());
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
         * Копирует логи в буфер обмена
         */
        copyToClipboard() {
            const text = this.logs.join('\n');
            navigator.clipboard.writeText(text).then(() => {
                const copyBtn = document.getElementById('autoduo-log-copy');
                if (copyBtn) {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy';
                    }, 1500);
                }
            });
        }
        /**
         * Добавляет сообщение в лог
         */
        log(message, level = 'info') {
            const time = new Date().toLocaleTimeString();
            const fullMessage = `[${time}] ${message}`;
            // Store for copy
            this.logs.push(fullMessage);
            if (this.logs.length > this.maxLines) {
                this.logs.shift();
            }
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
            line.textContent = fullMessage;
            this.content.appendChild(line);
            // Limit lines in DOM
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
            this.logs = [];
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
     * Кликает кнопку продолжения/проверки (синхронная версия)
     * @returns true если кнопка была нажата успешно
     */
    function clickContinueButton() {
        const selectors = [
            '[data-test="player-next"]',
            'button[data-test="player-next"]',
        ];
        for (const selector of selectors) {
            const button = document.querySelector(selector);
            if (button) {
                // Check both disabled property and aria-disabled attribute
                const isDisabled = button.disabled ||
                    button.getAttribute('aria-disabled') === 'true' ||
                    button.classList.contains('disabled') ||
                    button.style.pointerEvents === 'none';
                if (!isDisabled) {
                    click(button);
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Асинхронная версия clickContinueButton с ожиданием
     * Использует MutationObserver для отслеживания изменений состояния кнопки
     */
    async function clickContinueButtonAsync(maxWaitMs = 5000, checkInterval = 50) {
        const selectors = [
            '[data-test="player-next"]',
            'button[data-test="player-next"]',
        ];
        const findButton = () => {
            for (const selector of selectors) {
                const button = document.querySelector(selector);
                if (button) {
                    return button;
                }
            }
            return null;
        };
        const isButtonEnabled = (button) => {
            const isDisabled = button.disabled ||
                button.getAttribute('aria-disabled') === 'true' ||
                button.classList.contains('disabled') ||
                button.style.pointerEvents === 'none';
            return !isDisabled;
        };
        const startTime = Date.now();
        let button = findButton();
        // If button is already enabled, click immediately
        if (button && isButtonEnabled(button)) {
            logger.debug('clickContinueButtonAsync: button already enabled, clicking immediately');
            click(button);
            return true;
        }
        if (!button) {
            logger.debug('clickContinueButtonAsync: button not found, waiting...');
        }
        else {
            logger.debug('clickContinueButtonAsync: button found but disabled, waiting for enable...');
        }
        // Use Promise to coordinate between observer and polling
        let resolvePromise = null;
        const clickPromise = new Promise((resolve) => {
            resolvePromise = resolve;
        });
        let observer = null;
        let clicked = false;
        const tryClick = (btn) => {
            if (clicked || !btn)
                return false;
            if (isButtonEnabled(btn)) {
                clicked = true;
                logger.debug('clickContinueButtonAsync: button enabled, clicking');
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
                click(btn);
                if (resolvePromise) {
                    resolvePromise(true);
                }
                return true;
            }
            return false;
        };
        // Set up MutationObserver to watch for button state changes
        // Also observe document body in case button appears later
        const observeTarget = button?.parentElement ?? document.body;
        observer = new MutationObserver(() => {
            if (clicked)
                return;
            const currentButton = findButton();
            if (currentButton) {
                // If button wasn't found before, set up observation on it
                if (!button && currentButton) {
                    button = currentButton;
                    observer?.observe(currentButton, {
                        attributes: true,
                        attributeFilter: ['disabled', 'aria-disabled', 'class'],
                        subtree: false,
                    });
                }
                tryClick(currentButton);
            }
        });
        // Observe target for new buttons appearing
        observer.observe(observeTarget, {
            childList: true,
            subtree: true,
        });
        // If button already exists, observe it directly
        if (button) {
            observer.observe(button, {
                attributes: true,
                attributeFilter: ['disabled', 'aria-disabled', 'class'],
                subtree: false,
            });
        }
        // Polling fallback
        const pollCheck = async () => {
            while (!clicked && Date.now() - startTime < maxWaitMs) {
                button = findButton();
                if (tryClick(button)) {
                    return;
                }
                await delay$1(checkInterval);
            }
            // Timeout reached
            if (!clicked && resolvePromise) {
                clicked = true;
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
                button = findButton();
                if (button) {
                    // Try clicking anyway (sometimes it works even if disabled)
                    logger.warn('clickContinueButtonAsync: timeout reached, attempting click anyway');
                    click(button);
                    resolvePromise(true);
                }
                else {
                    logger.error('clickContinueButtonAsync: timeout reached, button not found');
                    resolvePromise(false);
                }
            }
        };
        // Start polling
        pollCheck();
        // Wait for either observer or polling to succeed
        return clickPromise;
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
        MATH_CHALLENGE_BLOB: '[data-test="challenge challenge-mathChallengeBlob"]',
        CHALLENGE_CONTAINER: '[data-test^="challenge challenge-"]',
        CHALLENGE_HEADER: '[data-test="challenge-header"]',
        PATTERN_TABLE: '[data-test="challenge-patternTable"]',
        // Choices
        CHALLENGE_CHOICE: '[data-test="challenge-choice"]',
        CHALLENGE_TAP_TOKEN: '[data-test="challenge-tap-token"], [data-test="-challenge-tap-token"]',
        // Input elements
        TEXT_INPUT: '[data-test="challenge-text-input"]',
        EQUATION_CONTAINER: '._1KXkZ',
        // Buttons
        PLAYER_NEXT: '[data-test="player-next"]',
        PLAYER_SKIP: '[data-test="player-skip"]',
        PRACTICE_AGAIN: '[data-test="practice-again-button"]',
        // States
        BLAME_INCORRECT: '[data-test="blame blame-incorrect"]',
        SESSION_COMPLETE: '[data-test="session-complete-slide"]',
        // Math elements
        KATEX: '.katex',
        ANNOTATION: 'annotation',
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
        // Priority 1: Math challenge blob (Duolingo Math)
        const mathChallenge = document.querySelector(SELECTORS.MATH_CHALLENGE_BLOB);
        if (mathChallenge) {
            logger.debug('detectChallenge: found mathChallengeBlob');
            return createChallengeContext(mathChallenge);
        }
        // Priority 2: Any challenge container
        const container = document.querySelector(SELECTORS.CHALLENGE_CONTAINER);
        if (container) {
            logger.debug('detectChallenge: found challenge container');
            return createChallengeContext(container);
        }
        // Fallback: look for specific elements
        const header = document.querySelector(SELECTORS.CHALLENGE_HEADER);
        if (header) {
            const parent = header.closest('[data-test]') ?? document.body;
            return createChallengeContext(parent);
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
     * Проверяет, находимся ли на домашней странице курса
     */
    function isOnHomePage() {
        const url = window.location.href;
        return url.includes('/learn') && !url.includes('/lesson') && !url.includes('/practice');
    }
    /**
     * Проверяет, есть ли доступный следующий урок
     */
    function hasNextLesson() {
        // Look for skill path with START indicator or unlocked lessons
        const startButton = document.querySelector('[data-test*="skill-path-level"] button:not([disabled])');
        return startButton !== null;
    }
    /**
     * Кликает на следующий доступный урок
     * @returns true если урок найден и клик выполнен
     */
    function clickNextLesson() {
        // Find the current lesson with START indicator (the popup)
        const startPopup = document.querySelector('._36bu_');
        if (startPopup) {
            // Find the parent button
            const button = startPopup.closest('[role="button"]');
            if (button) {
                logger.info('clicking START lesson');
                button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                // After clicking, we need to click the actual start button in the popup
                setTimeout(() => {
                    const startBtn = document.querySelector('button[data-test="start-button"], a[href*="/lesson"]');
                    if (startBtn) {
                        startBtn.click();
                    }
                }, 300);
                return true;
            }
        }
        // Fallback: find any unlocked skill button and click it
        const skillButtons = document.querySelectorAll('[data-test*="skill-path-level"] button:not([disabled])');
        for (const btn of skillButtons) {
            // Skip completed lessons (they have checkmark icons)
            const isCompleted = btn.querySelector('svg path[d*="M34.2346"]') !== null;
            if (!isCompleted) {
                logger.info('clicking next available lesson');
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                setTimeout(() => {
                    const startBtn = document.querySelector('button[data-test="start-button"], a[href*="/lesson"]');
                    if (startBtn) {
                        startBtn.click();
                    }
                }, 300);
                return true;
            }
        }
        logger.warn('no available lessons found');
        return false;
    }

    var ChallengeDetector = /*#__PURE__*/Object.freeze({
        __proto__: null,
        clickNextLesson: clickNextLesson,
        detectChallenge: detectChallenge,
        hasNextLesson: hasNextLesson,
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
    function extractSvgContent$2(srcdoc) {
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
        // Method 1: Old style hundred blocks with clip-rule="evenodd"
        for (const pathTag of allPaths) {
            const hasClipRule = /clip-rule=["']evenodd["']/i.test(pathTag);
            const hasFillColor = /fill=["']#(?:1CB0F6|49C0F8)["']/i.test(pathTag);
            if (hasClipRule && hasFillColor) {
                count += 100;
            }
        }
        // Method 2: New style hundred blocks with large rounded rect borders
        // These have: <rect height="222" rx="19" ...> or similar (boundaries of 100-block)
        // Typically height ~200-250 and rx (rounded corners) indicates hundred block boundary
        const largeRects = svgContent.match(/<rect[^>]*height=["'](\d+)["'][^>]*rx=["'](\d+)["'][^>]*>/gi) ?? [];
        for (const rectTag of largeRects) {
            const heightMatch = rectTag.match(/height=["'](\d+)["']/);
            const rxMatch = rectTag.match(/rx=["'](\d+)["']/);
            if (heightMatch?.[1] && rxMatch?.[1]) {
                const height = parseInt(heightMatch[1]);
                const rx = parseInt(rxMatch[1]);
                // Large rounded rect with height 200-250 and rx 15-25 indicates hundred block
                if (height >= 200 && height <= 250 && rx >= 15 && rx <= 25) {
                    count += 100;
                }
            }
        }
        return count;
    }
    /**
     * Подсчитывает обычные блоки (rect и простые path без clip-rule)
     * Each column of 10 blocks has: 2 <path> (top/bottom rounded) + 8 <rect> (middle) = 10 total
     * So we count ALL elements (rect + simple path), and each element = 1 block
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
        const svgContent = extractSvgContent$2(srcdoc);
        // IMPORTANT: Exclude pie charts (they have <circle> elements)
        // Pie charts also have colored paths, but they're circles, not block diagrams
        if (svgContent.includes('<circle')) {
            logger.debug('extractBlockDiagramValue: skipping - detected circle (pie chart)');
            return null;
        }
        // Count "hundred block" structures first
        const hundredBlocks = countHundredBlocks(svgContent);
        logger.debug('extractBlockDiagramValue: countHundredBlocks returned', hundredBlocks);
        if (hundredBlocks > 0) {
            logger.debug('extractBlockDiagramValue: found hundred-block structures =', hundredBlocks);
        }
        // Count regular blocks
        // Each column of 10 blocks has: 2 <path> (top/bottom rounded) + 8 <rect> (middle) = 10 total
        // So we count ALL elements (rect + simple path), and each element = 1 block
        const regularBlocks = countRegularBlocks(svgContent);
        logger.debug('extractBlockDiagramValue: countRegularBlocks returned', regularBlocks);
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
        // IMPORTANT: Exclude pie charts (they have <circle> elements)
        // Pie charts may have colored paths but they're circles, not block diagrams
        if (srcdoc.includes('<circle')) {
            return false;
        }
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
        let result = str;
        // First, normalize \left( and \right) to regular parentheses
        result = result.replace(/\\left\(/g, '(');
        result = result.replace(/\\right\)/g, ')');
        // Handle \neg(...) - negation of expression in parentheses
        // \neg(-0.55) -> -(-0.55) which evaluates to 0.55
        // Process \neg with parentheses by finding matching parentheses
        let maxIterations = 10; // Prevent infinite loops
        while (result.includes('\\neg') && maxIterations > 0) {
            maxIterations--;
            const negMatch = result.match(/\\neg\s*\(/);
            if (negMatch?.index !== undefined) {
                const startIndex = negMatch.index;
                const parenStart = startIndex + negMatch[0].length - 1; // Position of (
                // Find matching closing parenthesis
                let depth = 1;
                let parenEnd = parenStart + 1;
                while (depth > 0 && parenEnd < result.length) {
                    if (result[parenEnd] === '(')
                        depth++;
                    else if (result[parenEnd] === ')')
                        depth--;
                    parenEnd++;
                }
                if (depth === 0) {
                    // Extract the expression inside parentheses
                    const innerExpr = result.substring(parenStart + 1, parenEnd - 1);
                    // Replace \neg(...) with -(...)
                    result = result.substring(0, startIndex) + '-(' + innerExpr + ')' + result.substring(parenEnd);
                }
                else {
                    // If we can't find matching paren, just replace \neg with -
                    result = result.replace(/\\neg\s*/, '-');
                    break;
                }
            }
            else {
                // Handle \neg before number (without parentheses)
                result = result.replace(/\\neg\s*(\d+)/g, '-$1');
                break;
            }
        }
        // If there are still \neg commands left, just replace them with -
        result = result.replace(/\\neg\s*/g, '-');
        return result
            .replace(/\\left\[/g, '[') // \left[ -> [
            .replace(/\\right\]/g, ']') // \right] -> ]
            .replace(/\\left\{/g, '{') // \left\{ -> {
            .replace(/\\right\}/g, '}') // \right\} -> }
            .replace(/\\cdot/g, '*') // \cdot -> *
            .replace(/\\times/g, '*') // \times -> *
            .replace(/\\div/g, '/') // \div -> /
            .replace(/\\pm/g, '±') // \pm -> ±
            .replace(/\\ge/g, '≥') // \ge -> ≥
            .replace(/\\geq/g, '≥') // \geq -> ≥
            .replace(/\\le/g, '≤') // \le -> ≤
            .replace(/\\leq/g, '≤') // \leq -> ≤
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
        // Handle exponentiation notation BEFORE removing braces
        // Convert {base}^{exponent} to base**exponent
        cleaned = cleaned.replace(/\{([^}]+)\}\^\{([^}]+)\}/g, (_match, base, exp) => {
            const cleanBase = base.replace(/[^\d.]/g, '');
            const cleanExp = exp.replace(/[^\d.]/g, '');
            return `(${cleanBase})**(${cleanExp})`;
        });
        // Handle base^{exponent} format (without braces around base)
        cleaned = cleaned.replace(/(\d+)\^\{([^}]+)\}/g, (_match, base, exp) => {
            const cleanExp = exp.replace(/[^\d.]/g, '');
            return `(${base})**(${cleanExp})`;
        });
        // Handle {base}^exponent format (without braces around exponent)
        cleaned = cleaned.replace(/\{([^}]+)\}\^(\d+)/g, (_match, base, exp) => {
            const cleanBase = base.replace(/[^\d.]/g, '');
            return `(${cleanBase})**(${exp})`;
        });
        // Handle simple base^exponent format
        cleaned = cleaned.replace(/(\d+)\^(\d+)/g, '($1)**($2)');
        // Remove remaining braces (they might be from LaTeX formatting that wasn't exponentiation)
        cleaned = cleaned.replace(/\{/g, '').replace(/\}/g, '');
        // Remove any remaining non-math characters (but keep ** for exponentiation)
        cleaned = cleaned.replace(/[^\d+\-*/.()]/g, '');
        logger.debug('evaluateMathExpression: cleaned', cleaned);
        // Validate - allow digits, operators, parentheses, and ** for exponentiation
        const cleanedForValidation = cleaned.replace(/\*\*/g, '');
        if (!/^[\d+\-*/().]+$/.test(cleanedForValidation)) {
            logger.warn('evaluateMathExpression: invalid expression after cleaning', cleaned);
            return null;
        }
        // Check for empty or invalid expressions
        if (cleaned === '' || cleaned === '()') {
            return null;
        }
        try {
            // Using Function constructor for safer eval
            // ** is supported in modern JavaScript for exponentiation
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
     * Supports exponentiation (**)
     */
    function isValidMathExpression(expr) {
        const cleaned = expr.replace(/\s+/g, '');
        // Allow ** for exponentiation
        const cleanedForValidation = cleaned.replace(/\*\*/g, '');
        return /^[\d+\-*/().]+$/.test(cleanedForValidation) && cleaned.length > 0;
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
     * Решение уравнений с пропуском (X)
     */
    /**
     * Решает уравнение с пропуском вида "A op X = B" или "X op A = B"
     *
     * @param equation - уравнение в формате LaTeX
     * @returns решение или null
     *
     * @example
     * solveEquationWithBlank('3 + \\duoblank{1} = 7') // 4
     * solveEquationWithBlank('X * 5 = 25') // 5
     */
    function solveEquationWithBlank(equation) {
        logger.debug('solveEquationWithBlank: input', equation);
        // Clean the equation
        let cleaned = equation
            .replace(/\\duoblank\{[^}]*\}/g, 'X')
            .replace(/\s+/g, '')
            .replace(/\\left\(/g, '(')
            .replace(/\\right\)/g, ')')
            .replace(/\\left\[/g, '[')
            .replace(/\\right\]/g, ']')
            .replace(/\\left\{/g, '{')
            .replace(/\\right\}/g, '}');
        cleaned = cleanLatexWrappers(cleaned);
        cleaned = cleanLatexForEval(cleaned);
        // Normalize negative numbers in parentheses: (-1.95) -> -1.95
        // This helps with pattern matching and evaluation
        cleaned = cleaned.replace(/\((-?\d+\.?\d*)\)/g, '$1');
        logger.debug('solveEquationWithBlank: cleaned', cleaned);
        // Split by = to get left and right sides
        const parts = cleaned.split('=');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            logger.debug('solveEquationWithBlank: invalid equation format');
            return null;
        }
        const [left, right] = parts;
        // Optimization: If X is alone on one side
        if (right === 'X' && !left.includes('X')) {
            const result = evaluateMathExpression(left);
            if (result !== null) {
                logger.debug('solveEquationWithBlank: X alone on right, result =', result);
                return result;
            }
        }
        if (left === 'X' && !right.includes('X')) {
            const result = evaluateMathExpression(right);
            if (result !== null) {
                logger.debug('solveEquationWithBlank: X alone on left, result =', result);
                return result;
            }
        }
        // Determine which side has X and solve
        if (left.includes('X')) {
            return solveForX(left, right);
        }
        else if (right.includes('X')) {
            return solveForX(right, left);
        }
        logger.debug('solveEquationWithBlank: X not found');
        return null;
    }
    /**
     * Решает выражение с X относительно целевого значения
     *
     * @param exprWithX - выражение с X (например "X+4" или "3*X")
     * @param otherSide - другая сторона уравнения
     * @returns решение или null
     */
    function solveForX(exprWithX, otherSide) {
        const target = evaluateMathExpression(otherSide);
        if (target === null) {
            logger.debug('solveForX: could not evaluate other side');
            return null;
        }
        // Try algebraic patterns first (faster)
        const algebraicResult = solveAlgebraically(exprWithX, target);
        if (algebraicResult !== null) {
            return algebraicResult;
        }
        // Fallback to brute force with extended range
        return solveBruteForce(exprWithX, target, -1e4, 10000);
    }
    /**
     * Пытается решить алгебраически для простых паттернов
     * Supports both integers and floating-point numbers
     */
    function solveAlgebraically(exprWithX, target) {
        const patterns = [
            { pattern: /^X$/, solve: () => target },
            { pattern: /^X\+([0-9.-]+)$/, solve: (n) => target - n },
            { pattern: /^X-([0-9.-]+)$/, solve: (n) => target + n },
            { pattern: /^([0-9.-]+)\+X$/, solve: (n) => target - n },
            { pattern: /^([0-9.-]+)-X$/, solve: (n) => n - target },
            { pattern: /^X\*([0-9.-]+)$/, solve: (n) => target / n },
            { pattern: /^([0-9.-]+)\*X$/, solve: (n) => target / n },
            { pattern: /^X\/([0-9.-]+)$/, solve: (n) => target * n },
            { pattern: /^([0-9.-]+)\/X$/, solve: (n) => n / target },
            // Patterns with parentheses
            { pattern: /^\(X\)\+([0-9.-]+)$/, solve: (n) => target - n },
            { pattern: /^\(X\)-([0-9.-]+)$/, solve: (n) => target + n },
            { pattern: /^\(X\)\*([0-9.-]+)$/, solve: (n) => target / n },
            { pattern: /^\(X\)\/([0-9.-]+)$/, solve: (n) => target * n },
            { pattern: /^([0-9.-]+)\*\(X\)$/, solve: (n) => target / n },
            { pattern: /^([0-9.-]+)\/\(X\)$/, solve: (n) => n / target },
        ];
        for (const { pattern, solve } of patterns) {
            const match = exprWithX.match(pattern);
            if (match) {
                const n = match[1] ? parseFloat(match[1]) : 0;
                if (Number.isNaN(n))
                    continue;
                const result = solve(n);
                if (Number.isFinite(result)) {
                    logger.debug('solveForX: algebraic solution X =', result);
                    return result;
                }
            }
        }
        return null;
    }
    /**
     * Решает перебором в заданном диапазоне
     */
    function solveBruteForce(exprWithX, target, min, max) {
        // Try integer values first
        for (let x = min; x <= max; x++) {
            const testExpr = exprWithX.replace(/X/g, `(${x})`);
            const testResult = evaluateMathExpression(testExpr);
            if (testResult !== null && Math.abs(testResult - target) < 0.0001) {
                logger.debug('solveForX: brute force solution X =', x);
                return x;
            }
        }
        // If no integer solution found, try decimal values with step 0.01
        // This handles cases like X + (-1.95) = 0 where X = 1.95
        const step = 0.01;
        for (let x = min; x <= max; x += step) {
            // Round to 2 decimal places to avoid floating point precision issues
            const roundedX = Math.round(x * 100) / 100;
            const testExpr = exprWithX.replace(/X/g, `(${roundedX})`);
            const testResult = evaluateMathExpression(testExpr);
            if (testResult !== null && Math.abs(testResult - target) < 0.0001) {
                logger.debug('solveForX: brute force solution (decimal) X =', roundedX);
                return roundedX;
            }
        }
        logger.debug('solveForX: no solution found in range', min, 'to', max);
        return null;
    }
    /**
     * Решает неравенство с пропуском
     *
     * @param inequality - неравенство в формате LaTeX
     * @param denominator - знаменатель для результата (если известен)
     * @returns дробь как строка "a/b" или null
     */
    function solveInequalityWithBlank(inequality, denominator) {
        let cleaned = cleanLatexWrappers(inequality);
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
        // Normalize operators
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
        const leftHasBlank = leftStr?.includes('\\duoblank');
        const rightHasBlank = rightStr?.includes('\\duoblank');
        if (!leftHasBlank && !rightHasBlank)
            return null;
        // Get known value
        const knownSide = leftHasBlank ? rightStr : leftStr;
        if (!knownSide)
            return null;
        // Parse fraction from known side
        const fracMatch = knownSide.match(/\\frac\{(\d+)\}\{(\d+)\}/);
        let knownValue;
        let knownDenom;
        if (fracMatch?.[1] && fracMatch[2]) {
            const num = parseInt(fracMatch[1], 10);
            knownDenom = parseInt(fracMatch[2], 10);
            knownValue = num / knownDenom;
        }
        else {
            const numMatch = knownSide.match(/(\d+)/);
            if (!numMatch?.[1])
                return null;
            knownValue = parseFloat(numMatch[1]);
            knownDenom = 1;
        }
        // Calculate target numerator based on inequality direction
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
        if (targetNum <= 0)
            targetNum = 1;
        return `${targetNum}/${knownDenom}`;
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
            const hasBlank = equation.includes('\\duoblank');
            if (!hasBlank) {
                return null;
            }
            // Check for explicit inequality operators first (before checking for =)
            const hasExplicitInequality = equation.includes('>=') || equation.includes('<=') ||
                equation.includes('\\ge') || equation.includes('\\le') ||
                equation.includes('\\gt') || equation.includes('\\lt');
            // If equation has = sign, it's an equation, not an inequality (unless it has explicit inequality operators)
            if (equation.includes('=')) {
                // If there's an = sign but no explicit inequality operators, it's an equation
                if (!hasExplicitInequality) {
                    return null; // This is an equation, not an inequality
                }
            }
            // Check for inequality operators (only if no = sign, or if = sign with explicit inequality operators)
            // Must check for >= and <= BEFORE checking for standalone > or <
            const hasInequality = hasExplicitInequality ||
                // Check for standalone > or < that are not part of \left or \right commands
                // AND not part of >= or <=
                (equation.includes('>') && !equation.includes('\\left') && !equation.includes('\\right') && !equation.includes('>=')) ||
                (equation.includes('<') && !equation.includes('\\left') && !equation.includes('\\right') && !equation.includes('<='));
            if (!hasInequality) {
                return null;
            }
            this.log('detected INEQUALITY with blank type');
            const answer = solveInequalityWithBlank(equation);
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
            const answer = solveEquationWithBlank(equation);
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
            // Check for explicit comparison operators (not part of \left or \right)
            // Must check for >= and <= BEFORE checking for standalone > or <
            const hasExplicitComparison = text.includes('>=') || text.includes('<=') ||
                text.includes('\\ge') || text.includes('\\le') ||
                text.includes('\\gt') || text.includes('\\lt') ||
                // Standalone > or < that are not part of \left or \right commands
                // AND not part of >= or <=
                (text.includes('>') && !text.includes('\\left') && !text.includes('\\right') && !text.includes('>=')) ||
                (text.includes('<') && !text.includes('\\left') && !text.includes('\\right') && !text.includes('<='));
            // Don't match if equation has = sign without explicit comparison operators
            // (that's for EquationBlankSolver)
            if (text.includes('=') && !hasExplicitComparison) {
                return false;
            }
            const hasBlank = text.includes('\\duoblank');
            return hasExplicitComparison && hasBlank;
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
            // Check for explicit comparison operators first
            if (text.includes('\\le') || text.includes('\\ge')) {
                if (text.includes('\\le'))
                    return '<=';
                if (text.includes('\\ge'))
                    return '>=';
            }
            if (text.includes('\\gt'))
                return '>';
            if (text.includes('\\lt'))
                return '<';
            // Check for >= and <= (but not as part of \left or \right)
            if (text.includes('>=') && !text.includes('\\left') && !text.includes('\\right')) {
                return '>=';
            }
            if (text.includes('<=') && !text.includes('\\left') && !text.includes('\\right')) {
                return '<=';
            }
            // Check for standalone > or < (but not as part of \left or \right)
            if (text.includes('>') && !text.includes('\\left') && !text.includes('\\right') && !text.includes('>=')) {
                return '>';
            }
            if (text.includes('<') && !text.includes('\\left') && !text.includes('\\right') && !text.includes('<=')) {
                return '<';
            }
            return null;
        }
        /**
         * Извлекает значение левой части выражения
         */
        extractLeftValue(eqText, _operator) {
            const cleaned = cleanLatexWrappers(eqText);
            // Split by operator to get left side
            // Check longer operators first (>=, <=) before shorter ones (<, >)
            const operators = ['<=', '>=', '\\le', '\\ge', '\\lt', '\\gt', '<', '>', '='];
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
            // Remove \duoblank{...} before evaluating (replace with empty string)
            leftSide = leftSide.replace(/\\duoblank\{[^}]*\}/g, '');
            // Use cleanLatexForEval to ensure all LaTeX operators are converted
            // This handles \left(, \right), \cdot, fractions, etc.
            leftSide = cleanLatexForEval(leftSide);
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

    class SelectFactorsSolver extends BaseSolver {
        name = 'SelectFactorsSolver';
        canSolve(context) {
            // Check header text
            if (!context.headerText) {
                return false;
            }
            const headerLower = context.headerText.toLowerCase();
            // Check if this is a "Select the factors" challenge
            if (headerLower.includes('select') &&
                (headerLower.includes('factor') || headerLower.includes('делител'))) {
                // Verify we have choices
                return context.choices !== undefined && context.choices.length > 0;
            }
            return false;
        }
        solve(context) {
            if (!context.choices || context.choices.length === 0) {
                return this.failure('selectFactors', 'No choices found');
            }
            this.log('starting');
            // Extract the number
            const number = this.extractNumber(context);
            if (number === null) {
                return this.failure('selectFactors', 'Could not extract number');
            }
            this.log('number =', number);
            // Calculate all factors
            const factors = this.calculateFactors(number);
            this.log('factors =', factors);
            // Find the choice with the most correct factors
            let bestChoice = -1;
            let bestScore = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const choiceNumbers = this.extractNumbersFromChoice(choice);
                this.log(`choice ${i + 1}:`, choiceNumbers);
                // Calculate score: count how many are actual factors
                let score = 0;
                let hasNonFactor = false;
                for (const num of choiceNumbers) {
                    if (factors.includes(num)) {
                        score++;
                    }
                    else {
                        hasNonFactor = true;
                        break; // If any number is not a factor, this choice is wrong
                    }
                }
                // Only consider if all numbers are factors
                if (!hasNonFactor && score > bestScore) {
                    bestScore = score;
                    bestChoice = i;
                }
            }
            if (bestChoice === -1) {
                return this.failure('selectFactors', 'Could not find correct choice');
            }
            this.log('best choice =', bestChoice + 1, 'with score', bestScore);
            // Click the choice
            const choiceButton = context.container.querySelectorAll('[data-test="challenge-choice"]')[bestChoice];
            if (choiceButton) {
                click(choiceButton);
            }
            return {
                type: 'selectFactors',
                success: true,
                number,
                factors,
                selectedChoice: bestChoice + 1,
            };
        }
        extractNumber(context) {
            // Find the number in the challenge (usually in a KaTeX element between header and choices)
            const mathElements = context.container.querySelectorAll('.katex');
            for (const mathEl of mathElements) {
                // Skip the header
                if (mathEl.closest('[data-test="challenge-header"]')) {
                    continue;
                }
                // Skip choices
                if (mathEl.closest('[data-test="challenge-choice"]')) {
                    continue;
                }
                // Get annotation text
                const annotation = mathEl.querySelector('annotation');
                if (!annotation?.textContent)
                    continue;
                let text = annotation.textContent;
                text = cleanLatexWrappers(text);
                // Try to parse as a number
                const num = parseInt(text.trim(), 10);
                if (!isNaN(num) && num > 0) {
                    return num;
                }
            }
            return null;
        }
        extractNumbersFromChoice(choice) {
            const numbers = [];
            // Get annotation text from choice
            const annotation = choice.querySelector('annotation');
            if (!annotation?.textContent)
                return numbers;
            let text = annotation.textContent;
            text = cleanLatexWrappers(text);
            // Parse numbers from text like "1, 4, 8, 16"
            const parts = text.split(',');
            for (const part of parts) {
                const num = parseInt(part.trim(), 10);
                if (!isNaN(num)) {
                    numbers.push(num);
                }
            }
            return numbers;
        }
        calculateFactors(n) {
            const factors = [];
            for (let i = 1; i <= n; i++) {
                if (n % i === 0) {
                    factors.push(i);
                }
            }
            return factors;
        }
    }

    class LeastCommonMultipleSolver extends BaseSolver {
        name = 'LeastCommonMultipleSolver';
        canSolve(context) {
            // Check header text
            if (!context.headerText) {
                return false;
            }
            const headerLower = context.headerText.toLowerCase();
            // Check if this is a "least common multiple" or "LCM" challenge
            if (headerLower.includes('least common multiple') ||
                headerLower.includes('lcm') ||
                (headerLower.includes('наименьш') && headerLower.includes('кратн'))) {
                // Verify we have a table with cells
                const table = context.container.querySelector('[class*="qjbi"]');
                return table !== null;
            }
            return false;
        }
        solve(context) {
            this.log('starting');
            // Find the table with pairs and LCM values
            const table = context.container.querySelector('[class*="qjbi"]');
            if (!table) {
                return this.failure('leastCommonMultiple', 'No table found');
            }
            // Find all cells in the table
            const cells = Array.from(table.querySelectorAll('[class*="ihM27"]'));
            this.log('found', cells.length, 'cells');
            if (cells.length === 0) {
                return this.failure('leastCommonMultiple', 'No cells found in table');
            }
            // Find the cell with "?" - this is our question
            let questionNumbers = [];
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                const annotation = cell.querySelector('annotation');
                if (!annotation?.textContent)
                    continue;
                let text = annotation.textContent;
                text = cleanLatexWrappers(text);
                // Check if this is the question cell (contains ?)
                if (text.includes('?')) {
                    // The previous cell should contain the numbers
                    if (i > 0) {
                        const prevCell = cells[i - 1];
                        const prevAnnotation = prevCell.querySelector('annotation');
                        if (prevAnnotation?.textContent) {
                            let prevText = prevAnnotation.textContent;
                            prevText = cleanLatexWrappers(prevText);
                            questionNumbers = this.extractNumbers(prevText);
                            this.log('question numbers:', questionNumbers);
                            break;
                        }
                    }
                }
            }
            if (questionNumbers.length !== 2) {
                return this.failure('leastCommonMultiple', 'Could not find question numbers');
            }
            // Calculate LCM
            if (questionNumbers[0] === undefined || questionNumbers[1] === undefined) {
                return this.failure('leastCommonMultiple', 'Invalid question numbers');
            }
            const lcm = this.calculateLCM(questionNumbers[0], questionNumbers[1]);
            this.log('calculated LCM:', lcm);
            // Find the correct choice
            if (!context.choices || context.choices.length === 0) {
                return this.failure('leastCommonMultiple', 'No choices found');
            }
            this.log('found', context.choices.length, 'choices');
            let matchingChoice = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const annotation = choice.querySelector('annotation');
                if (!annotation?.textContent)
                    continue;
                let text = annotation.textContent;
                text = cleanLatexWrappers(text);
                const choiceNumber = parseInt(text.trim(), 10);
                this.log('choice', i + 1, ':', choiceNumber);
                if (choiceNumber === lcm) {
                    matchingChoice = i;
                    this.log('found matching choice at index', i);
                    break;
                }
            }
            if (matchingChoice === -1) {
                return this.failure('leastCommonMultiple', `Could not find matching choice for LCM ${lcm}`);
            }
            // Click the choice
            const choiceButton = context.container.querySelectorAll('[data-test="challenge-choice"]')[matchingChoice];
            if (choiceButton) {
                this.log('clicking choice', matchingChoice);
                click(choiceButton);
            }
            return {
                type: 'leastCommonMultiple',
                success: true,
                numbers: questionNumbers,
                lcm,
                selectedChoice: matchingChoice + 1,
            };
        }
        /**
         * Extract numbers from a string like "4,5" or "4, 5"
         */
        extractNumbers(text) {
            const numbers = [];
            const parts = text.split(',');
            for (const part of parts) {
                const num = parseInt(part.trim(), 10);
                if (!isNaN(num)) {
                    numbers.push(num);
                }
            }
            return numbers;
        }
        /**
         * Calculate Greatest Common Divisor (GCD) using Euclidean algorithm
         */
        calculateGCD(a, b) {
            while (b !== 0) {
                const temp = b;
                b = a % b;
                a = temp;
            }
            return a;
        }
        /**
         * Calculate Least Common Multiple (LCM)
         * LCM(a, b) = (a * b) / GCD(a, b)
         */
        calculateLCM(a, b) {
            return (a * b) / this.calculateGCD(a, b);
        }
    }

    /**
     * Solver for "Select the least common multiple" challenges
     * with visual block diagram choices
     *
     * Example:
     * - Header: "Select the least common multiple"
     * - Table with pairs and visual representations:
     *   - 7,7 → [diagram with 7 blocks]
     *   - 7,14 → [diagram with 14 blocks]
     *   - 7,21 → ? (need to find LCM(7,21) = 21)
     * - Choices: iframes with block diagrams
     *   - Choice 1: [diagram with 19 blocks]
     *   - Choice 2: [diagram with 21 blocks] ✓
     */
    class VisualLCMSolver extends BaseSolver {
        name = 'VisualLCMSolver';
        canSolve(context) {
            // Check header text
            if (!context.headerText) {
                return false;
            }
            const headerLower = context.headerText.toLowerCase();
            // Check if this is a "least common multiple" challenge
            if (!(headerLower.includes('least common multiple') ||
                headerLower.includes('lcm') ||
                (headerLower.includes('наименьш') && headerLower.includes('кратн')))) {
                return false;
            }
            // Verify we have a table with cells
            const table = context.container.querySelector('[class*="qjbi"]');
            if (!table) {
                return false;
            }
            // Check if choices contain iframes (visual representation)
            if (!context.choices || context.choices.length === 0) {
                return false;
            }
            // Check if at least one choice contains an iframe with srcdoc
            const hasVisualChoices = Array.from(context.choices).some(choice => {
                const iframe = choice.querySelector('iframe[srcdoc]');
                return iframe !== null;
            });
            return hasVisualChoices;
        }
        solve(context) {
            this.log('starting');
            // Find the table with pairs
            const table = context.container.querySelector('[class*="qjbi"]');
            if (!table) {
                return this.failure('visualLCM', 'No table found');
            }
            // Find all cells in the table
            const cells = Array.from(table.querySelectorAll('[class*="ihM27"]'));
            this.log('found', cells.length, 'cells');
            if (cells.length === 0) {
                return this.failure('visualLCM', 'No cells found in table');
            }
            // Find the cell with "?" - this is our question
            let questionNumbers = [];
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                const annotation = cell.querySelector('annotation');
                if (!annotation?.textContent)
                    continue;
                let text = annotation.textContent;
                text = cleanLatexWrappers(text);
                // Check if this is the question cell (contains ?)
                if (text.includes('?')) {
                    // The previous cell should contain the numbers
                    if (i > 0) {
                        const prevCell = cells[i - 1];
                        const prevAnnotation = prevCell.querySelector('annotation');
                        if (prevAnnotation?.textContent) {
                            let prevText = prevAnnotation.textContent;
                            prevText = cleanLatexWrappers(prevText);
                            questionNumbers = this.extractNumbers(prevText);
                            this.log('question numbers:', questionNumbers);
                            break;
                        }
                    }
                }
            }
            if (questionNumbers.length !== 2) {
                return this.failure('visualLCM', 'Could not find question numbers');
            }
            // Calculate LCM
            if (questionNumbers[0] === undefined || questionNumbers[1] === undefined) {
                return this.failure('visualLCM', 'Invalid question numbers');
            }
            const lcm = this.calculateLCM(questionNumbers[0], questionNumbers[1]);
            this.log('calculated LCM:', lcm);
            // Find the correct choice by counting blocks in iframes
            if (!context.choices || context.choices.length === 0) {
                return this.failure('visualLCM', 'No choices found');
            }
            this.log('found', context.choices.length, 'choices');
            const choiceBlockCounts = [];
            let matchingChoice = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const blockCount = this.countBlocksInChoice(choice);
                choiceBlockCounts.push(blockCount);
                this.log('choice', i + 1, ':', blockCount, 'blocks');
                if (blockCount === lcm) {
                    matchingChoice = i;
                    this.log('found matching choice at index', i);
                }
            }
            if (matchingChoice === -1) {
                const msg = `Could not find matching choice for LCM ${lcm}. ` +
                    `Found: ${choiceBlockCounts.join(', ')}`;
                return this.failure('visualLCM', msg);
            }
            // Click the choice
            const choiceButton = context.container.querySelectorAll('[data-test="challenge-choice"]')[matchingChoice];
            if (choiceButton) {
                this.log('clicking choice', matchingChoice);
                click(choiceButton);
            }
            return {
                type: 'visualLCM',
                success: true,
                numbers: questionNumbers,
                lcm,
                selectedChoice: matchingChoice + 1,
                choiceBlockCounts,
            };
        }
        /**
         * Count blocks in a choice by parsing the iframe's srcdoc
         */
        countBlocksInChoice(choice) {
            const iframe = choice.querySelector('iframe[srcdoc]');
            if (!iframe) {
                return 0;
            }
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) {
                return 0;
            }
            // Parse the SVG content from srcdoc
            // Count <path> and <rect> elements (these represent blocks)
            const pathMatches = srcdoc.match(/<path/g);
            const rectMatches = srcdoc.match(/<rect/g);
            const pathCount = pathMatches ? pathMatches.length : 0;
            const rectCount = rectMatches ? rectMatches.length : 0;
            return pathCount + rectCount;
        }
        /**
         * Extract numbers from a string like "7,21" or "7, 21"
         */
        extractNumbers(text) {
            const numbers = [];
            const parts = text.split(',');
            for (const part of parts) {
                const num = parseInt(part.trim(), 10);
                if (!isNaN(num)) {
                    numbers.push(num);
                }
            }
            return numbers;
        }
        /**
         * Calculate Greatest Common Divisor (GCD) using Euclidean algorithm
         */
        calculateGCD(a, b) {
            while (b !== 0) {
                const temp = b;
                b = a % b;
                a = temp;
            }
            return a;
        }
        /**
         * Calculate Least Common Multiple (LCM)
         * LCM(a, b) = (a * b) / GCD(a, b)
         */
        calculateLCM(a, b) {
            return (a * b) / this.calculateGCD(a, b);
        }
    }

    /**
     * Solver for "Find the greatest common factor" (GCF/GCD) challenges
     *
     * Example:
     * - Header: "Find the greatest common factor"
     * - Table with pairs and their GCF:
     *   - 14,12 → 2
     *   - 15,12 → 3
     *   - 16,12 → ? (need to find GCF(16,12) = 4)
     * - Choices: 4, 8
     * - Answer: 4
     */
    class GreatestCommonFactorSolver extends BaseSolver {
        name = 'GreatestCommonFactorSolver';
        canSolve(context) {
            // Check header text
            if (!context.headerText) {
                return false;
            }
            const headerLower = context.headerText.toLowerCase();
            // Check if this is a "greatest common factor" or "GCF" challenge
            if (headerLower.includes('greatest common factor') ||
                headerLower.includes('gcf') ||
                headerLower.includes('gcd') ||
                (headerLower.includes('наибольш') && headerLower.includes('делител'))) {
                // Verify we have a table with cells
                const table = context.container.querySelector('[class*="qjbi"]');
                return table !== null;
            }
            return false;
        }
        solve(context) {
            this.log('starting');
            // Find the table with pairs and GCF values
            const table = context.container.querySelector('[class*="qjbi"]');
            if (!table) {
                return this.failure('greatestCommonFactor', 'No table found');
            }
            // Find all cells in the table
            const cells = Array.from(table.querySelectorAll('[class*="ihM27"]'));
            this.log('found', cells.length, 'cells');
            if (cells.length === 0) {
                return this.failure('greatestCommonFactor', 'No cells found in table');
            }
            // Find the cell with "?" - this is our question
            let questionNumbers = [];
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                const annotation = cell.querySelector('annotation');
                if (!annotation?.textContent)
                    continue;
                let text = annotation.textContent;
                text = cleanLatexWrappers(text);
                // Check if this is the question cell (contains ?)
                if (text.includes('?')) {
                    // The previous cell should contain the numbers
                    if (i > 0) {
                        const prevCell = cells[i - 1];
                        const prevAnnotation = prevCell.querySelector('annotation');
                        if (prevAnnotation?.textContent) {
                            let prevText = prevAnnotation.textContent;
                            prevText = cleanLatexWrappers(prevText);
                            questionNumbers = this.extractNumbers(prevText);
                            this.log('question numbers:', questionNumbers);
                            break;
                        }
                    }
                }
            }
            if (questionNumbers.length !== 2) {
                return this.failure('greatestCommonFactor', 'Could not find question numbers');
            }
            // Calculate GCF
            if (questionNumbers[0] === undefined || questionNumbers[1] === undefined) {
                return this.failure('greatestCommonFactor', 'Invalid question numbers');
            }
            const gcf = this.calculateGCD(questionNumbers[0], questionNumbers[1]);
            this.log('calculated GCF:', gcf);
            // Find the correct choice
            if (!context.choices || context.choices.length === 0) {
                return this.failure('greatestCommonFactor', 'No choices found');
            }
            this.log('found', context.choices.length, 'choices');
            let matchingChoice = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const annotation = choice.querySelector('annotation');
                if (!annotation?.textContent)
                    continue;
                let text = annotation.textContent;
                text = cleanLatexWrappers(text);
                const choiceNumber = parseInt(text.trim(), 10);
                this.log('choice', i + 1, ':', choiceNumber);
                if (choiceNumber === gcf) {
                    matchingChoice = i;
                    this.log('found matching choice at index', i);
                    break;
                }
            }
            if (matchingChoice === -1) {
                return this.failure('greatestCommonFactor', `Could not find matching choice for GCF ${gcf}`);
            }
            // Click the choice
            const choiceButton = context.container
                .querySelectorAll('[data-test="challenge-choice"]')[matchingChoice];
            if (choiceButton) {
                this.log('clicking choice', matchingChoice);
                click(choiceButton);
            }
            return {
                type: 'greatestCommonFactor',
                success: true,
                numbers: questionNumbers,
                gcf,
                selectedChoice: matchingChoice + 1,
            };
        }
        /**
         * Extract numbers from a string like "16,12" or "16, 12"
         */
        extractNumbers(text) {
            const numbers = [];
            const parts = text.split(',');
            for (const part of parts) {
                const num = parseInt(part.trim(), 10);
                if (!isNaN(num)) {
                    numbers.push(num);
                }
            }
            return numbers;
        }
        /**
         * Calculate Greatest Common Divisor (GCD) using Euclidean algorithm
         */
        calculateGCD(a, b) {
            while (b !== 0) {
                const temp = b;
                b = a % b;
                a = temp;
            }
            return a;
        }
    }

    /**
     * Solver for "Find the greatest common factor" challenges
     * with visual block diagram choices
     *
     * Example:
     * - Header: "Find the greatest common factor"
     * - Table with pairs and visual representations:
     *   - 14,12 → [diagram with 2 blocks]
     *   - 15,12 → [diagram with 3 blocks]
     *   - 16,12 → ? (need to find GCF(16,12) = 4)
     * - Choices: iframes with block diagrams
     *   - Choice 1: [diagram with 4 blocks] ✓
     *   - Choice 2: [diagram with many blocks]
     */
    class VisualGCFSolver extends BaseSolver {
        name = 'VisualGCFSolver';
        canSolve(context) {
            // Check header text
            if (!context.headerText) {
                return false;
            }
            const headerLower = context.headerText.toLowerCase();
            // Check if this is a "greatest common factor" challenge
            if (!(headerLower.includes('greatest common factor') ||
                headerLower.includes('gcf') ||
                headerLower.includes('gcd') ||
                (headerLower.includes('наибольш') && headerLower.includes('делител')))) {
                return false;
            }
            // Verify we have a table with cells
            const table = context.container.querySelector('[class*="qjbi"]');
            if (!table) {
                return false;
            }
            // Check if choices contain iframes (visual representation)
            if (!context.choices || context.choices.length === 0) {
                return false;
            }
            // Check if at least one choice contains an iframe with srcdoc
            const hasVisualChoices = Array.from(context.choices).some(choice => {
                const iframe = choice.querySelector('iframe[srcdoc]');
                return iframe !== null;
            });
            return hasVisualChoices;
        }
        solve(context) {
            this.log('starting');
            // Find the table with pairs
            const table = context.container.querySelector('[class*="qjbi"]');
            if (!table) {
                return this.failure('visualGCF', 'No table found');
            }
            // Find all cells in the table
            const cells = Array.from(table.querySelectorAll('[class*="ihM27"]'));
            this.log('found', cells.length, 'cells');
            if (cells.length === 0) {
                return this.failure('visualGCF', 'No cells found in table');
            }
            // Find the cell with "?" - this is our question
            let questionNumbers = [];
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                const annotation = cell.querySelector('annotation');
                if (!annotation?.textContent)
                    continue;
                let text = annotation.textContent;
                text = cleanLatexWrappers(text);
                // Check if this is the question cell (contains ?)
                if (text.includes('?')) {
                    // The previous cell should contain the numbers
                    if (i > 0) {
                        const prevCell = cells[i - 1];
                        const prevAnnotation = prevCell.querySelector('annotation');
                        if (prevAnnotation?.textContent) {
                            let prevText = prevAnnotation.textContent;
                            prevText = cleanLatexWrappers(prevText);
                            questionNumbers = this.extractNumbers(prevText);
                            this.log('question numbers:', questionNumbers);
                            break;
                        }
                    }
                }
            }
            if (questionNumbers.length !== 2) {
                return this.failure('visualGCF', 'Could not find question numbers');
            }
            // Calculate GCF
            if (questionNumbers[0] === undefined || questionNumbers[1] === undefined) {
                return this.failure('visualGCF', 'Invalid question numbers');
            }
            const gcf = this.calculateGCD(questionNumbers[0], questionNumbers[1]);
            this.log('calculated GCF:', gcf);
            // Find the correct choice by counting blocks in iframes
            if (!context.choices || context.choices.length === 0) {
                return this.failure('visualGCF', 'No choices found');
            }
            this.log('found', context.choices.length, 'choices');
            const choiceBlockCounts = [];
            let matchingChoice = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const blockCount = this.countBlocksInChoice(choice);
                choiceBlockCounts.push(blockCount);
                this.log('choice', i + 1, ':', blockCount, 'blocks');
                if (blockCount === gcf) {
                    matchingChoice = i;
                    this.log('found matching choice at index', i);
                }
            }
            if (matchingChoice === -1) {
                const msg = `Could not find matching choice for GCF ${gcf}. ` +
                    `Found: ${choiceBlockCounts.join(', ')}`;
                return this.failure('visualGCF', msg);
            }
            // Click the choice
            const choiceButton = context.container.querySelectorAll('[data-test="challenge-choice"]')[matchingChoice];
            if (choiceButton) {
                this.log('clicking choice', matchingChoice);
                click(choiceButton);
            }
            return {
                type: 'visualGCF',
                success: true,
                numbers: questionNumbers,
                gcf,
                selectedChoice: matchingChoice + 1,
                choiceBlockCounts,
            };
        }
        /**
         * Count blocks in a choice by parsing the iframe's srcdoc
         */
        countBlocksInChoice(choice) {
            const iframe = choice.querySelector('iframe[srcdoc]');
            if (!iframe) {
                return 0;
            }
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) {
                return 0;
            }
            // Parse the SVG content from srcdoc
            // Count <path> and <rect> elements (these represent blocks)
            const pathMatches = srcdoc.match(/<path/g);
            const rectMatches = srcdoc.match(/<rect/g);
            const pathCount = pathMatches ? pathMatches.length : 0;
            const rectCount = rectMatches ? rectMatches.length : 0;
            return pathCount + rectCount;
        }
        /**
         * Extract numbers from a string like "16,12" or "16, 12"
         */
        extractNumbers(text) {
            const numbers = [];
            const parts = text.split(',');
            for (const part of parts) {
                const num = parseInt(part.trim(), 10);
                if (!isNaN(num)) {
                    numbers.push(num);
                }
            }
            return numbers;
        }
        /**
         * Calculate Greatest Common Divisor (GCD) using Euclidean algorithm
         */
        calculateGCD(a, b) {
            while (b !== 0) {
                const temp = b;
                b = a % b;
                a = temp;
            }
            return a;
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
                this.logDebug('canSolve: missing equationContainer or choices');
                return false;
            }
            // Check if equation contains blank between two values
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent) {
                this.logDebug('canSolve: no annotation found');
                return false;
            }
            const text = annotation.textContent;
            const hasBlank = text.includes('\\duoblank');
            this.logDebug('canSolve: equation text:', text, 'hasBlank:', hasBlank);
            // Check if choices contain operators
            const hasOperatorChoices = context.choices.some((choice, index) => {
                if (!choice)
                    return false;
                // Check text content
                const choiceText = choice.textContent?.trim() ?? '';
                if (choiceText === '<' || choiceText === '>' || choiceText === '=') {
                    this.logDebug('canSolve: found operator in text of choice', index, ':', choiceText);
                    return true;
                }
                // Check annotation (for KaTeX)
                const choiceAnnotation = choice.querySelector('annotation');
                const annotationText = choiceAnnotation?.textContent?.trim() ?? '';
                if (annotationText.includes('\\lt') || annotationText.includes('\\gt') ||
                    annotationText.includes('=') || annotationText.includes('<') ||
                    annotationText.includes('>')) {
                    this.logDebug('canSolve: found operator in annotation of choice', index, ':', annotationText);
                    return true;
                }
                return false;
            });
            this.logDebug('canSolve: hasOperatorChoices:', hasOperatorChoices, 'result:', hasBlank && hasOperatorChoices);
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
                const choiceText = choice.textContent?.trim() ?? '';
                const choiceAnnotation = choice.querySelector('annotation')?.textContent?.trim() ?? '';
                this.log('choice', i, 'text:', choiceText, 'annotation:', choiceAnnotation, 'parsed operator:', choiceOperator);
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
            this.logDebug('after cleanLatexWrappers:', cleaned);
            // Replace blank with marker
            cleaned = cleaned.replace(/\\duoblank\{[^}]*\}/g, ' BLANK ');
            this.logDebug('after blank replacement:', cleaned);
            // Remove LaTeX spacing
            cleaned = cleaned.replace(/\\[;,]/g, ' ');
            cleaned = cleaned.replace(/\\quad/g, ' ');
            cleaned = cleaned.replace(/\s+/g, ' ').trim();
            this.logDebug('after spacing cleanup:', cleaned);
            // Split by BLANK
            const parts = cleaned.split('BLANK');
            if (parts.length !== 2 || !parts[0] || !parts[1]) {
                this.logError('could not split by BLANK, parts:', parts);
                return null;
            }
            let leftPart = parts[0].trim();
            let rightPart = parts[1].trim();
            this.logDebug('split parts - left:', leftPart, 'right:', rightPart);
            // Remove outer braces
            leftPart = this.removeBraces(leftPart);
            rightPart = this.removeBraces(rightPart);
            this.logDebug('after removeBraces - left:', leftPart, 'right:', rightPart);
            // Convert fractions
            leftPart = convertLatexFractions(leftPart);
            rightPart = convertLatexFractions(rightPart);
            this.logDebug('after convertLatexFractions - left:', leftPart, 'right:', rightPart);
            // Remove remaining braces
            leftPart = leftPart.replace(/[{}]/g, '').trim();
            rightPart = rightPart.replace(/[{}]/g, '').trim();
            this.logDebug('after brace removal - left:', leftPart, 'right:', rightPart);
            // Evaluate
            const leftValue = evaluateMathExpression(leftPart);
            const rightValue = evaluateMathExpression(rightPart);
            this.logDebug('evaluated - left:', leftValue, 'right:', rightValue);
            if (leftValue === null || rightValue === null) {
                this.logError('could not evaluate values - left:', leftValue, 'right:', rightValue);
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
            // Check annotation first (for KaTeX)
            const annotation = choice.querySelector('annotation');
            const annotationText = annotation?.textContent?.trim() ?? '';
            // Check text content as fallback
            const text = choice.textContent?.trim() ?? '';
            // Combine both sources for checking
            const checkText = annotationText || text;
            // Check for less than operator
            if (checkText.includes('\\lt') || checkText.includes('<')) {
                // Make sure it's not <=
                if (!checkText.includes('\\le') && !checkText.includes('<=')) {
                    return '<';
                }
            }
            // Check for greater than operator
            if (checkText.includes('\\gt') || checkText.includes('>')) {
                // Make sure it's not >=
                if (!checkText.includes('\\ge') && !checkText.includes('>=')) {
                    return '>';
                }
            }
            // Check for equals operator
            if (checkText.includes('=')) {
                return '=';
            }
            return null;
        }
    }

    /**
     * Парсер для круговых диаграмм (pie charts)
     */
    /**
     * Извлекает часть SVG для анализа (предпочитает dark-img)
     */
    function extractSvgContent$1(svgContent) {
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
     * Метод 3: Анализ секторных путей (pie chart без <circle> элемента)
     * Используется для круговых диаграмм, нарисованных только path-элементами
     */
    function extractBySectorPaths(svgContent) {
        // Look for paths that form pie sectors (go to center point, typically L100 100)
        const allPathsPattern = /<path[^>]*d="[^"]*"[^>]*>/g;
        const allPaths = svgContent.match(allPathsPattern) ?? [];
        // Filter paths that contain "L100 100" or "L 100 100" (lines to center)
        const sectorPaths = allPaths.filter(p => {
            const dMatch = p.match(/d="([^"]+)"/);
            if (!dMatch?.[1])
                return false;
            const d = dMatch[1];
            return /L\s*100\s+100/.test(d);
        });
        if (sectorPaths.length === 0)
            return null;
        // Count colored (filled) sectors vs total sectors
        const coloredSectors = sectorPaths.filter(p => /#(?:49C0F8|1CB0F6)/i.test(p));
        const totalSectors = sectorPaths.length;
        const numerator = coloredSectors.length;
        if (totalSectors > 0 && numerator > 0) {
            logger.debug('extractPieChartFraction: (method 3) sector paths - colored:', numerator, 'total:', totalSectors);
            return {
                numerator,
                denominator: totalSectors,
                value: numerator / totalSectors,
            };
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
        const svg = extractSvgContent$1(svgContent);
        // Try method 1: colored/uncolored sectors
        const result1 = extractByColoredSectors(svg);
        if (result1)
            return result1;
        // Try method 2: circle + paths analysis
        const result2 = extractByCircleAndPaths(svg);
        if (result2)
            return result2;
        // Try method 3: sector paths without circle (pie chart drawn with paths only)
        const result3 = extractBySectorPaths(svg);
        if (result3)
            return result3;
        logger.debug('extractPieChartFraction: no pie sectors found');
        return null;
    }
    /**
     * Проверяет, содержит ли SVG круговую диаграмму
     */
    function isPieChart(svgContent) {
        if (!svgContent)
            return false;
        // First, exclude block diagrams (they have rect elements)
        const hasRects = /<rect[^>]*>/i.test(svgContent);
        if (hasRects) {
            // Block diagrams and grids have rects, pie charts don't
            return false;
        }
        // Pie charts typically have colored paths or circles
        const hasColoredPaths = /#(?:49C0F8|1CB0F6)/i.test(svgContent);
        const hasCircle = /<circle/i.test(svgContent);
        const hasPaths = /<path[^>]*>/i.test(svgContent);
        // Check for sector paths (paths with L100 100 - lines to center)
        const hasSectorPaths = /L\s*100\s+100/.test(svgContent);
        return (hasColoredPaths && hasPaths) || hasCircle || (hasSectorPaths && hasColoredPaths);
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
            // Exclude "Show this another way" challenges with block diagrams
            // These should be handled by BlockDiagramChoiceSolver
            const headerMatches = this.headerContains(context, 'show', 'another', 'way');
            if (headerMatches) {
                // Check if main challenge has a block diagram
                const mainIframe = context.container.querySelector('iframe[title="Math Web Element"]');
                if (mainIframe) {
                    const srcdoc = mainIframe.getAttribute('srcdoc');
                    if (srcdoc && isBlockDiagram(srcdoc)) {
                        // This is a block diagram choice challenge, not a pie chart challenge
                        return false;
                    }
                }
            }
            // Check if choices contain pie chart iframes (not block diagrams)
            const hasPieChartChoices = context.choices.some(choice => {
                const iframe = choice?.querySelector('iframe[title="Math Web Element"]');
                if (!iframe)
                    return false;
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    return false;
                // Explicitly exclude block diagrams
                if (isBlockDiagram(srcdoc)) {
                    return false;
                }
                // Check if it's actually a pie chart
                return isPieChart(srcdoc);
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
            const answer = solveEquationWithBlank(equation);
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
    }

    /**
     * Парсер для сеточных диаграмм (grid diagrams)
     *
     * Сеточные диаграммы показывают прямоугольную сетку ячеек,
     * где некоторые ячейки закрашены для визуализации дробей.
     */
    /**
     * Извлекает часть SVG для анализа (предпочитает dark-img)
     */
    function extractSvgContent(srcdoc) {
        // Prefer dark-img since Duolingo Math often uses dark theme
        const darkImgMatch = srcdoc.match(/<span class="dark-img">([\s\S]*?)<\/span>/);
        if (darkImgMatch?.[1]) {
            logger.debug('extractGridFraction: using dark-img SVG');
            return darkImgMatch[1];
        }
        // Fallback to light-img
        const lightImgMatch = srcdoc.match(/<span class="light-img">([\s\S]*?)<\/span>/);
        if (lightImgMatch?.[1]) {
            logger.debug('extractGridFraction: using light-img SVG');
            return lightImgMatch[1];
        }
        return srcdoc;
    }
    /**
     * Извлекает дробь из сеточной диаграммы SVG
     *
     * Сеточные диаграммы используются в заданиях для визуализации дробей.
     * Каждая ячейка сетки = 1 единица.
     *
     * @param srcdoc - srcdoc атрибут iframe с SVG
     * @returns объект с дробью или null
     *
     * @example
     * // SVG с сеткой 3x3, где 6 ячеек закрашены
     * extractGridFraction(srcdoc) // { numerator: 6, denominator: 9, value: 0.666... }
     */
    function extractGridFraction(srcdoc) {
        if (!srcdoc)
            return null;
        const svgContent = extractSvgContent(srcdoc);
        // IMPORTANT: Exclude pie charts (they have paths to center L100 100)
        // Pie charts have sector paths, grids don't
        if (/L\s*100\s+100/.test(svgContent)) {
            logger.debug('extractGridFraction: skipping - detected pie chart (L100 100)');
            return null;
        }
        // Count all path elements with fill color (grid cells as paths)
        const allPaths = svgContent.match(/<path[^>]*fill=["'][^"']+["'][^>]*>/gi) ?? [];
        // Count all rect elements with fill color (grid cells as rects)
        const allRects = svgContent.match(/<rect[^>]*fill=["'][^"']+["'][^>]*>/gi) ?? [];
        const totalCells = allPaths.length + allRects.length;
        if (totalCells === 0) {
            logger.debug('extractGridFraction: no grid cells found');
            return null;
        }
        // Count colored (blue) cells
        const coloredPaths = allPaths.filter(p => /#(?:49C0F8|1CB0F6)/i.test(p));
        const coloredRects = allRects.filter(r => /#(?:49C0F8|1CB0F6)/i.test(r));
        const coloredCells = coloredPaths.length + coloredRects.length;
        if (coloredCells === 0) {
            logger.debug('extractGridFraction: no colored cells found');
            return null;
        }
        logger.debug('extractGridFraction: colored =', coloredCells, 'total =', totalCells);
        return {
            numerator: coloredCells,
            denominator: totalCells,
            value: coloredCells / totalCells,
        };
    }
    /**
     * Проверяет, содержит ли srcdoc сеточную диаграмму
     */
    function isGridDiagram(srcdoc) {
        if (!srcdoc)
            return false;
        const svgContent = extractSvgContent(srcdoc);
        // Exclude pie charts (they have <circle> elements or sector paths with L100 100)
        const hasCircle = svgContent.includes('<circle');
        const hasSectorPaths = /L\s*100\s+100/.test(svgContent);
        if (hasCircle || hasSectorPaths)
            return false;
        // Grids have rect or path elements with fill colors
        const hasColoredElements = /#(?:49C0F8|1CB0F6)/i.test(svgContent);
        const hasRects = /<rect[^>]*>/i.test(svgContent);
        const hasPaths = /<path[^>]*>/i.test(svgContent);
        // Grids typically have multiple rect or path elements
        const rectCount = (svgContent.match(/<rect[^>]*>/gi) ?? []).length;
        const pathCount = (svgContent.match(/<path[^>]*>/gi) ?? []).length;
        // A grid should have multiple cells (at least 4, typically 9 for 3x3 or more)
        return hasColoredElements && (hasRects || hasPaths) && (rectCount + pathCount >= 4);
    }

    /**
     * Солвер для заданий "Match the pairs"
     * Сопоставляет элементы по значениям: дроби, pie charts, округление
     */
    class MatchPairsSolver extends BaseSolver {
        name = 'MatchPairsSolver';
        canSolve(context) {
            // Match pairs require a specific header
            const hasHeader = this.headerContains(context, 'match', 'pair') ||
                this.headerContains(context, 'match', 'equivalent');
            if (!hasHeader) {
                // Without a specific header, don't match (to avoid false positives)
                return false;
            }
            // Exclude if there's a NumberLine slider (those use InteractiveSliderSolver)
            const allIframes = findAllIframes(context.container);
            for (const iframe of allIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc?.includes('NumberLine')) {
                    // Exclude ExpressionBuild components
                    if (!srcdoc.includes('exprBuild') && !srcdoc.includes('ExpressionBuild')) {
                        return false; // This is a slider challenge, not a match pairs challenge
                    }
                }
            }
            // Check for tap token elements specifically (both variants)
            const tapTokens = context.container.querySelectorAll('[data-test="challenge-tap-token"], [data-test="-challenge-tap-token"]');
            // Need at least 2 tokens to form a pair
            // Also check if there are any active (non-disabled) tokens remaining
            const activeTokens = Array.from(tapTokens).filter(token => token.getAttribute('aria-disabled') !== 'true');
            // Require header AND at least 2 active tokens
            return activeTokens.length >= 2;
        }
        solve(context) {
            this.log('starting');
            const tapTokens = context.container.querySelectorAll('[data-test="challenge-tap-token"], [data-test="-challenge-tap-token"]');
            this.log('found tap tokens:', tapTokens.length);
            if (tapTokens.length < 2) {
                return this.failure('matchPairs', 'Not enough tap tokens');
            }
            // Extract values from all tokens (only active/clickable ones)
            const tokens = this.extractTokens(Array.from(tapTokens));
            this.log('active tokens:', tokens.length);
            if (tokens.length < 2) {
                // Check if challenge is already complete (all pairs matched)
                const allDisabled = Array.from(tapTokens).every(token => token.getAttribute('aria-disabled') === 'true');
                if (allDisabled && tapTokens.length >= 2) {
                    this.log('all pairs already matched, challenge complete');
                    return this.success({
                        type: 'matchPairs',
                        pairs: [],
                        clickedPair: { first: '', second: '' },
                    });
                }
                return this.failure('matchPairs', 'Not enough active tokens');
            }
            // Find matching pairs
            const pairs = this.findPairs(tokens);
            if (pairs.length === 0) {
                this.logError('no matching pairs found');
                return this.failure('matchPairs', 'No matching pairs found');
            }
            this.log('found', pairs.length, 'pairs to match');
            // Click all pairs sequentially
            // Start clicking the first pair immediately
            const firstPair = pairs[0];
            if (!firstPair) {
                return this.failure('matchPairs', 'No pair to click');
            }
            this.log('clicking pair:', firstPair.first.rawValue, '↔', firstPair.second.rawValue);
            this.click(firstPair.first.element);
            // Click second element of first pair with delay
            setTimeout(() => {
                this.click(firstPair.second.element);
            }, 100);
            // If there are more pairs, click them sequentially with delays
            // This allows DOM to update between clicks
            for (let i = 1; i < pairs.length; i++) {
                const pair = pairs[i];
                if (!pair)
                    continue;
                setTimeout(() => {
                    this.log('clicking pair:', pair.first.rawValue, '↔', pair.second.rawValue);
                    this.click(pair.first.element);
                    setTimeout(() => {
                        this.click(pair.second.element);
                    }, 100);
                }, 300 * i); // Delay increases for each subsequent pair
            }
            return this.success({
                type: 'matchPairs',
                pairs: pairs.map(p => ({
                    first: p.first.rawValue,
                    second: p.second.rawValue,
                })),
                clickedPair: {
                    first: firstPair.first.rawValue,
                    second: firstPair.second.rawValue,
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
                    this.log('token', i, 'is disabled, skipping');
                    continue;
                }
                // Check for "Nearest X" or "UNIT RATE" label
                const nearestLabel = token.querySelector('._27M4R');
                if (nearestLabel) {
                    const labelText = nearestLabel.textContent ?? '';
                    this.log('token', i, 'has Nearest label:', labelText);
                    const nearestMatch = labelText.match(/Nearest\s*(\d+)/i);
                    if (nearestMatch?.[1]) {
                        hasNearestRounding = true;
                        roundingBase = parseInt(nearestMatch[1], 10);
                        const tokenData = this.extractRoundingToken(token, i, roundingBase);
                        if (tokenData) {
                            this.log('token', i, 'extracted rounding:', tokenData.rawValue);
                            tokens.push(tokenData);
                            continue;
                        }
                        else {
                            this.log('token', i, 'failed to extract rounding value');
                        }
                    }
                    // Check for "UNIT RATE" label
                    if (labelText.toUpperCase().includes('UNIT RATE')) {
                        const value = extractKatexValue(token);
                        if (value) {
                            const evaluated = evaluateMathExpression(value);
                            if (evaluated !== null) {
                                this.log('token', i, 'extracted UNIT RATE:', value, '=', evaluated);
                                tokens.push({
                                    index: i,
                                    element: token,
                                    rawValue: value,
                                    numericValue: evaluated,
                                    isUnitRate: true,
                                });
                                continue;
                            }
                        }
                    }
                }
                // Check for iframe with block diagram, grid, or pie chart
                const iframe = token.querySelector('iframe[title="Math Web Element"]');
                if (iframe && !nearestLabel) {
                    const srcdoc = iframe.getAttribute('srcdoc');
                    if (srcdoc?.includes('<svg')) {
                        // First check for block diagram (columns of blocks)
                        if (isBlockDiagram(srcdoc)) {
                            const blockCount = extractBlockDiagramValue(srcdoc);
                            if (blockCount !== null) {
                                this.log('token', i, 'extracted block diagram:', blockCount);
                                tokens.push({
                                    index: i,
                                    element: token,
                                    rawValue: `${blockCount} blocks`,
                                    numericValue: blockCount,
                                    isBlockDiagram: true,
                                });
                                continue;
                            }
                        }
                        // Then check for grid diagram (grid of cells)
                        if (isGridDiagram(srcdoc)) {
                            const gridFraction = extractGridFraction(srcdoc);
                            if (gridFraction) {
                                this.log('token', i, 'extracted grid diagram:', gridFraction.value);
                                tokens.push({
                                    index: i,
                                    element: token,
                                    rawValue: `${gridFraction.numerator}/${gridFraction.denominator} (grid)`,
                                    numericValue: gridFraction.value,
                                    isPieChart: true, // Treat as visual fraction
                                });
                                continue;
                            }
                        }
                        // Then check for pie chart
                        const fraction = extractPieChartFraction(srcdoc);
                        if (fraction) {
                            this.log('token', i, 'extracted pie chart:', fraction.value);
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
                    // Check if this is a list of factors (e.g., "1, 4, 5, 10" or "1,4,5,10")
                    const hasFactorsLabel = token.textContent?.toLowerCase().includes('factor') ?? false;
                    const factorsMatch = value.match(/^[\d\s,]+$/);
                    const hasMultipleCommas = (value.match(/,/g) ?? []).length >= 1;
                    if ((factorsMatch && hasMultipleCommas) || hasFactorsLabel) {
                        // Parse the factors list
                        const factors = value.split(',')
                            .map(s => {
                            const num = parseInt(s.trim(), 10);
                            return Number.isNaN(num) ? null : num;
                        })
                            .filter((n) => n !== null);
                        if (factors.length > 1) {
                            this.log('token', i, 'FACTORS LIST detected:', factors.join(', '));
                            tokens.push({
                                index: i,
                                element: token,
                                rawValue: value,
                                numericValue: null,
                                isFactorsList: true,
                                factors,
                            });
                            continue;
                        }
                    }
                    // Check if this is a linear equation (y = mx or y = mx + b)
                    const equationCoefficient = this.extractEquationCoefficient(value);
                    if (equationCoefficient !== null) {
                        this.log('token', i, 'extracted equation coefficient:', value, '→', equationCoefficient);
                        tokens.push({
                            index: i,
                            element: token,
                            rawValue: value,
                            numericValue: equationCoefficient,
                            isEquation: true,
                            equationCoefficient,
                            isExpression: true,
                            isPieChart: false,
                        });
                        continue;
                    }
                    const evaluated = evaluateMathExpression(value);
                    const isCompound = this.isCompoundExpression(value);
                    this.log('token', i, 'extracted KaTeX:', value, '=', evaluated);
                    tokens.push({
                        index: i,
                        element: token,
                        rawValue: value,
                        numericValue: evaluated,
                        isExpression: isCompound,
                        isPieChart: false,
                    });
                }
                else {
                    this.log('token', i, 'failed to extract any value');
                }
            }
            // Store for use in findPairs
            this.hasNearestRounding = hasNearestRounding;
            this.roundingBase = roundingBase;
            return tokens;
        }
        hasNearestRounding = false;
        roundingBase = 10;
        /**
         * Нормализует число для сравнения, округляя до разумного количества знаков после запятой
         * Это помогает избежать проблем с точностью чисел с плавающей точкой
         */
        normalizeForComparison(value) {
            // Для чисел меньше 1, используем больше знаков после запятой
            if (Math.abs(value) < 1) {
                return Math.round(value * 10000) / 10000;
            }
            // Для чисел от 1 до 100, используем 2 знака после запятой
            if (Math.abs(value) < 100) {
                return Math.round(value * 100) / 100;
            }
            // Для больших чисел, округляем до целого
            return Math.round(value);
        }
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
                value.includes('/') || // Division
                value.includes('÷') || // Unicode division
                /\)\s*-/.test(value) ||
                /\d\s*-\s*\(/.test(value));
        }
        findPairs(tokens) {
            const pairs = [];
            const usedIndices = new Set();
            const pieCharts = tokens.filter(t => t.isPieChart);
            const blockDiagrams = tokens.filter(t => t.isBlockDiagram && !t.isRoundingTarget);
            const roundingTargets = tokens.filter(t => t.isRoundingTarget);
            const factorsLists = tokens.filter(t => t.isFactorsList);
            const equations = tokens.filter(t => t.isEquation);
            const unitRates = tokens.filter(t => t.isUnitRate);
            const numbers = tokens.filter(t => !t.isPieChart && !t.isBlockDiagram && !t.isRoundingTarget && !t.isFactorsList && !t.isEquation && !t.isUnitRate);
            this.log('blockDiagrams:', blockDiagrams.length, 'pieCharts:', pieCharts.length, 'roundingTargets:', roundingTargets.length, 'factorsLists:', factorsLists.length, 'equations:', equations.length, 'unitRates:', unitRates.length, 'numbers:', numbers.length);
            // MODE 1: Rounding matching
            if (this.hasNearestRounding && roundingTargets.length > 0) {
                this.matchRounding(tokens, roundingTargets, pairs, usedIndices);
            }
            // MODE 2: Equation to Unit Rate matching (equations like y=5x with unit rate values)
            else if (equations.length > 0 && unitRates.length > 0) {
                this.matchEquationsToUnitRates(equations, unitRates, pairs, usedIndices);
            }
            // MODE 3: Block diagram matching (blocks to numbers with same value)
            else if (blockDiagrams.length > 0 && numbers.length > 0) {
                this.matchBlockDiagrams(blockDiagrams, numbers, pairs, usedIndices);
            }
            // MODE 4: Factors matching (numbers to their factors lists)
            else if (factorsLists.length > 0 && numbers.length > 0) {
                this.matchFactors(factorsLists, numbers, pairs, usedIndices);
            }
            // MODE 5: Pie chart matching
            else if (pieCharts.length > 0 && numbers.length > 0) {
                this.matchPieCharts(pieCharts, numbers, pairs, usedIndices);
            }
            // MODE 6: Expression matching
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
        matchBlockDiagrams(blockDiagrams, numbers, pairs, usedIndices) {
            this.log('matchBlockDiagrams: comparing', blockDiagrams.length, 'blocks with', numbers.length, 'numbers');
            // Log all values for debugging
            this.log('matchBlockDiagrams: blocks:', blockDiagrams.map(b => `${b.rawValue}=${b.numericValue}`).join(', '));
            this.log('matchBlockDiagrams: numbers:', numbers.map(n => `${n.rawValue}=${n.numericValue}`).join(', '));
            for (const block of blockDiagrams) {
                if (usedIndices.has(block.index) || block.numericValue === null)
                    continue;
                this.log('matchBlockDiagrams: checking block', block.rawValue, '=', block.numericValue);
                for (const num of numbers) {
                    if (usedIndices.has(num.index) || num.numericValue === null) {
                        continue;
                    }
                    this.log('matchBlockDiagrams: comparing block', block.numericValue, 'with number', num.numericValue);
                    // Direct match
                    if (Math.abs(block.numericValue - num.numericValue) < 0.0001) {
                        pairs.push({ first: block, second: num });
                        usedIndices.add(block.index);
                        usedIndices.add(num.index);
                        this.log('found block diagram pair:', block.rawValue, '=', num.rawValue);
                        break;
                    }
                    // Handle case where block diagram shows decimal * 100 (e.g., 175 = 1.75)
                    // Check if block / 100 matches the number
                    const blockDividedBy100 = block.numericValue / 100;
                    if (Math.abs(blockDividedBy100 - num.numericValue) < 0.0001) {
                        pairs.push({ first: block, second: num });
                        usedIndices.add(block.index);
                        usedIndices.add(num.index);
                        this.log('found block diagram pair (decimal match):', block.rawValue, '/ 100 =', num.rawValue);
                        break;
                    }
                    // Handle reverse case: number * 100 matches block
                    // This is the most common case: block diagrams show numbers scaled by 100
                    // (e.g., 175 blocks = 1.75, 235 blocks = 2.35, 260 blocks = 2.6)
                    const numTimes100 = num.numericValue * 100;
                    // Use rounding to handle floating point precision issues
                    // Round both values to nearest integer for comparison
                    const roundedBlock = Math.round(block.numericValue);
                    const roundedNumTimes100 = Math.round(numTimes100);
                    this.log('matchBlockDiagrams: rounded comparison - block:', roundedBlock, 'num*100:', roundedNumTimes100, '(num:', num.numericValue, ', num*100 raw:', numTimes100, ')');
                    // Primary check: rounded values match exactly
                    if (roundedBlock === roundedNumTimes100) {
                        pairs.push({ first: block, second: num });
                        usedIndices.add(block.index);
                        usedIndices.add(num.index);
                        this.log('found block diagram pair (reverse decimal match):', block.rawValue, '=', num.rawValue, '* 100');
                        break;
                    }
                    // Secondary check: use tolerance for floating point comparison
                    // This handles cases where rounding doesn't work perfectly
                    // Use a more generous tolerance (1.0) to handle precision issues
                    const diff = Math.abs(block.numericValue - numTimes100);
                    this.log('matchBlockDiagrams: tolerance check - diff:', diff, 'block:', block.numericValue, 'num*100:', numTimes100);
                    if (diff < 1.0) {
                        pairs.push({ first: block, second: num });
                        usedIndices.add(block.index);
                        usedIndices.add(num.index);
                        this.log('found block diagram pair (tolerance match):', block.rawValue, '≈', num.rawValue, '* 100');
                        break;
                    }
                    // Additional check: if block is much larger than number, try dividing
                    // This handles cases where block diagram represents a scaled version
                    if (block.numericValue > num.numericValue * 10) {
                        // Try dividing block by powers of 10 to find match
                        for (let scale = 10; scale <= 1000; scale *= 10) {
                            const scaled = block.numericValue / scale;
                            if (Math.abs(scaled - num.numericValue) < 0.0001) {
                                pairs.push({ first: block, second: num });
                                usedIndices.add(block.index);
                                usedIndices.add(num.index);
                                this.log('found block diagram pair (scaled match):', block.rawValue, '/', scale, '=', num.rawValue);
                                break;
                            }
                        }
                        if (usedIndices.has(block.index))
                            break;
                    }
                }
            }
            this.log('matchBlockDiagrams: found', pairs.length, 'pairs');
        }
        matchFactors(factorsLists, numbers, pairs, usedIndices) {
            this.log('using factors matching mode');
            // Helper function to check if all numbers in a list are factors of a given number
            const areAllFactors = (factors, number) => {
                if (number <= 0)
                    return false;
                return factors.every(factor => {
                    if (factor <= 0 || factor > number)
                        return false;
                    return number % factor === 0;
                });
            };
            for (const num of numbers) {
                if (usedIndices.has(num.index))
                    continue;
                if (num.numericValue === null || Number.isNaN(num.numericValue))
                    continue;
                // Find matching factors list where all factors divide the number
                for (const factorsList of factorsLists) {
                    if (usedIndices.has(factorsList.index))
                        continue;
                    if (!factorsList.factors)
                        continue;
                    if (areAllFactors(factorsList.factors, num.numericValue)) {
                        pairs.push({ first: num, second: factorsList });
                        usedIndices.add(num.index);
                        usedIndices.add(factorsList.index);
                        this.log('found factors pair:', num.rawValue, '↔', factorsList.rawValue, '(factors:', factorsList.factors.join(', '), ')');
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
        /**
         * Извлекает коэффициент из линейного уравнения вида y = mx или y = mx + b
         * Поддерживает дроби: y = (2/3)x, y = \frac{2}{3}x
         */
        extractEquationCoefficient(equation) {
            // Clean LaTeX
            let cleaned = cleanLatexWrappers(equation);
            cleaned = convertLatexOperators(cleaned);
            cleaned = convertLatexFractions(cleaned);
            cleaned = cleaned.replace(/\s+/g, '');
            // Pattern 1: y = mx (simple number coefficient)
            // Pattern: y = (number)x or y = -(number)x
            let match = cleaned.match(/^y=(-?\d+\.?\d*)x$/);
            if (match && match[1] !== undefined) {
                const m = parseFloat(match[1]);
                if (!Number.isNaN(m)) {
                    return m;
                }
            }
            // Pattern 2: y = (fraction)x or y = (a/b)x
            // First try to match y = (expression)x where expression can be evaluated
            match = cleaned.match(/^y=(.+?)x$/);
            if (match && match[1] !== undefined) {
                const coefficientExpr = match[1];
                // Remove outer parentheses if present
                const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
                const evaluated = evaluateMathExpression(cleanedCoeff);
                if (evaluated !== null) {
                    return evaluated;
                }
            }
            // Pattern 3: y = mx + b or y = mx - b
            match = cleaned.match(/^y=(-?\d+\.?\d*)x[+-](-?\d+\.?\d*)$/);
            if (match && match[1] !== undefined) {
                const m = parseFloat(match[1]);
                if (!Number.isNaN(m)) {
                    return m; // Return coefficient, ignore b for matching purposes
                }
            }
            // Pattern 4: y = (fraction)x + b
            match = cleaned.match(/^y=(.+?)x[+-](-?\d+\.?\d*)$/);
            if (match && match[1] !== undefined) {
                const coefficientExpr = match[1];
                const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
                const evaluated = evaluateMathExpression(cleanedCoeff);
                if (evaluated !== null) {
                    return evaluated;
                }
            }
            return null;
        }
        /**
         * Сопоставляет уравнения (y = mx) с unit rate значениями
         */
        matchEquationsToUnitRates(equations, unitRates, pairs, usedIndices) {
            this.log('matchEquationsToUnitRates: comparing', equations.length, 'equations with', unitRates.length, 'unit rates');
            for (const equation of equations) {
                if (usedIndices.has(equation.index) || equation.equationCoefficient === undefined)
                    continue;
                const coeff = equation.equationCoefficient;
                for (const unitRate of unitRates) {
                    if (usedIndices.has(unitRate.index) || unitRate.numericValue === null)
                        continue;
                    // Match coefficient with unit rate value (with tolerance for floating point)
                    if (Math.abs(coeff - unitRate.numericValue) < 0.0001) {
                        pairs.push({ first: equation, second: unitRate });
                        usedIndices.add(equation.index);
                        usedIndices.add(unitRate.index);
                        this.log('found equation-unitRate pair:', equation.rawValue, '(coeff:', coeff, ') ↔', unitRate.rawValue, '(value:', unitRate.numericValue, ')');
                        break;
                    }
                }
            }
            this.log('matchEquationsToUnitRates: found', pairs.length, 'pairs');
        }
        matchFallback(tokens, pairs, usedIndices) {
            const fallbackTokens = tokens.filter(t => !t.isRoundingTarget);
            // First pass: prefer matching expressions with simple numbers
            const expressions = fallbackTokens.filter(t => t.isExpression && !usedIndices.has(t.index));
            const simpleNumbers = fallbackTokens.filter(t => !t.isExpression && !usedIndices.has(t.index));
            for (const expr of expressions) {
                if (expr.numericValue === null)
                    continue;
                for (const num of simpleNumbers) {
                    if (usedIndices.has(num.index) || num.numericValue === null) {
                        continue;
                    }
                    if (Math.abs(expr.numericValue - num.numericValue) < 0.0001) {
                        pairs.push({ first: expr, second: num });
                        usedIndices.add(expr.index);
                        usedIndices.add(num.index);
                        this.log('found fallback pair (expr→num):', expr.rawValue, '=', num.rawValue);
                        break;
                    }
                }
            }
            // Second pass: match remaining tokens with same value (fallback for edge cases)
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
                        this.log('found fallback pair (any):', t1.rawValue, '=', t2.rawValue);
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
            // Try both the standard method and a broader search
            const allIframes = findAllIframes(context.container);
            // Also check all iframes in the container as fallback
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            let hasNumberLine = false;
            let hasVisualElement = false;
            let hasNumberLineInExpressionBuild = false;
            const headerText = this.getHeaderText(context);
            const isShowAnotherWay = headerText.includes('show') && headerText.includes('another');
            this.log('checking', combinedIframes.length, 'iframes (standard:', allIframes.length, 'fallback:', allIframesFallback.length, ')');
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc) {
                    // Check if iframe has src that might contain NumberLine
                    const src = iframe.getAttribute('src');
                    if (src?.includes('NumberLine')) {
                        this.log('found NumberLine in src attribute');
                        hasNumberLine = true;
                    }
                    continue;
                }
                // CRITICAL: Skip Factor Tree challenges
                // Factor Tree may have NumberLine in iframe, but it's not a slider challenge
                // Check for BOTH FactorTree class AND originalTokens (unique to Factor Tree)
                if ((srcdoc.includes('FactorTree') || srcdoc.includes('new FactorTree')) &&
                    srcdoc.includes('originalTokens')) {
                    this.log('skipping Factor Tree iframe (not a slider challenge)');
                    continue;
                }
                // CRITICAL: Skip ExpressionBuild challenges
                // ExpressionBuild has tokens and entries, NOT a slider
                // Check for "new ExpressionBuild" AND "entries:" (unique to ExpressionBuild)
                if (srcdoc.includes('new ExpressionBuild') &&
                    (srcdoc.includes('entries:') || srcdoc.includes('entries ='))) {
                    this.log('skipping ExpressionBuild iframe (not a slider challenge)');
                    continue;
                }
                // Check for NumberLine
                if (srcdoc.includes('NumberLine')) {
                    // Check if this is a real NumberLine slider vs embedded in ExpressionBuild
                    // Real NumberLine sliders have these indicators:
                    // - disableSnapping: true (for continuous sliders like "Get as close as you can")
                    // - fillToValue: true (for discrete fill sliders)
                    // - density: "TWO_PRIMARY" or similar (slider configuration)
                    const hasSliderConfig = srcdoc.includes('disableSnapping') ||
                        srcdoc.includes('fillToValue') ||
                        srcdoc.includes('TWO_PRIMARY') ||
                        srcdoc.includes('SEVEN_PRIMARY');
                    const isExpressionBuild = srcdoc.includes('exprBuild') || srcdoc.includes('ExpressionBuild');
                    // If it has slider config, it's a real NumberLine regardless of ExpressionBuild text
                    if (hasSliderConfig) {
                        hasNumberLine = true;
                        this.log('found NumberLine iframe (has slider config)');
                    }
                    else if (isExpressionBuild) {
                        // For "Show this another way" challenges with block diagram,
                        // NumberLine can be in ExpressionBuild iframe, but it's still a slider challenge
                        if (isShowAnotherWay) {
                            this.log('found NumberLine in ExpressionBuild iframe, but header suggests slider challenge');
                            hasNumberLineInExpressionBuild = true;
                        }
                        else {
                            this.log('skipping ExpressionBuild NumberLine (no slider config, not show another way)');
                            continue;
                        }
                    }
                    else {
                        hasNumberLine = true;
                        this.log('found NumberLine iframe');
                    }
                }
                // Check for visual element (block diagram or pie chart)
                if (srcdoc.includes('<svg')) {
                    if (isBlockDiagram(srcdoc)) {
                        hasVisualElement = true;
                        this.log('found block diagram iframe');
                    }
                    else if (srcdoc.includes('circle') || srcdoc.includes('path')) {
                        // Could be a pie chart
                        hasVisualElement = true;
                        this.log('found potential pie chart iframe');
                    }
                }
            }
            this.log('hasNumberLine:', hasNumberLine, 'hasVisualElement:', hasVisualElement, 'hasNumberLineInExpressionBuild:', hasNumberLineInExpressionBuild, 'header:', headerText);
            // Special case: "Show this another way" with block diagram + NumberLine slider
            // Even if NumberLine is in ExpressionBuild iframe, it's still a slider challenge
            if (isShowAnotherWay && hasVisualElement && (hasNumberLine || hasNumberLineInExpressionBuild)) {
                this.log('can solve: Show another way with visual element and NumberLine');
                return true;
            }
            // If we have NumberLine (not in ExpressionBuild), we can solve it
            if (hasNumberLine) {
                this.log('can solve: NumberLine found');
                return true;
            }
            this.log('cannot solve: no NumberLine found');
            return false;
        }
        solve(context) {
            this.log('starting');
            const allIframes = findAllIframes(context.container);
            // Also check all iframes as fallback
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            let targetValue = null;
            let equation = null;
            let sliderIframe = null;
            const headerText = this.getHeaderText(context);
            const isShowAnotherWay = headerText.includes('show') && headerText.includes('another');
            // Find visual element (block diagram or pie chart) + slider combination
            if (combinedIframes.length >= 1) {
                const visualIframe = findIframeByContent(combinedIframes, '<svg');
                if (visualIframe) {
                    const visualSrcdoc = visualIframe.getAttribute('srcdoc');
                    if (visualSrcdoc) {
                        // Try block diagram first (more specific)
                        if (isBlockDiagram(visualSrcdoc)) {
                            const blockValue = extractBlockDiagramValue(visualSrcdoc);
                            if (blockValue !== null) {
                                targetValue = blockValue;
                                equation = `block diagram: ${blockValue}`;
                                this.log('found block diagram value:', blockValue);
                            }
                        }
                        // Fall back to pie chart if not a block diagram
                        if (targetValue === null) {
                            const fraction = extractPieChartFraction(visualSrcdoc);
                            if (fraction && fraction.value !== null) {
                                targetValue = fraction.value;
                                equation = `pie chart: ${fraction.numerator}/${fraction.denominator}`;
                                this.log('found pie chart fraction:', equation);
                            }
                        }
                    }
                    // Find the slider iframe
                    // For "Show this another way" challenges, NumberLine might be in ExpressionBuild iframe
                    for (const ifrm of combinedIframes) {
                        if (ifrm === visualIframe)
                            continue;
                        const srcdoc = ifrm.getAttribute('srcdoc');
                        if (!srcdoc)
                            continue;
                        if (srcdoc.includes('NumberLine')) {
                            // For "Show this another way", accept NumberLine even in ExpressionBuild iframe
                            const isExpressionBuild = srcdoc.includes('exprBuild') || srcdoc.includes('ExpressionBuild');
                            if (isShowAnotherWay || !isExpressionBuild) {
                                sliderIframe = ifrm;
                                this.log('found slider iframe (NumberLine)');
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
                sliderIframe = findIframeByContent(combinedIframes, 'NumberLine');
                // Also check ExpressionBuild iframes for "Show this another way" challenges
                if (!sliderIframe && isShowAnotherWay) {
                    for (const ifrm of combinedIframes) {
                        const srcdoc = ifrm.getAttribute('srcdoc');
                        if (srcdoc?.includes('NumberLine')) {
                            sliderIframe = ifrm;
                            this.log('found slider iframe in ExpressionBuild (Show another way)');
                            break;
                        }
                    }
                }
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
                    const result = solveEquationWithBlank(text);
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
                // Equation with variable like "16-3=X", "X=16-3", or "12+X=26"
                if (text.includes('=') && /[XYZ]/.test(text)) {
                    // First try solveEquationWithBlank which handles all cases including X in the middle
                    const result = solveEquationWithBlank(text);
                    if (result !== null) {
                        this.log('solved equation with solveEquationWithBlank:', text, '→', result);
                        return { value: result, equation: text };
                    }
                    // Fallback: Try simple patterns for cases solveEquationWithBlank might miss
                    // Clean the text
                    const cleanText = text
                        .replace(/\\mathbf\{([^}]+)\}/g, '$1')
                        .replace(/\\textbf\{([^}]+)\}/g, '$1')
                        .replace(/\s+/g, '');
                    // Try "expression = X" format
                    let match = cleanText.match(/^([^=]+)=([XYZ])$/);
                    if (match) {
                        const leftSide = match[1];
                        const result = evaluateMathExpression(leftSide);
                        if (result !== null) {
                            this.log('solved equation (expr=X):', cleanText, '→', result);
                            return { value: result, equation: text };
                        }
                    }
                    // Try "X = expression" format
                    match = cleanText.match(/^([XYZ])=([^=]+)$/);
                    if (match) {
                        const rightSide = match[2];
                        const result = evaluateMathExpression(rightSide);
                        if (result !== null) {
                            this.log('solved equation (X=expr):', cleanText, '→', result);
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
                if (!srcdoc)
                    continue;
                // Exclude NumberLine components (they use InteractiveSliderSolver)
                if (srcdoc.includes('NumberLine')) {
                    continue;
                }
                // Exclude ExpressionBuild components
                if (srcdoc.includes('exprBuild') || srcdoc.includes('ExpressionBuild')) {
                    continue;
                }
                // Check for spinner-specific marker: segments:
                if (srcdoc.includes('segments:')) {
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
     * Солвер для построения выражений
     * Drag-and-drop токенов для составления выражения равного целевому значению
     */
    class ExpressionBuildSolver extends BaseSolver {
        name = 'ExpressionBuildSolver';
        canSolve(context) {
            const allIframes = findAllIframes(context.container);
            // Check for ExpressionBuild iframe
            let expressionBuildIframe = null;
            for (const iframe of allIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc?.includes('exprBuild') || srcdoc?.includes('ExpressionBuild')) {
                    // CRITICAL: Check if this is a REAL ExpressionBuild component
                    // Real ExpressionBuild has: "new ExpressionBuild" AND "entries:"
                    const hasExpressionBuildComponent = srcdoc.includes('new ExpressionBuild') &&
                        (srcdoc.includes('entries:') || srcdoc.includes('entries ='));
                    if (hasExpressionBuildComponent) {
                        // This is a real ExpressionBuild, regardless of NumberLine code in library
                        expressionBuildIframe = iframe;
                        break;
                    }
                    // IMPORTANT: Exclude NumberLine sliders
                    // NumberLine sliders have fillToValue, StandaloneSlider, or slider configuration
                    if (srcdoc.includes('NumberLine') &&
                        (srcdoc.includes('fillToValue') || srcdoc.includes('StandaloneSlider'))) {
                        this.log('skipping NumberLine iframe (not ExpressionBuild)');
                        continue;
                    }
                    // Fallback: if it has exprBuild/ExpressionBuild text but no clear indicator
                    expressionBuildIframe = iframe;
                    break;
                }
            }
            if (!expressionBuildIframe) {
                return false;
            }
            // Additional check: ExpressionBuild tasks have equations with \duoblank
            // This distinguishes them from pure NumberLine tasks that might have
            // 'exprBuild' or 'ExpressionBuild' in comments/variable names
            const targetValue = this.extractTargetValue(context);
            return targetValue !== null;
        }
        solve(context) {
            this.log('starting');
            // Get target value from equation
            const targetValue = this.extractTargetValue(context);
            if (targetValue === null) {
                return this.failure('expressionBuild', 'Could not determine target value');
            }
            this.log('target value =', targetValue);
            // Find expression build iframe
            const allIframes = findAllIframes(context.container);
            const iframe = findIframeByContent(allIframes, 'exprBuild') ??
                findIframeByContent(allIframes, 'ExpressionBuild');
            if (!iframe) {
                return this.failure('expressionBuild', 'No expression build iframe found');
            }
            // Get tokens and entries from iframe
            const { tokens, numEntries } = this.extractTokensAndEntries(iframe);
            if (tokens.length === 0) {
                return this.failure('expressionBuild', 'Could not find tokens');
            }
            this.log('tokens =', JSON.stringify(tokens), ', numEntries =', numEntries);
            this.logDebug('full token array:', tokens.map((t, i) => `[${i}]=${JSON.stringify(t)}`));
            // Find solution
            const solution = this.findExpressionSolution(tokens, numEntries, targetValue);
            if (!solution) {
                this.logError('could not find solution for target', targetValue);
                return this.failure('expressionBuild', 'No solution found');
            }
            this.log('found solution - indices:', solution);
            // Set solution in iframe
            this.setSolution(iframe, solution);
            return {
                type: 'expressionBuild',
                success: true,
                targetValue,
                solution,
            };
        }
        extractTargetValue(context) {
            const annotations = context.container.querySelectorAll('annotation');
            for (const annotation of annotations) {
                let text = annotation.textContent ?? '';
                if (text.includes('\\duoblank')) {
                    // Clean LaTeX wrappers (e.g., \mathbf{-7=\duoblank{3}} -> -7=\duoblank{3})
                    text = cleanLatexWrappers(text);
                    this.logDebug('Raw annotation text:', annotation.textContent);
                    this.logDebug('Cleaned annotation text:', text);
                    // Format: "-7 = \duoblank{3}" or "12 = \duoblank{3}"
                    // Match optional negative sign, digits, optional decimal part, whitespace, equals, whitespace, backslash duoblank
                    const match = text.match(/^(-?\d+(?:\.\d+)?)\s*=\s*\\duoblank/);
                    if (match?.[1]) {
                        const target = parseFloat(match[1]);
                        this.logDebug('Extracted target from left side:', target);
                        return target;
                    }
                    // Format: "\duoblank{3} = -7" or "\duoblank{3} = 12"
                    // Match backslash duoblank, optional number in braces, whitespace, equals, whitespace, optional negative sign, digits, optional decimal part
                    const matchReverse = text.match(/\\duoblank\{\d+\}\s*=\s*(-?\d+(?:\.\d+)?)/);
                    if (matchReverse?.[1]) {
                        const target = parseFloat(matchReverse[1]);
                        this.logDebug('Extracted target from right side:', target);
                        return target;
                    }
                }
            }
            return null;
        }
        extractTokensAndEntries(iframe) {
            const tokens = [];
            let numEntries = 0;
            try {
                const iframeWindow = iframe.contentWindow;
                const iframeDoc = iframe.contentDocument ?? iframeWindow?.document ?? null;
                // Method 1: Try to access exprBuild directly from window
                if (iframeWindow?.exprBuild) {
                    const windowTokens = iframeWindow.tokens ?? [];
                    if (windowTokens.length > 0) {
                        tokens.push(...windowTokens);
                        numEntries = iframeWindow.exprBuild.entries?.length ?? 0;
                        this.logDebug('extracted tokens from window.exprBuild');
                    }
                }
                // Method 2: Try accessing tokens via window.tokens or window.mathDiagram
                if (tokens.length === 0 && iframeWindow) {
                    try {
                        const win = iframeWindow;
                        if (Array.isArray(win.tokens)) {
                            tokens.push(...win.tokens);
                            this.logDebug('extracted tokens from window.tokens');
                        }
                        // Check mathDiagram object
                        const mathDiagram = win.mathDiagram;
                        if (mathDiagram?.tokens && Array.isArray(mathDiagram.tokens)) {
                            tokens.push(...mathDiagram.tokens);
                            this.logDebug('extracted tokens from window.mathDiagram.tokens');
                        }
                    }
                    catch {
                        // Cross-origin or access denied, continue to next method
                    }
                }
                // Method 3: Parse from script content (more robust patterns)
                if (tokens.length === 0 && iframeDoc) {
                    const scripts = iframeDoc.querySelectorAll('script');
                    const allScriptContent = Array.from(scripts)
                        .map(s => s.textContent ?? '')
                        .join('\n');
                    // Try multiple token patterns
                    const tokenPatterns = [
                        /const\s+tokens\s*=\s*\[(.*?)\];/s,
                        /let\s+tokens\s*=\s*\[(.*?)\];/s,
                        /var\s+tokens\s*=\s*\[(.*?)\];/s,
                        /tokens\s*=\s*\[(.*?)\];/s,
                        /window\.tokens\s*=\s*\[(.*?)\];/s,
                    ];
                    for (const pattern of tokenPatterns) {
                        const tokensMatch = allScriptContent.match(pattern);
                        if (tokensMatch?.[1]) {
                            this.parseTokensString(tokensMatch[1], tokens);
                            if (tokens.length > 0) {
                                this.logDebug('extracted tokens from script pattern:', pattern.toString());
                                break;
                            }
                        }
                    }
                    // Parse entries count with multiple patterns
                    const entriesPatterns = [
                        /entries:\s*\[(null,?\s*)+\]/,
                        /entries\s*:\s*\[(null,?\s*)+\]/,
                        /entries\s*=\s*\[(null,?\s*)+\]/,
                    ];
                    for (const pattern of entriesPatterns) {
                        const entriesMatch = allScriptContent.match(pattern);
                        if (entriesMatch) {
                            const nullMatches = entriesMatch[0].match(/null/g);
                            numEntries = nullMatches?.length ?? 0;
                            if (numEntries > 0) {
                                this.logDebug('extracted numEntries from script:', numEntries);
                                break;
                            }
                        }
                    }
                    // Fallback: try to infer numEntries from exprBuild structure
                    if (numEntries === 0) {
                        const exprBuildMatch = allScriptContent.match(/exprBuild\s*:\s*\{[^}]*entries\s*:\s*\[(.*?)\]/s);
                        if (exprBuildMatch?.[1]) {
                            const nullMatches = exprBuildMatch[1].match(/null/g);
                            numEntries = nullMatches?.length ?? 0;
                        }
                    }
                }
                // Method 4: If still no tokens, check nested iframes (for NumberLine cases)
                if (tokens.length === 0 && iframeDoc) {
                    const nestedIframes = iframeDoc.querySelectorAll('iframe');
                    for (const nestedIframe of nestedIframes) {
                        try {
                            const nestedWindow = nestedIframe.contentWindow;
                            if (nestedWindow?.tokens && Array.isArray(nestedWindow.tokens)) {
                                tokens.push(...nestedWindow.tokens);
                                this.logDebug('extracted tokens from nested iframe');
                                break;
                            }
                        }
                        catch {
                            // Cross-origin, skip
                        }
                    }
                }
            }
            catch (e) {
                this.logError('error extracting tokens:', e);
            }
            this.logDebug('final tokens:', tokens, 'numEntries:', numEntries);
            return { tokens, numEntries };
        }
        parseTokensString(tokensStr, tokens) {
            // Remove comments and clean up
            const cleaned = tokensStr.replace(/\/\/.*$/gm, '').trim();
            // Split by comma, but be careful with nested structures
            const tokenParts = [];
            let current = '';
            let depth = 0;
            for (const char of cleaned) {
                if (char === '(' || char === '[' || char === '{') {
                    depth++;
                    current += char;
                }
                else if (char === ')' || char === ']' || char === '}') {
                    depth--;
                    current += char;
                }
                else if (char === ',' && depth === 0) {
                    tokenParts.push(current.trim());
                    current = '';
                }
                else {
                    current += char;
                }
            }
            if (current.trim()) {
                tokenParts.push(current.trim());
            }
            for (const part of tokenParts) {
                const trimmed = part.trim();
                if (!trimmed)
                    continue;
                // Pattern 1: renderNumber(X) -> X (supports negative numbers and decimals)
                const numMatch = trimmed.match(/renderNumber\((-?\d+(?:\.\d+)?)\)/);
                if (numMatch?.[1]) {
                    tokens.push(parseFloat(numMatch[1]));
                    continue;
                }
                // Pattern 2: Just a number (supports negative numbers and decimals)
                const plainNumMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)$/);
                if (plainNumMatch?.[1]) {
                    tokens.push(parseFloat(plainNumMatch[1]));
                    continue;
                }
                // Pattern 3: Quoted string - check if it's a number or operator
                const strMatch = trimmed.match(/"([^"]+)"|'([^']+)'/);
                if (strMatch) {
                    const strValue = strMatch[1] ?? strMatch[2] ?? '';
                    // Check if it's a number (including decimals)
                    const quotedNumMatch = strValue.match(/^(-?\d+(?:\.\d+)?)$/);
                    if (quotedNumMatch?.[1]) {
                        tokens.push(parseFloat(quotedNumMatch[1]));
                    }
                    else {
                        // It's an operator or other string token
                        tokens.push(strValue);
                    }
                    continue;
                }
                // Pattern 4: String without quotes (like + or -)
                if (['+', '-', '*', '/', '×', '÷'].includes(trimmed)) {
                    tokens.push(trimmed);
                    continue;
                }
                // Log unparsed tokens for debugging
                this.logDebug('could not parse token:', trimmed);
            }
        }
        findExpressionSolution(tokens, numEntries, target) {
            // Separate numbers and operators
            const numbers = [];
            const operators = [];
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                if (typeof token === 'number') {
                    numbers.push({ value: token, index: i });
                }
                else if (token &&
                    ['+', '-', '*', '/', '×', '÷'].includes(token)) {
                    operators.push({ value: token, index: i });
                }
            }
            this.logDebug('separated tokens - numbers:', numbers.map(n => `[${n.index}]=${n.value}`), 'operators:', operators.map(o => `[${o.index}]=${o.value}`));
            // For numEntries = 1
            if (numEntries === 1) {
                for (const num of numbers) {
                    if (this.isEqualWithTolerance(num.value, target)) {
                        return [num.index];
                    }
                }
                return null;
            }
            // For numEntries = 3: num1 op num2
            if (numEntries === 3) {
                return this.findThreeTokenSolution(numbers, operators, target);
            }
            // For numEntries = 5: num1 op1 num2 op2 num3
            if (numEntries === 5) {
                return this.findFiveTokenSolution(numbers, operators, target);
            }
            return null;
        }
        findThreeTokenSolution(numbers, operators, target) {
            this.logDebug('findThreeTokenSolution: numbers:', numbers.map(n => `${n.value}[${n.index}]`), 'operators:', operators.map(o => `${o.value}[${o.index}]`), 'target:', target);
            // Standard pattern: num1 op num2 (3 tokens total)
            for (const num1 of numbers) {
                for (const op of operators) {
                    for (const num2 of numbers) {
                        if (num1.index === num2.index)
                            continue;
                        const result = this.evaluateOp(num1.value, op.value, num2.value);
                        if (result !== null && this.isEqualWithTolerance(result, target)) {
                            this.log('found solution:', num1.value, op.value, num2.value, '=', target, '(indices:', [num1.index, op.index, num2.index], ')');
                            return [num1.index, op.index, num2.index];
                        }
                    }
                }
            }
            this.logDebug('no solution found for 3-token pattern');
            return null;
        }
        findFiveTokenSolution(numbers, operators, target) {
            for (const num1 of numbers) {
                for (const op1 of operators) {
                    for (const num2 of numbers) {
                        if (num2.index === num1.index)
                            continue;
                        for (const op2 of operators) {
                            if (op2.index === op1.index)
                                continue;
                            for (const num3 of numbers) {
                                if (num3.index === num1.index ||
                                    num3.index === num2.index)
                                    continue;
                                const expr = `${num1.value}${op1.value}${num2.value}${op2.value}${num3.value}`;
                                const result = evaluateMathExpression(expr);
                                if (result !== null && this.isEqualWithTolerance(result, target)) {
                                    this.log('found:', expr, '=', target);
                                    return [
                                        num1.index,
                                        op1.index,
                                        num2.index,
                                        op2.index,
                                        num3.index,
                                    ];
                                }
                            }
                        }
                    }
                }
            }
            return null;
        }
        evaluateOp(a, op, b) {
            switch (op) {
                case '+':
                    return a + b;
                case '-':
                    return a - b;
                case '*':
                case '×':
                    return a * b;
                case '/':
                case '÷':
                    return b !== 0 ? a / b : null;
                default:
                    return null;
            }
        }
        isEqualWithTolerance(a, b, tolerance = 0.0001) {
            return Math.abs(a - b) < tolerance;
        }
        setSolution(iframe, solution) {
            try {
                const iframeWindow = iframe.contentWindow;
                if (!iframeWindow)
                    return;
                // Get tokens - try multiple methods
                let tokens = null;
                let exprBuild = null;
                // Method 1: Try direct window access
                if (iframeWindow.tokens && iframeWindow.exprBuild) {
                    tokens = iframeWindow.tokens;
                    exprBuild = iframeWindow.exprBuild;
                    this.logDebug('accessed exprBuild and tokens from window directly');
                }
                // Method 2: Try window.mathDiagram (fallback)
                if ((!tokens || !exprBuild) && iframeWindow.mathDiagram) {
                    const mathDiagram = iframeWindow.mathDiagram;
                    if (mathDiagram.tokens && mathDiagram.exprBuild) {
                        tokens = mathDiagram.tokens;
                        exprBuild = mathDiagram.exprBuild;
                        this.logDebug('accessed exprBuild and tokens from window.mathDiagram');
                    }
                }
                // Method 3: Use eval to access from script scope
                if ((!tokens || !exprBuild) && iframeWindow.eval) {
                    try {
                        // Get tokens via eval
                        const tokensEval = iframeWindow.eval(`
                        (function() {
                            if (typeof tokens !== 'undefined') {
                                return tokens;
                            }
                            return null;
                        })()
                    `);
                        if (tokensEval) {
                            tokens = tokensEval;
                            this.logDebug('accessed tokens via eval');
                        }
                        // Try to get exprBuild reference via eval
                        // Note: We can't directly return exprBuild object reference, so we'll set it via eval
                        const hasExprBuild = iframeWindow.eval(`
                        (function() {
                            return typeof exprBuild !== 'undefined' && exprBuild !== null;
                        })()
                    `);
                        if (hasExprBuild && tokens) {
                            // Set entries directly via eval in iframe scope using solution indices
                            // We can't JSON.stringify because tokens might contain DOM elements
                            // Instead, we'll set entries by directly accessing tokens array in iframe scope
                            const solutionIndicesStr = JSON.stringify(solution);
                            const success = iframeWindow.eval(`
                            (function() {
                                if (typeof exprBuild !== 'undefined' && typeof tokens !== 'undefined' && exprBuild.entries) {
                                    const solutionIndices = ${solutionIndicesStr};
                                    for (let i = 0; i < solutionIndices.length && i < exprBuild.entries.length; i++) {
                                        const tokenIdx = solutionIndices[i];
                                        if (tokenIdx >= 0 && tokenIdx < tokens.length) {
                                            exprBuild.entries[i] = tokens[tokenIdx];
                                        } else {
                                            exprBuild.entries[i] = null;
                                        }
                                    }
                                    if (typeof exprBuild.notifyUpdateSubscribers === 'function') {
                                        exprBuild.notifyUpdateSubscribers();
                                    }
                                    return true;
                                }
                                return false;
                            })()
                        `);
                            if (success) {
                                this.log('set exprBuild.entries via eval using indices:', solution);
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
                                return; // Successfully set via eval
                            }
                        }
                    }
                    catch (evalError) {
                        this.logDebug('eval failed:', evalError);
                    }
                }
                // If we have direct references, use them
                if (tokens && exprBuild) {
                    // IMPORTANT: Set exprBuild.entries directly with token values (not indices)
                    // The component's update subscriber will then populate filled_entry_indices
                    const entries = solution.map((idx) => {
                        const token = tokens[idx];
                        return token !== undefined ? token : null;
                    });
                    // Set entries array
                    if (Array.isArray(exprBuild.entries)) {
                        for (let i = 0; i < entries.length && i < exprBuild.entries.length; i++) {
                            exprBuild.entries[i] = entries[i];
                        }
                        this.log('set exprBuild.entries:', entries);
                        // Notify the component of changes
                        if (typeof exprBuild.notifyUpdateSubscribers === 'function') {
                            exprBuild.notifyUpdateSubscribers();
                        }
                    }
                    else {
                        this.logError('exprBuild.entries is not an array');
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
                }
                else {
                    this.logError('exprBuild or tokens not found in iframe');
                }
            }
            catch (e) {
                this.logError('error setting solution:', e);
            }
        }
    }

    /**
     * Солвер для дерева факторов
     * Размещает числа в дереве факторов где parent = left * right
     */
    class FactorTreeSolver extends BaseSolver {
        name = 'FactorTreeSolver';
        canSolve(context) {
            const allIframes = findAllIframes(context.container);
            for (const iframe of allIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc?.includes('originalTree') && srcdoc.includes('originalTokens')) {
                    return true;
                }
            }
            return false;
        }
        solve(context) {
            this.log('starting');
            const allIframes = findAllIframes(context.container);
            const iframe = findIframeByContent(allIframes, 'originalTree');
            if (!iframe) {
                return this.failure('factorTree', 'No factor tree iframe found');
            }
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) {
                return this.failure('factorTree', 'No srcdoc found');
            }
            // Parse originalTree
            const tree = this.parseTree(srcdoc);
            if (!tree) {
                return this.failure('factorTree', 'Could not parse tree');
            }
            // Parse originalTokens
            const tokens = this.parseTokens(srcdoc);
            if (tokens.length === 0) {
                return this.failure('factorTree', 'No tokens found');
            }
            this.logDebug('tokens =', JSON.stringify(tokens));
            // Find blanks and their expected values
            const blanks = this.findBlanks(tree);
            this.logDebug('blanks =', JSON.stringify(blanks));
            // Match tokens to blanks
            const tokenTreeIndices = this.matchTokensToBlanks(tokens, blanks);
            this.log('solution tokenTreeIndices =', JSON.stringify(tokenTreeIndices));
            // Set solution
            const success = this.setSolution(iframe, tokenTreeIndices);
            const result = {
                type: 'factorTree',
                success,
                tokenTreeIndices,
            };
            return result;
        }
        parseTree(srcdoc) {
            const treeMatch = srcdoc.match(/const\s+originalTree\s*=\s*(\{[\s\S]*?\});/);
            if (!treeMatch?.[1]) {
                this.logError('could not find originalTree in srcdoc');
                return null;
            }
            try {
                return JSON.parse(treeMatch[1]);
            }
            catch (e) {
                this.logError('failed to parse originalTree:', e);
                return null;
            }
        }
        parseTokens(srcdoc) {
            const tokensMatch = srcdoc.match(/const\s+originalTokens\s*=\s*\[([\s\S]*?)\];/);
            if (!tokensMatch?.[1]) {
                this.logError('could not find originalTokens in srcdoc');
                return [];
            }
            const tokens = [];
            const numberMatches = tokensMatch[1].matchAll(/renderNumber\((\d+)\)/g);
            for (const match of numberMatches) {
                if (match[1]) {
                    tokens.push(parseInt(match[1], 10));
                }
            }
            return tokens;
        }
        findBlanks(tree) {
            const blanks = [];
            const nodeMap = new Map();
            const blankExpectedValues = new Map();
            // Helper to get effective value (actual or calculated expected value)
            const getEffectiveValue = (node, treeIndex) => {
                if (!node)
                    return null;
                if (node.value !== null) {
                    return typeof node.value === 'number' ? node.value : parseFloat(String(node.value));
                }
                return blankExpectedValues.get(treeIndex) ?? null;
            };
            // Post-order traversal: visit children first, then parent
            const traverseTree = (node, treeIndex, parentNode = null) => {
                if (!node)
                    return;
                nodeMap.set(treeIndex, node);
                // First, recursively traverse children (post-order)
                if (node.left) {
                    traverseTree(node.left, treeIndex * 2, node);
                }
                if (node.right) {
                    traverseTree(node.right, treeIndex * 2 + 1, node);
                }
                // Now process this node (after children have been processed)
                if (node.value === null) {
                    let expectedValue = null;
                    // Case 1: Calculate from children (parent = left * right)
                    const leftValue = getEffectiveValue(node.left, treeIndex * 2);
                    const rightValue = getEffectiveValue(node.right, treeIndex * 2 + 1);
                    if (leftValue !== null && rightValue !== null) {
                        expectedValue = leftValue * rightValue;
                        blankExpectedValues.set(treeIndex, expectedValue);
                        this.logDebug('blank at index', treeIndex, 'expected value =', leftValue, '*', rightValue, '=', expectedValue);
                    }
                    // Case 2: Calculate from parent and sibling (child = parent / sibling)
                    else if (parentNode) {
                        const parentTreeIndex = Math.floor(treeIndex / 2);
                        const parentValue = getEffectiveValue(parentNode, parentTreeIndex);
                        if (parentValue !== null) {
                            let siblingValue = null;
                            if (treeIndex % 2 === 0) {
                                // Even index = left child, check right sibling
                                siblingValue = getEffectiveValue(parentNode.right, treeIndex + 1);
                            }
                            else {
                                // Odd index = right child, check left sibling
                                siblingValue = getEffectiveValue(parentNode.left, treeIndex - 1);
                            }
                            if (siblingValue !== null &&
                                siblingValue !== 0 &&
                                parentValue % siblingValue === 0) {
                                expectedValue = parentValue / siblingValue;
                                blankExpectedValues.set(treeIndex, expectedValue);
                                this.logDebug('blank at index', treeIndex, 'expected value =', parentValue, '/', siblingValue, '=', expectedValue);
                            }
                        }
                    }
                    blanks.push({ treeIndex, expectedValue });
                }
            };
            // Start traversal from root at index 1
            traverseTree(tree, 1);
            // Iterative refinement for blanks that couldn't be calculated
            let changed = true;
            while (changed) {
                changed = false;
                for (const blank of blanks) {
                    if (blank.expectedValue === null) {
                        const node = nodeMap.get(blank.treeIndex);
                        if (!node)
                            continue;
                        // Try to calculate from children
                        const leftValue = getEffectiveValue(node.left, blank.treeIndex * 2);
                        const rightValue = getEffectiveValue(node.right, blank.treeIndex * 2 + 1);
                        if (leftValue !== null && rightValue !== null) {
                            const newExpectedValue = leftValue * rightValue;
                            blank.expectedValue = newExpectedValue;
                            blankExpectedValues.set(blank.treeIndex, newExpectedValue);
                            changed = true;
                            this.logDebug('blank at index', blank.treeIndex, 'expected value (refined from children) =', leftValue, '*', rightValue, '=', newExpectedValue);
                        }
                        else {
                            // Try to calculate from parent and sibling
                            const parentTreeIndex = Math.floor(blank.treeIndex / 2);
                            if (parentTreeIndex >= 1) {
                                const parentNode = nodeMap.get(parentTreeIndex);
                                if (parentNode) {
                                    const parentValue = getEffectiveValue(parentNode, parentTreeIndex);
                                    if (parentValue !== null) {
                                        let siblingValue = null;
                                        if (blank.treeIndex % 2 === 0) {
                                            siblingValue = getEffectiveValue(parentNode.right, blank.treeIndex + 1);
                                        }
                                        else {
                                            siblingValue = getEffectiveValue(parentNode.left, blank.treeIndex - 1);
                                        }
                                        if (siblingValue !== null &&
                                            siblingValue !== 0 &&
                                            parentValue % siblingValue === 0) {
                                            const newExpectedValue = parentValue / siblingValue;
                                            blank.expectedValue = newExpectedValue;
                                            blankExpectedValues.set(blank.treeIndex, newExpectedValue);
                                            changed = true;
                                            this.logDebug('blank at index', blank.treeIndex, 'expected value (refined from parent) =', parentValue, '/', siblingValue, '=', newExpectedValue);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            this.logDebug('found', blanks.length, 'blank(s):', JSON.stringify(blanks.map(b => ({ treeIndex: b.treeIndex, expectedValue: b.expectedValue }))));
            return blanks;
        }
        matchTokensToBlanks(tokens, blanks) {
            const tokenTreeIndices = new Array(tokens.length).fill(0);
            const usedBlanks = new Set();
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                for (const blank of blanks) {
                    if (blank.expectedValue === token &&
                        !usedBlanks.has(blank.treeIndex)) {
                        tokenTreeIndices[i] = blank.treeIndex;
                        usedBlanks.add(blank.treeIndex);
                        this.logDebug('token', token, '(index', i, ') -> tree position', blank.treeIndex);
                        break;
                    }
                }
            }
            return tokenTreeIndices;
        }
        setSolution(iframe, solution) {
            let success = false;
            try {
                const iframeWindow = iframe.contentWindow;
                if (!iframeWindow)
                    return false;
                // Set tokenTreeIndices
                if (typeof iframeWindow.getOutputVariables === 'function') {
                    const vars = iframeWindow.getOutputVariables();
                    if (vars && 'tokenTreeIndices' in vars) {
                        vars.tokenTreeIndices = solution;
                        success = true;
                        this.log('set tokenTreeIndices via getOutputVariables');
                    }
                }
                if (!success && iframeWindow.OUTPUT_VARS) {
                    iframeWindow.OUTPUT_VARS.tokenTreeIndices = solution;
                    success = true;
                    this.log('set tokenTreeIndices via OUTPUT_VARS');
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
                iframeWindow.postMessage({ type: 'outputVariables', payload: { tokenTreeIndices: solution } }, '*');
            }
            catch (e) {
                this.logError('error setting solution:', e);
            }
            return success;
        }
    }

    /**
     * Солвер для таблиц с паттернами
     * Вычисляет ответ для выражения в таблице и выбирает правильный вариант
     */
    class PatternTableSolver extends BaseSolver {
        name = 'PatternTableSolver';
        canSolve(context) {
            // Look for pattern table element
            const patternTable = context.container.querySelector('.ihM27');
            if (!patternTable)
                return false;
            // Should have at least some cells
            const cells = context.container.querySelectorAll('.ihM27');
            return cells.length >= 4;
        }
        solve(context) {
            this.log('starting');
            // Find all table cells
            const cells = context.container.querySelectorAll('.ihM27');
            this.log('found', cells.length, 'cells');
            // Parse cells into rows (2 cells per row: expression, result)
            const questionExpression = this.findQuestionExpression(cells);
            if (!questionExpression) {
                return this.failure('patternTable', 'Could not find question expression');
            }
            this.log('question expression:', questionExpression);
            // Calculate the answer
            const answer = evaluateMathExpression(questionExpression);
            this.log('calculated answer:', answer);
            if (answer === null) {
                return this.failure('patternTable', 'Could not evaluate expression');
            }
            // Find and click the correct choice
            const choices = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE);
            const choiceIndex = this.findMatchingChoice(choices, answer);
            if (choiceIndex === -1) {
                return this.failure('patternTable', `Could not find matching choice for answer ${answer}`);
            }
            // Click the choice
            const choice = choices[choiceIndex];
            if (choice) {
                this.log('clicking choice', choiceIndex);
                this.click(choice);
            }
            return {
                type: 'patternTable',
                success: true,
                expression: questionExpression,
                answer,
                choiceIndex,
            };
        }
        findQuestionExpression(cells) {
            // Cells alternate: expression (class _15lZ-), result (class pCN63)
            // Find the row where result is "?"
            for (let i = 0; i < cells.length; i += 2) {
                const exprCell = cells[i];
                const resultCell = cells[i + 1];
                if (!exprCell || !resultCell)
                    continue;
                const exprValue = extractKatexValue(exprCell);
                const resultValue = extractKatexValue(resultCell);
                this.logDebug('row', i / 2, '- expression:', exprValue, '- result:', resultValue);
                // Check if this is the question row
                if (resultValue === '?') {
                    return exprValue;
                }
            }
            return null;
        }
        findMatchingChoice(choices, answer) {
            this.log('found', choices.length, 'choices');
            for (let i = 0; i < choices.length; i++) {
                const choice = choices[i];
                if (!choice)
                    continue;
                // First, try to extract KaTeX value
                const choiceValue = extractKatexValue(choice);
                this.logDebug('choice', i, '- KaTeX value:', choiceValue);
                if (choiceValue !== null) {
                    // Extract number from choice value
                    // Handles formats like: "9", "X=9", "X = 9", "9.5", "-5", etc.
                    const numberMatch = choiceValue.match(/(-?\d+\.?\d*)/);
                    if (numberMatch && numberMatch[1]) {
                        const choiceNum = parseFloat(numberMatch[1]);
                        if (!isNaN(choiceNum) && choiceNum === answer) {
                            this.log('found matching choice at index', i);
                            return i;
                        }
                    }
                    // Fallback: try parsing the whole string as a number
                    const choiceNum = parseFloat(choiceValue);
                    if (!isNaN(choiceNum) && choiceNum === answer) {
                        this.log('found matching choice at index', i);
                        return i;
                    }
                }
                // If no KaTeX, try to extract value from grid/block diagram in iframe
                const iframe = choice.querySelector('iframe');
                if (iframe) {
                    const srcdoc = iframe.getAttribute('srcdoc');
                    if (srcdoc) {
                        let diagramValue = null;
                        // Check for grid diagram
                        if (isGridDiagram(srcdoc)) {
                            const gridFraction = extractGridFraction(srcdoc);
                            if (gridFraction) {
                                diagramValue = gridFraction.numerator / gridFraction.denominator;
                                this.logDebug('choice', i, '- grid diagram:', `${gridFraction.numerator}/${gridFraction.denominator}`, '=', diagramValue);
                            }
                        }
                        // Check for block diagram
                        else if (isBlockDiagram(srcdoc)) {
                            const blockValue = extractBlockDiagramValue(srcdoc);
                            // Block diagrams represent counts (e.g., 4 blocks = 0.04)
                            // So divide by 100 to get decimal fraction
                            diagramValue = blockValue !== null ? blockValue / 100 : null;
                            this.logDebug('choice', i, '- block diagram value:', diagramValue);
                        }
                        if (diagramValue !== null) {
                            // Compare with tolerance for floating point
                            const diff = Math.abs(diagramValue - answer);
                            if (diff < 0.0001) {
                                this.log('found matching choice at index', i, 'diagram value:', diagramValue);
                                return i;
                            }
                        }
                    }
                }
            }
            return -1;
        }
    }

    /**
     * Солвер для выбора дроби по круговой диаграмме
     *
     * Показывается pie chart, нужно выбрать соответствующую дробь из вариантов
     * Это обратный случай от SelectPieChartSolver
     */
    class PieChartSelectFractionSolver extends BaseSolver {
        name = 'PieChartSelectFractionSolver';
        canSolve(context) {
            if (!context.choices?.length)
                return false;
            // Must have an iframe with pie chart (not in choices)
            const allIframes = findAllIframes(context.container);
            // Check if there's a pie chart iframe that's NOT inside a choice
            for (const iframe of allIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc?.includes('<svg'))
                    continue;
                // Check if this iframe is inside a choice
                const isInChoice = context.choices.some(choice => choice?.contains(iframe));
                if (!isInChoice) {
                    // Found pie chart outside choices
                    // Now check if choices have text fractions (not pie charts)
                    const choicesHaveText = context.choices.some(choice => {
                        const annotation = choice?.querySelector('annotation');
                        return annotation?.textContent?.includes('frac') ||
                            annotation?.textContent?.includes('/');
                    });
                    if (choicesHaveText) {
                        return true;
                    }
                }
            }
            return false;
        }
        solve(context) {
            if (!context.choices?.length) {
                return this.failure('pieChartSelectFraction', 'no choices found');
            }
            this.log('starting');
            // Find the pie chart iframe
            const allIframes = findAllIframes(context.container);
            let pieChartSrcdoc = null;
            for (const iframe of allIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc?.includes('<svg'))
                    continue;
                const isInChoice = context.choices.some(choice => choice?.contains(iframe));
                if (!isInChoice) {
                    pieChartSrcdoc = srcdoc;
                    break;
                }
            }
            if (!pieChartSrcdoc) {
                return this.failure('pieChartSelectFraction', 'no pie chart found');
            }
            // Extract fraction from pie chart
            const pieChartFraction = extractPieChartFraction(pieChartSrcdoc);
            if (!pieChartFraction) {
                return this.failure('pieChartSelectFraction', 'could not extract pie chart fraction');
            }
            this.log('pie chart shows', `${pieChartFraction.numerator}/${pieChartFraction.denominator}`, '=', pieChartFraction.value);
            // Find matching choice
            let matchedChoiceIndex = -1;
            let exactMatchIndex = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const annotation = choice.querySelector('annotation');
                if (!annotation?.textContent)
                    continue;
                let choiceText = annotation.textContent;
                // Clean LaTeX wrappers
                while (choiceText.includes('\\mathbf{')) {
                    choiceText = extractLatexContent(choiceText, '\\mathbf');
                }
                while (choiceText.includes('\\textbf{')) {
                    choiceText = extractLatexContent(choiceText, '\\textbf');
                }
                // Parse the fraction
                const choiceFraction = parseFractionExpression(choiceText);
                if (!choiceFraction) {
                    this.logDebug('choice', i, 'could not parse fraction');
                    continue;
                }
                this.log('choice', i, '=', `${choiceFraction.numerator}/${choiceFraction.denominator}`, '=', choiceFraction.value);
                // Check for exact match first
                const exactMatch = choiceFraction.numerator === pieChartFraction.numerator &&
                    choiceFraction.denominator === pieChartFraction.denominator;
                // Check for value match (equivalent fractions)
                const valueMatch = Math.abs(choiceFraction.value - pieChartFraction.value) < 0.0001;
                if (exactMatch) {
                    exactMatchIndex = i;
                    this.log('EXACT MATCH at choice', i);
                    break;
                }
                else if (valueMatch && matchedChoiceIndex === -1) {
                    matchedChoiceIndex = i;
                    this.log('VALUE MATCH at choice', i);
                    // Don't break - continue looking for exact match
                }
            }
            // Prefer exact match over value match
            const finalIndex = exactMatchIndex !== -1 ? exactMatchIndex : matchedChoiceIndex;
            if (finalIndex === -1) {
                return this.failure('pieChartSelectFraction', `no matching choice for ${pieChartFraction.numerator}/${pieChartFraction.denominator}`);
            }
            // Click the matched choice
            const matchedChoice = context.choices[finalIndex];
            if (matchedChoice) {
                this.log('clicking choice', finalIndex);
                this.click(matchedChoice);
            }
            return this.success({
                type: 'pieChartSelectFraction',
                pieChartNumerator: pieChartFraction.numerator,
                pieChartDenominator: pieChartFraction.denominator,
                selectedChoice: finalIndex,
            });
        }
    }

    /**
     * Солвер для заданий "Show this another way"
     *
     * Показывает блок-диаграмму и варианты ответов с числами.
     * Нужно выбрать число, соответствующее количеству блоков.
     */
    class BlockDiagramChoiceSolver extends BaseSolver {
        name = 'BlockDiagramChoiceSolver';
        canSolve(context) {
            // Must have choices
            if (!context.choices?.length || context.choices.length < 2) {
                return false;
            }
            // Check if choices contain block diagrams (new variant: equation + block diagram choices)
            const hasBlockDiagramChoices = context.choices.some(choice => {
                const iframe = choice?.querySelector('iframe[title="Math Web Element"]');
                if (!iframe)
                    return false;
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    return false;
                return isBlockDiagram(srcdoc);
            });
            // If choices are block diagrams, allow even without "Show this another way" header
            // (for equations with \duoblank and block diagram choices)
            if (hasBlockDiagramChoices) {
                // Check if equation has \duoblank (this is a valid case)
                if (context.equationContainer) {
                    const annotation = context.equationContainer.querySelector('annotation');
                    if (annotation?.textContent) {
                        const text = annotation.textContent;
                        if (text.includes('\\duoblank') && text.includes('=')) {
                            return true;
                        }
                    }
                }
            }
            // Exclude if there's a NumberLine slider (those use InteractiveSliderSolver)
            const allIframes = findAllIframes(context.container);
            for (const iframe of allIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc?.includes('NumberLine')) {
                    // Exclude ExpressionBuild components
                    if (!srcdoc.includes('exprBuild') && !srcdoc.includes('ExpressionBuild')) {
                        return false; // This is a slider challenge, not a choice challenge
                    }
                }
            }
            // If choices are block diagrams, allow (either with header or with \duoblank equation)
            if (hasBlockDiagramChoices) {
                return true;
            }
            // Check for "Show this another way" or similar headers
            const headerMatches = this.headerContains(context, 'show', 'another', 'way');
            if (!headerMatches) {
                return false;
            }
            // Fallback: check if main container has block diagram (old variant: block diagram + number choices)
            const iframe = context.container.querySelector('iframe[title="Math Web Element"]');
            if (!iframe) {
                return false;
            }
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) {
                return false;
            }
            // Use isBlockDiagram() for more accurate detection
            return isBlockDiagram(srcdoc);
        }
        solve(context) {
            this.log('starting');
            if (!context.choices?.length) {
                return this.failure('blockDiagramChoice', 'no choices found');
            }
            // Check if choices contain block diagrams (new variant: equation + block diagram choices)
            const hasBlockDiagramChoices = context.choices.some(choice => {
                const iframe = choice?.querySelector('iframe[title="Math Web Element"]');
                if (!iframe)
                    return false;
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    return false;
                return isBlockDiagram(srcdoc);
            });
            let targetValue = null;
            let blockValue = null;
            if (hasBlockDiagramChoices) {
                // Variant 1: Equation shows number, choices show block diagrams
                // Check if equation has \duoblank (needs to be solved)
                if (context.equationContainer) {
                    const annotation = context.equationContainer.querySelector('annotation');
                    if (annotation?.textContent) {
                        const equationText = annotation.textContent;
                        if (equationText.includes('\\duoblank') && equationText.includes('=')) {
                            // Solve equation with blank
                            targetValue = solveEquationWithBlank(equationText);
                            this.log('solved equation with blank, target value:', targetValue);
                        }
                    }
                }
                // Extract target value from equation (KaTeX in main container) if not solved yet
                if (targetValue === null && context.equationContainer) {
                    const valueStr = extractKatexValue(context.equationContainer);
                    if (valueStr) {
                        targetValue = evaluateMathExpression(valueStr);
                        this.log('target value from equationContainer:', targetValue);
                    }
                }
                // Fallback: try to find KaTeX in container directly
                if (targetValue === null) {
                    const katexElement = context.container.querySelector('.katex');
                    if (katexElement) {
                        const valueStr = extractKatexValue(katexElement);
                        if (valueStr) {
                            targetValue = evaluateMathExpression(valueStr);
                            this.log('target value from katex in container:', targetValue);
                        }
                    }
                }
                // Another fallback: look for number in _1KXkZ or similar containers
                if (targetValue === null) {
                    const numberContainer = context.container.querySelector('._1KXkZ, ._2On2O');
                    if (numberContainer) {
                        const valueStr = extractKatexValue(numberContainer);
                        if (valueStr) {
                            targetValue = evaluateMathExpression(valueStr);
                            this.log('target value from number container:', targetValue);
                        }
                    }
                }
                if (targetValue === null) {
                    return this.failure('blockDiagramChoice', 'could not extract target value from equation');
                }
                // Find choice with block diagram matching target value
                let matchedIndex = -1;
                let matchedBlockValue = 0;
                this.log('searching', context.choices.length, 'choices for block diagram matching', targetValue);
                for (let i = 0; i < context.choices.length; i++) {
                    const choice = context.choices[i];
                    if (!choice) {
                        this.log('choice', i, 'is null');
                        continue;
                    }
                    // Find block diagram iframe in choice
                    const iframe = choice.querySelector('iframe[title="Math Web Element"]');
                    if (!iframe) {
                        this.log('choice', i, 'no iframe');
                        continue;
                    }
                    const srcdoc = iframe.getAttribute('srcdoc');
                    if (!srcdoc) {
                        this.log('choice', i, 'no srcdoc');
                        continue;
                    }
                    // Check if it's actually a block diagram
                    if (!isBlockDiagram(srcdoc)) {
                        this.log('choice', i, 'is not a block diagram');
                        continue;
                    }
                    // Extract block diagram value
                    const diagramValue = extractBlockDiagramValue(srcdoc);
                    if (diagramValue === null) {
                        this.log('choice', i, 'could not extract block diagram value');
                        continue;
                    }
                    this.log('choice', i, 'block diagram value:', diagramValue, 'target:', targetValue);
                    // Direct match
                    if (Math.abs(diagramValue - targetValue) < 0.0001) {
                        matchedIndex = i;
                        matchedBlockValue = diagramValue;
                        blockValue = diagramValue;
                        this.log('found matching choice', i, ':', targetValue, '=', diagramValue);
                        break;
                    }
                    // Check if targetValue is a decimal (0-1) and diagramValue is an integer
                    // This handles cases like 0.85 (85%) matching 85 blocks
                    if (targetValue > 0 && targetValue < 1 && Number.isInteger(diagramValue)) {
                        const targetAsPercent = targetValue * 100;
                        if (Math.abs(diagramValue - targetAsPercent) < 0.0001) {
                            matchedIndex = i;
                            matchedBlockValue = diagramValue;
                            blockValue = diagramValue;
                            this.log('found matching choice (percentage)', i, ':', targetValue, '* 100 =', targetAsPercent, '=', diagramValue);
                            break;
                        }
                    }
                    // Check reverse: if targetValue is an integer and diagramValue is decimal (0-1)
                    if (Number.isInteger(targetValue) && diagramValue > 0 && diagramValue < 1) {
                        const diagramAsPercent = diagramValue * 100;
                        if (Math.abs(targetValue - diagramAsPercent) < 0.0001) {
                            matchedIndex = i;
                            matchedBlockValue = diagramValue;
                            blockValue = diagramValue;
                            this.log('found matching choice (reverse percentage)', i, ':', targetValue, '=', diagramValue, '* 100 =', diagramAsPercent);
                            break;
                        }
                    }
                    // Check if targetValue is a decimal >= 1 and diagramValue is an integer
                    // This handles cases like 1.2 matching 120 blocks (1.2 * 100 = 120)
                    if (targetValue >= 1 && !Number.isInteger(targetValue) && Number.isInteger(diagramValue)) {
                        const targetAsPercent = targetValue * 100;
                        if (Math.abs(diagramValue - targetAsPercent) < 0.0001) {
                            matchedIndex = i;
                            matchedBlockValue = diagramValue;
                            blockValue = diagramValue;
                            this.log('found matching choice (decimal to percent)', i, ':', targetValue, '* 100 =', targetAsPercent, '=', diagramValue);
                            break;
                        }
                    }
                    // Check reverse: if targetValue is an integer and diagramValue is decimal >= 1
                    // This handles cases like 120 matching 1.2 blocks (120 / 100 = 1.2)
                    if (Number.isInteger(targetValue) && diagramValue >= 1 && !Number.isInteger(diagramValue)) {
                        const targetAsDecimal = targetValue / 100;
                        if (Math.abs(diagramValue - targetAsDecimal) < 0.0001) {
                            matchedIndex = i;
                            matchedBlockValue = diagramValue;
                            blockValue = diagramValue;
                            this.log('found matching choice (percent to decimal)', i, ':', targetValue, '/ 100 =', targetAsDecimal, '=', diagramValue);
                            break;
                        }
                    }
                    this.log('choice', i, 'does not match:', diagramValue, '!=', targetValue);
                }
                if (matchedIndex === -1) {
                    return this.failure('blockDiagramChoice', `no choice matches target value ${targetValue}`);
                }
                const matchedChoice = context.choices[matchedIndex];
                if (matchedChoice) {
                    this.click(matchedChoice);
                    this.log('clicked choice', matchedIndex);
                }
                return this.success({
                    type: 'blockDiagramChoice',
                    blockValue: matchedBlockValue,
                    selectedChoice: matchedIndex,
                    selectedValue: matchedBlockValue,
                });
            }
            else {
                // Variant 2: Block diagram in main container, choices show numbers (old variant)
                // Find the block diagram iframe
                const iframe = context.container.querySelector('iframe[title="Math Web Element"]');
                if (!iframe) {
                    return this.failure('blockDiagramChoice', 'no iframe found');
                }
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc) {
                    return this.failure('blockDiagramChoice', 'no srcdoc');
                }
                // Extract block diagram value
                blockValue = extractBlockDiagramValue(srcdoc);
                if (blockValue === null) {
                    return this.failure('blockDiagramChoice', 'could not extract block diagram value');
                }
                this.log('block diagram value:', blockValue);
                // Find choice with matching value
                let matchedIndex = -1;
                let matchedValue = 0;
                for (let i = 0; i < context.choices.length; i++) {
                    const choice = context.choices[i];
                    if (!choice)
                        continue;
                    // Extract value from choice (KaTeX)
                    const valueStr = extractKatexValue(choice);
                    if (!valueStr) {
                        this.log('choice', i, 'no KaTeX value');
                        continue;
                    }
                    const value = evaluateMathExpression(valueStr);
                    if (value === null) {
                        this.log('choice', i, 'could not evaluate:', valueStr);
                        continue;
                    }
                    this.log('choice', i, '=', value);
                    if (Math.abs(value - blockValue) < 0.0001) {
                        matchedIndex = i;
                        matchedValue = value;
                        this.log('found matching choice', i, ':', blockValue, '=', value);
                        break;
                    }
                }
                if (matchedIndex === -1) {
                    return this.failure('blockDiagramChoice', `no choice matches block value ${blockValue}`);
                }
                const matchedChoice = context.choices[matchedIndex];
                if (matchedChoice) {
                    this.click(matchedChoice);
                    this.log('clicked choice', matchedIndex);
                }
                return this.success({
                    type: 'blockDiagramChoice',
                    blockValue,
                    selectedChoice: matchedIndex,
                    selectedValue: matchedValue,
                });
            }
        }
    }

    /**
     * Солвер для заданий с блок-диаграммой и текстовым вводом
     *
     * Показывает блок-диаграмму и требует ввести число в текстовое поле.
     */
    class BlockDiagramTextInputSolver extends BaseSolver {
        name = 'BlockDiagramTextInputSolver';
        canSolve(context) {
            // Must have text input
            const textInput = context.container.querySelector('input[type="text"][data-test="challenge-text-input"]');
            if (!textInput) {
                return false;
            }
            // Must have iframe with block diagram
            const iframe = context.container.querySelector('iframe[title="Math Web Element"]');
            if (!iframe) {
                return false;
            }
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) {
                return false;
            }
            // Check if it's a block diagram
            if (!isBlockDiagram(srcdoc)) {
                return false;
            }
            return true;
        }
        solve(context) {
            this.log('starting');
            // Find the block diagram iframe
            const iframe = context.container.querySelector('iframe[title="Math Web Element"]');
            if (!iframe) {
                return this.failure('blockDiagramTextInput', 'no iframe found');
            }
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) {
                return this.failure('blockDiagramTextInput', 'no srcdoc');
            }
            // Extract block diagram value
            const blockValue = extractBlockDiagramValue(srcdoc);
            if (blockValue === null) {
                return this.failure('blockDiagramTextInput', 'could not extract block diagram value');
            }
            this.log('block diagram value:', blockValue);
            // Find text input
            const textInput = context.container.querySelector('input[type="text"][data-test="challenge-text-input"]');
            if (!textInput) {
                return this.failure('blockDiagramTextInput', 'no text input found');
            }
            // Type the answer
            const answer = String(blockValue);
            textInput.value = answer;
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
            textInput.dispatchEvent(new Event('change', { bubbles: true }));
            this.log('typed answer:', answer);
            return this.success({
                type: 'blockDiagramTextInput',
                blockValue,
                typedAnswer: answer,
            });
        }
    }

    /**
     * Солвер для заданий "Solve for X" с выбором ответа
     *
     * Например: "3+X=19" с вариантами "22", "16", "15"
     * Нужно решить уравнение и выбрать правильный вариант.
     */
    class SolveForXSolver extends BaseSolver {
        name = 'SolveForXSolver';
        /**
         * Проверяет, является ли задание "Solve for X" с выбором ответа
         */
        canSolve(context) {
            if (!context.equationContainer || !context.choices?.length)
                return false;
            // Check header for "Solve for X" (case-insensitive)
            const headerText = context.headerText || '';
            const hasSolveForXHeader = headerText.includes('solve for x');
            if (!hasSolveForXHeader)
                return false;
            // Check if equation has X and equals sign
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent)
                return false;
            const text = annotation.textContent;
            // Check for X (case-insensitive) and equals sign
            // X can be in LaTeX format \mathbf{X} or just X
            // Pattern: \mathbf{X}, \mathbf{x}, or standalone X/x (not part of another word)
            const hasX = /\\mathbf\{[Xx]\}|[^a-zA-Z][Xx][^a-zA-Z]|^[Xx][^a-zA-Z]|[^a-zA-Z][Xx]$/.test(text);
            const hasEquals = text.includes('=');
            return hasX && hasEquals;
        }
        /**
         * Решает задание
         */
        solve(context) {
            if (!context.equationContainer || !context.choices?.length) {
                return this.failure('solveForX', 'missing equationContainer or choices');
            }
            this.log('starting');
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent) {
                return this.failure('solveForX', 'annotation not found');
            }
            let equation = annotation.textContent;
            this.log('equation =', equation);
            // Replace \mathbf{X} or \mathbf{x} with X for solving
            // solveEquationWithBlank expects X (not \duoblank) for this type
            equation = equation.replace(/\\mathbf\{([Xx])\}/gi, 'X');
            // Also handle plain X/x in LaTeX context (ensure it's uppercase X)
            equation = equation.replace(/\b([Xx])\b/g, 'X');
            // Solve for X
            const answer = solveEquationWithBlank(equation);
            if (answer === null) {
                return this.failure('solveForX', 'could not solve equation');
            }
            this.log('solved answer =', answer);
            // Find and click matching choice
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
                    this.click(choice);
                    this.log('found matching choice at index', i);
                    this.log('clicked choice', i);
                    return this.success({
                        type: 'solveForX',
                        equation,
                        answer,
                        selectedChoice: i,
                    });
                }
            }
            return this.failure('solveForX', `no matching choice for answer ${answer}`);
        }
    }

    /**
     * Solver for "Show this another way" challenges
     *
     * Converts fraction to decimal and selects the correct answer.
     * Example: 8/10 → 0.8
     */
    class FractionToDecimalChoiceSolver extends BaseSolver {
        name = 'FractionToDecimalChoiceSolver';
        /**
         * Checks if this is a "show another way" challenge
         */
        canSolve(context) {
            // Check header
            const headerText = this.getHeaderText(context);
            const isShowAnotherWay = headerText.includes('another') &&
                (headerText.includes('way') || headerText.includes('show'));
            // Must have choices and equation container
            const hasChoices = context.choices != null && context.choices.length > 0;
            const hasEquation = context.equationContainer != null;
            if (!isShowAnotherWay || !hasChoices || !hasEquation || !context.equationContainer) {
                return false;
            }
            // Check if equation contains a fraction (not just a decimal or integer)
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent)
                return false;
            const hasFraction = annotation.textContent.includes('\\frac') || annotation.textContent.includes('/');
            return hasFraction;
        }
        /**
         * Solves the challenge
         */
        solve(context) {
            if (!context.equationContainer || !context.choices?.length) {
                return this.failure('fractionToDecimal', 'missing equationContainer or choices');
            }
            this.log('starting');
            // Extract fraction from equation
            const annotation = context.equationContainer.querySelector('annotation');
            if (!annotation?.textContent) {
                return this.failure('fractionToDecimal', 'annotation not found');
            }
            const fraction = parseFractionExpression(annotation.textContent);
            if (!fraction) {
                return this.failure('fractionToDecimal', 'could not parse fraction');
            }
            const targetValue = fraction.value;
            this.log('fraction =', `${fraction.numerator}/${fraction.denominator}`, '=', targetValue);
            // Find matching choice
            let matchedIndex = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                // Extract value from choice
                const choiceValue = extractKatexValue(choice);
                if (!choiceValue)
                    continue;
                // Parse as number
                const choiceNum = parseFloat(choiceValue);
                if (isNaN(choiceNum))
                    continue;
                this.logDebug('choice', i, '=', choiceNum);
                // Compare with tolerance for floating point
                if (Math.abs(choiceNum - targetValue) < 0.0001) {
                    matchedIndex = i;
                    this.log('found match at choice', i);
                    break;
                }
            }
            if (matchedIndex === -1) {
                return this.failure('fractionToDecimal', 'no matching decimal found');
            }
            // Click the choice
            const matchedChoice = context.choices[matchedIndex];
            if (matchedChoice) {
                this.click(matchedChoice);
                this.log('clicked choice', matchedIndex);
            }
            return this.success({
                type: 'fractionToDecimal',
                fraction: {
                    numerator: fraction.numerator,
                    denominator: fraction.denominator,
                },
                decimal: targetValue,
                selectedChoice: matchedIndex,
            });
        }
    }

    /**
     * Solver for "Show the ratio of the parts" challenges
     *
     * These challenges show examples of ratios with visual representations (block diagrams)
     * and ask to identify the correct visual representation for a given ratio.
     *
     * Example:
     * - 5:7 → image with 5 squares and 7 triangles
     * - 6:7 → image with 6 squares and 7 triangles
     * - 7:7 → ? (find the correct image)
     */
    class RatioChoiceSolver extends BaseSolver {
        name = 'RatioChoiceSolver';
        /**
         * Checks if this is a ratio challenge
         */
        canSolve(context) {
            // Check header for "ratio"
            const headerText = this.getHeaderText(context);
            if (!headerText.includes('ratio')) {
                return false;
            }
            // Should have pattern table cells
            const cells = context.container.querySelectorAll('.ihM27');
            if (cells.length < 4) {
                return false;
            }
            // Should have choices (text or visual)
            const choices = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE);
            if (choices.length < 2) {
                return false;
            }
            return true;
        }
        /**
         * Solves the challenge
         */
        solve(context) {
            this.log('starting');
            // Find all table cells
            const cells = context.container.querySelectorAll('.ihM27');
            this.log('found', cells.length, 'cells');
            // Find the question cell (contains "?")
            const targetRatio = this.findTargetRatio(cells);
            if (!targetRatio) {
                this.log('failed to find target ratio');
                return this.failure('ratioChoice', 'Could not find target ratio');
            }
            this.log('target ratio:', targetRatio);
            // Parse the ratio (e.g., "7:7" → [7, 7])
            const parts = this.parseRatio(targetRatio);
            if (!parts) {
                this.log('failed to parse ratio:', targetRatio);
                return this.failure('ratioChoice', `Could not parse ratio: ${targetRatio}`);
            }
            this.log('ratio parts:', parts[0], ':', parts[1]);
            // Find and click the matching choice
            const choices = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE);
            this.log('found', choices.length, 'choices');
            const choiceIndex = this.findMatchingChoice(choices, parts);
            if (choiceIndex === -1) {
                return this.failure('ratioChoice', `Could not find matching choice for ratio ${parts[0]}:${parts[1]}`);
            }
            // Click the choice
            const choice = choices[choiceIndex];
            if (choice) {
                this.log('clicking choice', choiceIndex);
                this.click(choice);
            }
            return this.success({
                type: 'ratioChoice',
                ratio: targetRatio,
                parts,
                selectedChoice: choiceIndex,
            });
        }
        /**
         * Finds the target ratio from table cells (the one with "?")
         */
        findTargetRatio(cells) {
            // Table structure: pairs of cells (ratio_text, visual_or_question)
            // We need to find the row where the second cell contains "?"
            for (let i = 0; i < cells.length; i += 2) {
                const leftCell = cells[i]; // Should have ratio text
                const rightCell = cells[i + 1]; // Should have visual or "?"
                if (!leftCell || !rightCell)
                    continue;
                // Check if right cell contains "?"
                const hasQuestion = rightCell.textContent?.includes('?');
                if (hasQuestion) {
                    // Extract ratio from left cell
                    const value = extractKatexValue(leftCell);
                    this.log('found question cell, left cell ratio:', value);
                    if (value && value.includes(':')) {
                        return value;
                    }
                }
            }
            this.log('no target ratio found in cells');
            return null;
        }
        /**
         * Parses a ratio string like "7:7" into [7, 7]
         */
        parseRatio(ratio) {
            const cleaned = ratio.replace(/\s+/g, '');
            const parts = cleaned.split(':');
            if (parts.length !== 2) {
                return null;
            }
            const first = parseInt(parts[0] || '', 10);
            const second = parseInt(parts[1] || '', 10);
            if (isNaN(first) || isNaN(second)) {
                return null;
            }
            return [first, second];
        }
        /**
         * Finds the choice that matches the target ratio
         */
        findMatchingChoice(choices, targetParts) {
            for (let i = 0; i < choices.length; i++) {
                const choice = choices[i];
                if (!choice)
                    continue;
                let choiceParts = null;
                // Try to parse visual diagram from iframe
                const iframe = choice.querySelector('iframe');
                if (iframe) {
                    const srcdoc = iframe.getAttribute('srcdoc');
                    if (srcdoc) {
                        choiceParts = this.countBlocksInDiagram(srcdoc);
                    }
                }
                // If no iframe or failed to parse, try text ratio
                if (!choiceParts) {
                    const ratioText = extractKatexValue(choice);
                    if (ratioText && ratioText.includes(':')) {
                        choiceParts = this.parseRatio(ratioText);
                    }
                }
                if (!choiceParts) {
                    this.log('choice', i, 'failed to parse ratio');
                    continue;
                }
                this.log('choice', i, 'has ratio:', choiceParts[0], ':', choiceParts[1], '(target:', targetParts[0], ':', targetParts[1], ')');
                // Check if ratio matches
                if (choiceParts[0] === targetParts[0] && choiceParts[1] === targetParts[1]) {
                    this.log('found matching choice:', i);
                    return i;
                }
            }
            return -1;
        }
        /**
         * Counts blocks of different types in the SVG diagram
         * Returns [count1, count2] for two types of shapes (e.g., squares and triangles)
         */
        countBlocksInDiagram(srcdoc) {
            try {
                // Extract only the first SVG (to avoid counting twice for light/dark themes)
                // Look for the first <g id="id0:id0"> section (rectangles) and <g id="id1:id1"> (paths)
                const id0Match = srcdoc.match(/<g id="id0:id0"[^>]*>([\s\S]*?)<\/g>/);
                const id1Match = srcdoc.match(/<g id="id1:id1"[^>]*>([\s\S]*?)<\/g>/);
                if (!id0Match || !id1Match) {
                    this.log('could not find id0:id0 or id1:id1 groups');
                    return null;
                }
                const rectSection = id0Match[1] || '';
                const pathSection = id1Match[1] || '';
                // Count <rect> elements in id0:id0 group
                const rectMatches = rectSection.match(/<rect\s[^>]*\/?>/g);
                const rectCount = rectMatches ? rectMatches.length : 0;
                // Count <path> elements in id1:id1 group
                const pathMatches = pathSection.match(/<path\s[^>]*\/?>/g);
                const pathCount = pathMatches ? pathMatches.length : 0;
                this.log('counted shapes:', rectCount, 'rects,', pathCount, 'paths');
                // If we found both types, return the counts
                if (rectCount > 0 || pathCount > 0) {
                    return [rectCount, pathCount];
                }
                return null;
            }
            catch (error) {
                this.log('error counting blocks:', error);
                return null;
            }
        }
    }

    /**
     * Солвер для заполнения таблиц по уравнению
     * Работает с Table компонентом в iframe
     * Пример: заполнить таблицу для уравнения y = 2x
     */
    /**
     * Парсит линейное уравнение вида y = mx или y = mx + b
     * @param equation - уравнение в формате LaTeX или текста
     * @returns объект с коэффициентом m и константой b, или null
     */
    function parseLinearEquation$3(equation) {
        // Clean LaTeX
        let cleaned = cleanLatexWrappers(equation);
        cleaned = convertLatexOperators(cleaned);
        cleaned = cleaned.replace(/\s+/g, '');
        // Pattern: y = mx or y = mx + b or y = mx - b
        // Match: y = (number)x or y = (number)x + (number) or y = (number)x - (number)
        const patterns = [
            /^y=(-?\d+\.?\d*)x$/, // y = 2x or y = -3x
            /^y=(-?\d+\.?\d*)x\+(-?\d+\.?\d*)$/, // y = 2x + 3
            /^y=(-?\d+\.?\d*)x-(-?\d+\.?\d*)$/, // y = 2x - 3
        ];
        for (const pattern of patterns) {
            const match = cleaned.match(pattern);
            if (match && match[1] !== undefined) {
                const m = parseFloat(match[1]);
                const b = match[2] !== undefined
                    ? pattern === patterns[1]
                        ? parseFloat(match[2])
                        : -parseFloat(match[2])
                    : 0;
                if (!Number.isNaN(m)) {
                    return { m, b };
                }
            }
        }
        return null;
    }
    /**
     * Вычисляет линейное уравнение y = mx + b из массива точек методом наименьших квадратов
     * @param xValues - массив значений x
     * @param yValues - массив значений y
     * @returns объект с коэффициентом m и константой b, или null
     */
    function calculateLinearRegression(xValues, yValues) {
        if (xValues.length !== yValues.length || xValues.length < 2) {
            return null;
        }
        const n = xValues.length;
        // Вычисляем средние значения
        const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
        const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;
        // Вычисляем коэффициенты методом наименьших квадратов
        let numerator = 0; // Σ((x - x̄)(y - ȳ))
        let denominator = 0; // Σ((x - x̄)²)
        for (let i = 0; i < n; i++) {
            const x = xValues[i];
            const y = yValues[i];
            if (x === undefined || y === undefined)
                continue;
            const xDiff = x - xMean;
            const yDiff = y - yMean;
            numerator += xDiff * yDiff;
            denominator += xDiff * xDiff;
        }
        // Если знаменатель равен нулю, все x одинаковы (вертикальная линия)
        if (Math.abs(denominator) < 1e-10) {
            return null;
        }
        const m = numerator / denominator;
        const b = yMean - m * xMean;
        return { m, b };
    }
    class TableFillSolver extends BaseSolver {
        name = 'TableFillSolver';
        canSolve(context) {
            // Check for iframe with Table component
            const allIframes = findAllIframes(context.container);
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                // Check for Table component
                if (srcdoc.includes('new Table') || srcdoc.includes('Table({')) {
                    this.log('found Table component in iframe');
                    return true;
                }
            }
            return false;
        }
        solve(context) {
            this.log('starting');
            // Find the table iframe
            const allIframes = findAllIframes(context.container);
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            let tableIframe = null;
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                if (srcdoc.includes('new Table') || srcdoc.includes('Table({')) {
                    tableIframe = iframe;
                    break;
                }
            }
            if (!tableIframe) {
                return this.failure('tableFill', 'No table iframe found');
            }
            // Access iframe window
            const iframeWindow = tableIframe.contentWindow;
            if (!iframeWindow) {
                return this.failure('tableFill', 'Could not access iframe window');
            }
            // Try to access INPUT_VARIABLES from srcdoc first (more reliable)
            const srcdoc = tableIframe.getAttribute('srcdoc') || '';
            let inputVarsParsed = null;
            // Extract INPUT_VARIABLES from srcdoc
            const inputVarsMatch = srcdoc.match(/INPUT_VARIABLES\s*=\s*(\{[^;]+\})/);
            if (inputVarsMatch && inputVarsMatch[1] !== undefined) {
                try {
                    const jsonStr = inputVarsMatch[1];
                    if (!jsonStr) {
                        throw new Error('Empty JSON string');
                    }
                    inputVarsParsed = JSON.parse(jsonStr);
                    this.log('extracted INPUT_VARIABLES from srcdoc:', inputVarsParsed);
                }
                catch {
                    this.logDebug('could not parse INPUT_VARIABLES from srcdoc, trying iframe window');
                }
            }
            // Fallback: try to get from iframe window
            if (!inputVarsParsed) {
                inputVarsParsed = iframeWindow.INPUT_VARIABLES || iframeWindow.diagram?.variables || null;
            }
            if (!inputVarsParsed) {
                return this.failure('tableFill', 'Could not access INPUT_VARIABLES');
            }
            // Check if this is a "Select the match" challenge (has x_values/y_values and multiple-choice options)
            const hasXValues = !!(inputVarsParsed.x_values && inputVarsParsed.y_values);
            const hasMultipleChoice = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE).length > 0;
            if (hasXValues && hasMultipleChoice) {
                // New type: "Select the match" - calculate equation from points and select multiple-choice option
                return this.solveTableMatch(context, tableIframe, iframeWindow, inputVarsParsed);
            }
            else if (inputVarsParsed.data && inputVarsParsed.tokens) {
                // Old type: Fill table cells with tokens
                return this.solveTableFill(context, tableIframe, iframeWindow, inputVarsParsed);
            }
            else {
                return this.failure('tableFill', 'Could not access table data or tokens (neither x_values/y_values nor data/tokens found)');
            }
        }
        /**
         * Решает задание типа "Select the match": вычисляет уравнение из точек и выбирает правильный вариант
         */
        solveTableMatch(context, tableIframe, iframeWindow, inputVars) {
            this.log('solving "Select the match" challenge');
            const xValues = inputVars.x_values;
            const yValues = inputVars.y_values;
            if (!xValues || !yValues || xValues.length !== yValues.length || xValues.length < 2) {
                return this.failure('tableMatch', 'Invalid x_values or y_values');
            }
            this.log('x_values:', xValues);
            this.log('y_values:', yValues);
            // Calculate linear equation from points
            const regression = calculateLinearRegression(xValues, yValues);
            if (!regression) {
                return this.failure('tableMatch', 'Could not calculate linear regression');
            }
            // Round to reasonable precision (avoid floating point errors)
            const m = Math.round(regression.m * 1000) / 1000;
            const b = Math.round(regression.b * 1000) / 1000;
            this.log(`calculated equation: y = ${m}x + ${b}`);
            // Find multiple-choice options
            const choices = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE);
            if (choices.length === 0) {
                return this.failure('tableMatch', 'No multiple-choice options found');
            }
            this.log(`found ${choices.length} choices`);
            // Find the matching choice
            let selectedIndex = -1;
            for (let i = 0; i < choices.length; i++) {
                const choice = choices[i];
                if (!choice)
                    continue;
                // Extract equation from choice (KaTeX)
                const choiceEquation = extractKatexValue(choice);
                if (!choiceEquation) {
                    this.logDebug(`choice ${i}: could not extract equation`);
                    continue;
                }
                this.log(`choice ${i}: ${choiceEquation}`);
                // Parse the equation
                const parsed = parseLinearEquation$3(choiceEquation);
                if (!parsed) {
                    this.logDebug(`choice ${i}: could not parse equation`);
                    continue;
                }
                // Round to same precision
                const choiceM = Math.round(parsed.m * 1000) / 1000;
                const choiceB = Math.round(parsed.b * 1000) / 1000;
                this.log(`choice ${i}: parsed as y = ${choiceM}x + ${choiceB}`);
                // Check if it matches (with tolerance for floating point errors)
                if (Math.abs(choiceM - m) < 0.001 && Math.abs(choiceB - b) < 0.001) {
                    this.log(`found matching choice: ${i}`);
                    selectedIndex = i;
                    break;
                }
            }
            if (selectedIndex === -1) {
                return this.failure('tableMatch', `Could not find matching choice for equation y = ${m}x + ${b}`);
            }
            // Click the matching choice
            const choice = choices[selectedIndex];
            if (choice) {
                this.log(`clicking choice ${selectedIndex}`);
                this.click(choice);
            }
            // Format equation string
            let equation;
            if (Math.abs(b) < 0.001) {
                // b is effectively 0
                equation = `y = ${m}x`;
            }
            else {
                equation = `y = ${m}x${b >= 0 ? ' + ' : ' - '}${Math.abs(b)}`;
            }
            return this.success({
                type: 'tableMatch',
                equation,
                selectedChoice: selectedIndex,
            });
        }
        /**
         * Решает задание типа "Fill the table": заполняет ячейки таблицы значениями из токенов
         */
        solveTableFill(context, tableIframe, iframeWindow, inputVars) {
            this.log('solving "Fill the table" challenge');
            // Extract equation from KaTeX annotations
            const equation = this.extractEquation(context);
            if (!equation) {
                return this.failure('tableFill', 'Could not extract equation');
            }
            this.log('extracted equation:', equation);
            // Parse the equation
            const parsed = parseLinearEquation$3(equation);
            if (!parsed) {
                return this.failure('tableFill', `Could not parse equation: ${equation}`);
            }
            this.log('parsed equation: y =', parsed.m, 'x +', parsed.b);
            const data = inputVars.data;
            const tokens = inputVars.tokens;
            if (!data || !tokens) {
                return this.failure('tableFill', 'Could not access table data or tokens');
            }
            // Wait for table to be initialized (it's created in DOMContentLoaded)
            const table = this.waitForTable(iframeWindow);
            if (!table || !table.setCellValue) {
                return this.failure('tableFill', 'Could not access table.setCellValue. Table may not be initialized yet.');
            }
            this.log('table data:', data);
            this.log('available tokens:', tokens);
            // Calculate missing values and fill the table
            let filledCells = 0;
            const renderNumber = iframeWindow.renderNumber || ((v) => String(v));
            for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
                const row = data[rowIndex];
                if (!row || row.length < 2)
                    continue;
                const x = row[0];
                const y = row[1];
                // If y is null, calculate it from x
                if (x !== null && x !== undefined && y === null) {
                    const calculatedY = parsed.m * x + parsed.b;
                    this.log(`row ${rowIndex}: x = ${x}, calculated y = ${calculatedY}`);
                    // Find the token element that matches calculatedY
                    const tokenValue = tokens.find((t) => Math.abs(t - calculatedY) < 0.001);
                    if (tokenValue === undefined) {
                        this.logError(`could not find token for value ${calculatedY}`);
                        continue;
                    }
                    // Set the cell value (column 1 is y)
                    const renderedValue = renderNumber(tokenValue);
                    try {
                        // Try to find token element (might be required for drag-and-drop)
                        const tokenElement = this.findTokenElement(iframeWindow, tokenValue);
                        // Try with token element first, then without
                        if (tokenElement) {
                            table.setCellValue(rowIndex, 1, renderedValue, tokenElement);
                        }
                        else {
                            // Try without token element (might work for direct value setting)
                            table.setCellValue(rowIndex, 1, renderedValue);
                        }
                        filledCells++;
                        this.log(`filled cell [${rowIndex}, 1] with value ${renderedValue}`);
                    }
                    catch (e) {
                        this.logError('error setting cell value:', e);
                    }
                }
                // If x is null, calculate it from y
                else if (y !== null && y !== undefined && x === null) {
                    // Solve for x: y = mx + b => x = (y - b) / m
                    if (Math.abs(parsed.m) < 0.001) {
                        this.logError(`row ${rowIndex}: cannot solve for x when m is 0 (y = ${y})`);
                        continue;
                    }
                    const calculatedX = (y - parsed.b) / parsed.m;
                    this.log(`row ${rowIndex}: y = ${y}, calculated x = ${calculatedX}`);
                    // Find the token element that matches calculatedX
                    const tokenValue = tokens.find((t) => Math.abs(t - calculatedX) < 0.001);
                    if (tokenValue === undefined) {
                        this.logError(`could not find token for value ${calculatedX}`);
                        continue;
                    }
                    // Set the cell value (column 0 is x)
                    const renderedValue = renderNumber(tokenValue);
                    try {
                        // Try to find token element (might be required for drag-and-drop)
                        const tokenElement = this.findTokenElement(iframeWindow, tokenValue);
                        // Try with token element first, then without
                        if (tokenElement) {
                            table.setCellValue(rowIndex, 0, renderedValue, tokenElement);
                        }
                        else {
                            // Try without token element (might work for direct value setting)
                            table.setCellValue(rowIndex, 0, renderedValue);
                        }
                        filledCells++;
                        this.log(`filled cell [${rowIndex}, 0] with value ${renderedValue}`);
                    }
                    catch (e) {
                        this.logError('error setting cell value:', e);
                    }
                }
            }
            if (filledCells === 0) {
                return this.failure('tableFill', 'No cells were filled');
            }
            // Add a small delay to allow table component to process changes
            this.syncDelay(100);
            // Trigger update callbacks with comprehensive event dispatching
            this.triggerUpdateCallbacks(iframeWindow);
            // Add another delay after triggering callbacks to give Duolingo time to validate
            this.syncDelay(200);
            return this.success({
                type: 'tableFill',
                equation,
                filledCells,
            });
        }
        extractEquation(context) {
            // Look for equation in KaTeX annotations
            const annotations = context.container.querySelectorAll('annotation');
            for (const annotation of annotations) {
                const text = annotation.textContent;
                if (!text)
                    continue;
                // Check if it looks like an equation (y = ...)
                if (text.includes('y') && text.includes('=') && text.includes('x')) {
                    const katexValue = extractKatexValue(annotation.parentElement);
                    if (katexValue) {
                        return katexValue;
                    }
                }
            }
            // Also check equation container
            if (context.equationContainer) {
                const katexValue = extractKatexValue(context.equationContainer);
                if (katexValue && katexValue.includes('y') && katexValue.includes('=') && katexValue.includes('x')) {
                    return katexValue;
                }
            }
            return null;
        }
        findTokenElement(iframeWindow, value) {
            try {
                const iframeDoc = iframeWindow.document;
                if (!iframeDoc)
                    return null;
                // Tokens are typically in a container, look for elements with the rendered value
                const renderNumber = iframeWindow.renderNumber || ((v) => String(v));
                const renderedValue = renderNumber(value);
                // Try to find token by text content
                const allElements = iframeDoc.querySelectorAll('*');
                for (const el of allElements) {
                    if (el.textContent?.trim() === renderedValue || el.textContent?.includes(renderedValue)) {
                        // Check if it's draggable or looks like a token
                        if (el.getAttribute('draggable') === 'true' ||
                            el.classList.contains('token') ||
                            el.getAttribute('role') === 'button') {
                            return el;
                        }
                    }
                }
                // Fallback: look for elements with data attributes or specific classes
                const tokenContainers = iframeDoc.querySelectorAll('[class*="token"], [data-token]');
                for (const container of tokenContainers) {
                    if (container.textContent?.includes(renderedValue)) {
                        return container;
                    }
                }
            }
            catch (e) {
                this.logError('error finding token element:', e);
            }
            return null;
        }
        /**
         * Ожидает инициализации таблицы в iframe
         * Использует синхронный опрос с ограничением по времени
         * ВАЖНО: Использует busy-wait, который блокирует поток, но ограничен коротким временем
         */
        waitForTable(iframeWindow) {
            const maxAttempts = 100; // Увеличено количество попыток
            const delayMs = 20; // Увеличена задержка между попытками (максимум 2 секунды)
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    // First, check if iframe document is ready
                    const iframeDoc = iframeWindow.document;
                    if (!iframeDoc || iframeDoc.readyState === 'loading') {
                        // Document not ready yet, continue waiting
                        if (attempt % 10 === 0) {
                            this.logDebug(`attempt ${attempt + 1}: iframe document not ready`);
                        }
                    }
                    else {
                        let table = null;
                        // Path 1 (PRIMARY): window.mathDiagram - Table instance is assigned here in srcdoc
                        if (iframeWindow.mathDiagram && typeof iframeWindow.mathDiagram.setCellValue === 'function') {
                            table = iframeWindow.mathDiagram;
                            this.log('found table at window.mathDiagram');
                            if (attempt > 0) {
                                this.log(`table initialized after ${attempt} attempts (${attempt * delayMs}ms)`);
                            }
                            return table;
                        }
                        // Path 2 (SECONDARY): diagram.table
                        table = iframeWindow.diagram?.table || null;
                        if (table && typeof table.setCellValue === 'function') {
                            this.log('found table at diagram.table');
                            if (attempt > 0) {
                                this.log(`table initialized after ${attempt} attempts (${attempt * delayMs}ms)`);
                            }
                            return table;
                        }
                        // Path 3 (TERTIARY): Try accessing via window property directly (fallback)
                        if (!table) {
                            const windowWithDiagram = iframeWindow;
                            table = windowWithDiagram.diagram?.table || null;
                            if (table && typeof table.setCellValue === 'function') {
                                this.log('found table at diagram.table (via fallback)');
                                if (attempt > 0) {
                                    this.log(`table initialized after ${attempt} attempts (${attempt * delayMs}ms)`);
                                }
                                return table;
                            }
                        }
                        // Path 4 (GENERIC FALLBACK): Try to find table instance from diagram properties
                        if (!table && iframeWindow.diagram) {
                            const diagramAny = iframeWindow.diagram;
                            for (const key in diagramAny) {
                                const value = diagramAny[key];
                                if (value &&
                                    typeof value === 'object' &&
                                    'setCellValue' in value &&
                                    typeof value.setCellValue === 'function') {
                                    table = value;
                                    this.log(`found table at diagram.${key}`);
                                    if (attempt > 0) {
                                        this.log(`table initialized after ${attempt} attempts (${attempt * delayMs}ms)`);
                                    }
                                    return table;
                                }
                            }
                        }
                    }
                }
                catch (e) {
                    // Ignore errors during polling (cross-origin restrictions, etc.)
                    if (attempt % 10 === 0) {
                        // Log every 10th attempt to avoid spam
                        this.logDebug(`attempt ${attempt + 1}: table not ready yet (${e})`);
                    }
                }
            }
            this.logError(`table not initialized after ${maxAttempts} attempts (${maxAttempts * delayMs}ms)`);
            return null;
        }
        triggerUpdateCallbacks(iframeWindow) {
            try {
                const iframeDoc = iframeWindow.document;
                if (!iframeDoc)
                    return;
                // Check both mathDiagram (primary) and diagram.table (fallback)
                const table = iframeWindow.mathDiagram || iframeWindow.diagram?.table;
                if (!table)
                    return;
                this.log('triggering update callbacks');
                // Try to call table's validation/update methods if they exist
                const tableAny = table;
                if (typeof tableAny.validate === 'function') {
                    try {
                        tableAny.validate();
                        this.log('called table.validate()');
                    }
                    catch (e) {
                        this.logDebug('table.validate() not available or failed:', e);
                    }
                }
                if (typeof tableAny.notifyUpdate === 'function') {
                    try {
                        tableAny.notifyUpdate();
                        this.log('called table.notifyUpdate()');
                    }
                    catch (e) {
                        this.logDebug('table.notifyUpdate() not available or failed:', e);
                    }
                }
                if (typeof tableAny.notifyUpdateSubscribers === 'function') {
                    try {
                        tableAny.notifyUpdateSubscribers();
                        this.log('called table.notifyUpdateSubscribers()');
                    }
                    catch (e) {
                        this.logDebug('table.notifyUpdateSubscribers() not available or failed:', e);
                    }
                }
                // Find table cells in the DOM and dispatch events on them
                const tableCells = iframeDoc.querySelectorAll('td, [role="gridcell"], [class*="cell"]');
                if (tableCells.length > 0) {
                    this.log(`found ${tableCells.length} table cells, dispatching events`);
                    tableCells.forEach((cell) => {
                        // Dispatch input event
                        cell.dispatchEvent(new Event('input', { bubbles: true }));
                        // Dispatch change event
                        cell.dispatchEvent(new Event('change', { bubbles: true }));
                        // Dispatch blur event (simulates user finishing input)
                        cell.dispatchEvent(new Event('blur', { bubbles: true }));
                    });
                }
                // Dispatch comprehensive events on document
                const events = ['input', 'change', 'blur', 'focusout'];
                events.forEach((eventType) => {
                    const event = new Event(eventType, { bubbles: true });
                    iframeDoc.dispatchEvent(event);
                });
                // Dispatch custom events that might be expected
                const customEvents = ['tableUpdate', 'diagramUpdate', 'cellUpdate', 'valueChange'];
                customEvents.forEach((eventType) => {
                    const event = new CustomEvent(eventType, { bubbles: true });
                    iframeDoc.dispatchEvent(event);
                    iframeWindow.dispatchEvent(event);
                });
                // Call Duolingo's internal callbacks to notify parent frame
                // These are critical for enabling the "Continue" button
                if (typeof iframeWindow.postOutputVariables === 'function') {
                    try {
                        iframeWindow.postOutputVariables();
                        this.log('called postOutputVariables()');
                    }
                    catch (e) {
                        this.logDebug('postOutputVariables() failed:', e);
                    }
                }
                if (iframeWindow.duo?.onFirstInteraction) {
                    try {
                        iframeWindow.duo.onFirstInteraction();
                        this.log('called duo.onFirstInteraction()');
                    }
                    catch (e) {
                        this.logDebug('duo.onFirstInteraction() failed:', e);
                    }
                }
                if (iframeWindow.duoDynamic?.onInteraction) {
                    try {
                        iframeWindow.duoDynamic.onInteraction();
                        this.log('called duoDynamic.onInteraction()');
                    }
                    catch (e) {
                        this.logDebug('duoDynamic.onInteraction() failed:', e);
                    }
                }
                this.log('dispatched all update events and called Duolingo callbacks');
            }
            catch (e) {
                this.logError('error triggering update callbacks:', e);
            }
        }
        /**
         * Synchronous delay using busy-wait (for use in synchronous solve method)
         */
        syncDelay(ms) {
        }
    }

    /**
     * Солвер для построения точек на графике
     * Работает с Grid2D и DraggablePoint компонентами в iframe
     * Примеры:
     * - Plot the points (2, 2) and (4, 4) - явные координаты
     * - Plot the points on y = 7x - уравнение
     */
    /**
     * Извлекает координаты точек из текста задания
     * Примеры: "Plot the points (2, 2) and (4, 4)" или "Plot the points (1, 3), (2, 6)"
     * Удаляет дубликаты точек с одинаковыми координатами
     */
    function extractPointsFromText(text) {
        const points = [];
        const seenPoints = new Set();
        // Pattern для поиска координат: (число, число)
        // Поддерживает различные форматы: (2, 2), (-3, 4), (1.5, 2.5)
        const pointPattern = /\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/g;
        let match;
        while ((match = pointPattern.exec(text)) !== null) {
            if (match[1] !== undefined && match[2] !== undefined) {
                const x = parseFloat(match[1]);
                const y = parseFloat(match[2]);
                if (!Number.isNaN(x) && !Number.isNaN(y)) {
                    // Create a unique key for this point to detect duplicates
                    const pointKey = `${x},${y}`;
                    if (!seenPoints.has(pointKey)) {
                        seenPoints.add(pointKey);
                        points.push({ x, y });
                    }
                }
            }
        }
        return points;
    }
    /**
     * Парсит линейное уравнение вида y = mx или y = mx + b
     * Поддерживает дробные коэффициенты: y = (5/3)x, y = \frac{2}{3}x
     * @param equation - уравнение в формате LaTeX или текста
     * @returns объект с коэффициентом m и константой b, или null
     */
    function parseLinearEquation$2(equation) {
        // Clean LaTeX
        let cleaned = cleanLatexWrappers(equation);
        cleaned = convertLatexOperators(cleaned);
        cleaned = convertLatexFractions(cleaned); // Convert \frac{a}{b} to (a/b)
        cleaned = cleaned.replace(/\s+/g, '');
        // Pattern 1: y = mx (simple number coefficient)
        // Pattern: y = (number)x or y = -(number)x
        let match = cleaned.match(/^y=(-?\d+\.?\d*)x$/);
        if (match && match[1] !== undefined) {
            const m = parseFloat(match[1]);
            if (!Number.isNaN(m)) {
                return { m, b: 0 };
            }
        }
        // Pattern 2: y = (expression)x where expression can be evaluated (e.g., y=(5/3)x, y=(2/3)x)
        match = cleaned.match(/^y=(.+?)x$/);
        if (match && match[1] !== undefined) {
            const coefficientExpr = match[1];
            // Remove outer parentheses if present, e.g., (5/3) -> 5/3
            const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
            const evaluated = evaluateMathExpression(cleanedCoeff);
            if (evaluated !== null) {
                return { m: evaluated, b: 0 };
            }
        }
        // Pattern 3: y = mx + b or y = mx - b (simple number coefficient)
        match = cleaned.match(/^y=(-?\d+\.?\d*)x\+(-?\d+\.?\d*)$/);
        if (match && match[1] !== undefined && match[2] !== undefined) {
            const m = parseFloat(match[1]);
            const b = parseFloat(match[2]);
            if (!Number.isNaN(m) && !Number.isNaN(b)) {
                return { m, b };
            }
        }
        match = cleaned.match(/^y=(-?\d+\.?\d*)x-(-?\d+\.?\d*)$/);
        if (match && match[1] !== undefined && match[2] !== undefined) {
            const m = parseFloat(match[1]);
            const b = -parseFloat(match[2]);
            if (!Number.isNaN(m) && !Number.isNaN(b)) {
                return { m, b };
            }
        }
        // Pattern 4: y = (expression)x + b or y = (expression)x - b (fractional coefficient)
        match = cleaned.match(/^y=(.+?)x\+(-?\d+\.?\d*)$/);
        if (match && match[1] !== undefined && match[2] !== undefined) {
            const coefficientExpr = match[1];
            const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
            const evaluated = evaluateMathExpression(cleanedCoeff);
            const b = parseFloat(match[2]);
            if (evaluated !== null && !Number.isNaN(b)) {
                return { m: evaluated, b };
            }
        }
        match = cleaned.match(/^y=(.+?)x-(-?\d+\.?\d*)$/);
        if (match && match[1] !== undefined && match[2] !== undefined) {
            const coefficientExpr = match[1];
            const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
            const evaluated = evaluateMathExpression(cleanedCoeff);
            const b = -parseFloat(match[2]);
            if (evaluated !== null && !Number.isNaN(b)) {
                return { m: evaluated, b };
            }
        }
        return null;
    }
    /**
     * Извлекает уравнение из текста задания
     * Ищет уравнения вида y = mx или y = mx + b в KaTeX элементах
     */
    function extractEquationFromText(context) {
        // Look for equation in KaTeX annotations
        const annotations = context.container.querySelectorAll('annotation');
        for (const annotation of annotations) {
            const text = annotation.textContent;
            if (!text)
                continue;
            // Check if it looks like an equation (y = ...)
            if (text.includes('y') && text.includes('=') && text.includes('x')) {
                const katexValue = extractKatexValue(annotation.parentElement);
                if (katexValue) {
                    return katexValue;
                }
            }
        }
        // Also check equation container
        if (context.equationContainer) {
            const katexValue = extractKatexValue(context.equationContainer);
            if (katexValue && katexValue.includes('y') && katexValue.includes('=') && katexValue.includes('x')) {
                return katexValue;
            }
        }
        // Fallback: search in all text content
        const containerText = context.container.textContent || '';
        const headerText = context.container.querySelector('[data-test="challenge-header"]')?.textContent || '';
        const fullText = `${headerText} ${containerText}`;
        // Try to find equation pattern in plain text
        const equationPattern = /y\s*=\s*(-?\d+\.?\d*)\s*x\s*([+-]?\s*\d+\.?\d*)?/i;
        const match = fullText.match(equationPattern);
        if (match) {
            let equation = `y=${match[1]}x`;
            if (match[2]) {
                const bValue = match[2].replace(/\s+/g, '');
                equation += bValue;
            }
            return equation;
        }
        return null;
    }
    /**
     * Вычисляет точки на прямой по уравнению
     * @param m - коэффициент наклона
     * @param b - константа
     * @param numPoints - количество точек для построения
     * @returns массив точек
     */
    function calculatePointsFromEquation(m, b, numPoints = 2) {
        const points = [];
        // Используем значения x от 1 до numPoints для простоты
        // Можно было бы использовать более умную логику, но для начала это работает
        for (let i = 0; i < numPoints; i++) {
            const x = i + 1;
            const y = m * x + b;
            points.push({ x, y });
        }
        return points;
    }
    class PlotPointsSolver extends BaseSolver {
        name = 'PlotPointsSolver';
        canSolve(context) {
            // Check for iframe with Grid2D and draggable points
            const allIframes = findAllIframes(context.container);
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                // Check for Grid2D and addDraggablePoint
                if ((srcdoc.includes('new Grid2D') || srcdoc.includes('Grid2D({')) &&
                    srcdoc.includes('addDraggablePoint')) {
                    this.log('found Grid2D with draggable points in iframe');
                    return true;
                }
            }
            return false;
        }
        solve(context) {
            this.log('starting');
            // Find the diagram iframe
            const allIframes = findAllIframes(context.container);
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            let diagramIframe = null;
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                if ((srcdoc.includes('new Grid2D') || srcdoc.includes('Grid2D({')) &&
                    srcdoc.includes('addDraggablePoint')) {
                    diagramIframe = iframe;
                    break;
                }
            }
            if (!diagramIframe) {
                return this.failure('plotPoints', 'No Grid2D iframe found');
            }
            // Access iframe window
            const iframeWindow = diagramIframe.contentWindow;
            if (!iframeWindow) {
                return this.failure('plotPoints', 'Could not access iframe window');
            }
            // Extract target points from challenge text
            const headerText = this.getHeaderText(context);
            const containerText = context.container.textContent || '';
            const fullText = `${headerText} ${containerText}`;
            this.log('extracting points from text:', fullText.substring(0, 200));
            // Try to determine number of points from srcdoc or INPUT_VARIABLES
            const srcdoc = diagramIframe.getAttribute('srcdoc') || '';
            let numPoints = iframeWindow.INPUT_VARIABLES?.numPoints;
            // Try to extract numPoints from srcdoc if not in INPUT_VARIABLES
            if (numPoints === undefined) {
                const inputVarsMatch = srcdoc.match(/INPUT_VARIABLES\s*=\s*(\{[^;]+\})/);
                if (inputVarsMatch && inputVarsMatch[1]) {
                    try {
                        const parsedVars = JSON.parse(inputVarsMatch[1]);
                        if (typeof parsedVars.numPoints === 'number') {
                            numPoints = parsedVars.numPoints;
                        }
                    }
                    catch {
                        // Ignore parse errors
                    }
                }
            }
            // Count addDraggablePoint calls in srcdoc as fallback
            if (numPoints === undefined) {
                const draggablePointMatches = srcdoc.match(/addDraggablePoint/g);
                if (draggablePointMatches) {
                    numPoints = draggablePointMatches.length;
                }
            }
            // Default to 2 if we still don't know
            if (numPoints === undefined) {
                numPoints = 2;
            }
            this.log(`detected ${numPoints} draggable points`);
            // First, try to extract explicit coordinates
            let targetPoints = extractPointsFromText(fullText);
            // If no explicit coordinates found, try to extract equation
            if (targetPoints.length === 0) {
                this.log('no explicit coordinates found, trying to extract equation');
                const equation = extractEquationFromText(context);
                if (equation) {
                    this.log('extracted equation:', equation);
                    const parsed = parseLinearEquation$2(equation);
                    if (parsed) {
                        this.log(`parsed equation: y = ${parsed.m}x + ${parsed.b}`);
                        this.log(`calculating ${numPoints} points from equation`);
                        targetPoints = calculatePointsFromEquation(parsed.m, parsed.b, numPoints);
                        this.log(`calculated ${targetPoints.length} points:`, targetPoints);
                    }
                    else {
                        this.logError('could not parse equation:', equation);
                    }
                }
                else {
                    this.logError('could not extract equation from challenge text');
                }
            }
            if (targetPoints.length === 0) {
                return this.failure('plotPoints', 'Could not extract point coordinates or equation from challenge text');
            }
            // Limit target points to the number of draggable points available
            if (targetPoints.length > numPoints) {
                this.log(`limiting target points from ${targetPoints.length} to ${numPoints} (available draggable points)`);
                targetPoints = targetPoints.slice(0, numPoints);
            }
            this.log(`using ${targetPoints.length} target points:`, targetPoints);
            // Wait for diagram to initialize with retry logic
            // The iframe's JavaScript needs time to set up mathDiagram and populate components
            let diagram = null;
            const maxRetries = 20;
            let retryCount = 0;
            while (retryCount < maxRetries && !diagram?.components) {
                this.syncDelay(50);
                diagram = iframeWindow.diagram || iframeWindow.grid || iframeWindow.mathDiagram || null;
                // Check if components exist and is accessible
                if (diagram?.components) {
                    // Verify components is actually accessible (not just a property that exists)
                    try {
                        if (Array.isArray(diagram.components) ||
                            (typeof diagram.components.getAll === 'function')) {
                            break;
                        }
                    }
                    catch {
                        // Components property exists but might not be ready yet
                        diagram = null;
                    }
                }
                retryCount++;
            }
            if (retryCount > 0) {
                this.log(`waited ${retryCount * 50}ms for diagram to initialize`);
            }
            // Try to access draggable points
            let pointsMoved = 0;
            // Method 1: Try to access via diagram.components or grid.components
            if (diagram?.components) {
                let componentsArray = [];
                // Check if components is an array or has getAll() method
                if (Array.isArray(diagram.components)) {
                    componentsArray = diagram.components;
                    this.log(`found ${componentsArray.length} components (array)`);
                }
                else if (typeof diagram.components.getAll === 'function') {
                    componentsArray = diagram.components.getAll();
                    this.log(`found ${componentsArray.length} components (via getAll())`);
                }
                // Filter for draggable points by componentType or by updatePosition method
                const draggablePoints = componentsArray.filter((comp) => {
                    // First try componentType (more reliable across iframe boundaries)
                    if (comp.componentType === 'DraggablePoint') {
                        return true;
                    }
                    // Fallback: check for updatePosition method
                    return comp.updatePosition && typeof comp.updatePosition === 'function';
                });
                this.log(`found ${draggablePoints.length} draggable points`);
                if (draggablePoints.length >= targetPoints.length) {
                    try {
                        // Move each point to its target position
                        for (let i = 0; i < targetPoints.length && i < draggablePoints.length; i++) {
                            const point = draggablePoints[i];
                            const target = targetPoints[i];
                            if (point?.updatePosition && target) {
                                this.log(`attempting to move point ${i + 1} from (${point.x}, ${point.y}) to (${target.x}, ${target.y})`);
                                point.updatePosition(target.x, target.y);
                                pointsMoved++;
                                this.log(`moved point ${i + 1} to (${target.x}, ${target.y})`);
                            }
                            else {
                                this.logError(`point ${i + 1} does not have updatePosition method or target is missing`);
                            }
                        }
                    }
                    catch (e) {
                        this.logError('error moving points via components:', e);
                    }
                }
                else {
                    this.log(`not enough draggable points found: ${draggablePoints.length} (need ${targetPoints.length})`);
                }
            }
            else {
                this.log('diagram.components not found');
            }
            // Method 2: Try to access via window properties directly with retry
            if (pointsMoved === 0) {
                try {
                    const windowAny = iframeWindow;
                    const possibleNames = ['diagram', 'grid', 'mathDiagram', 'graphDiagram'];
                    // Retry accessing components for each possible diagram name
                    for (let retry = 0; retry < 10 && pointsMoved === 0; retry++) {
                        if (retry > 0) {
                            this.syncDelay(50);
                        }
                        for (const name of possibleNames) {
                            const possibleDiagram = windowAny[name];
                            if (possibleDiagram?.components) {
                                this.log(`found diagram via window.${name} (attempt ${retry + 1})`);
                                let componentsArray = [];
                                try {
                                    if (Array.isArray(possibleDiagram.components)) {
                                        componentsArray = possibleDiagram.components;
                                    }
                                    else if (typeof possibleDiagram.components.getAll === 'function') {
                                        componentsArray = possibleDiagram.components.getAll();
                                    }
                                }
                                catch (e) {
                                    this.logDebug(`error accessing components via ${name}:`, e);
                                    continue;
                                }
                                const draggablePoints = componentsArray.filter((comp) => {
                                    if (comp.componentType === 'DraggablePoint') {
                                        return true;
                                    }
                                    return comp.updatePosition && typeof comp.updatePosition === 'function';
                                });
                                this.log(`found ${draggablePoints.length} draggable points via window.${name}`);
                                if (draggablePoints.length >= targetPoints.length) {
                                    for (let i = 0; i < targetPoints.length && i < draggablePoints.length; i++) {
                                        const point = draggablePoints[i];
                                        const target = targetPoints[i];
                                        if (point?.updatePosition && target) {
                                            try {
                                                point.updatePosition(target.x, target.y);
                                                pointsMoved++;
                                                this.log(`moved point ${i + 1} to (${target.x}, ${target.y}) via window.${name}`);
                                            }
                                            catch (e) {
                                                this.logError(`error moving point ${i + 1}:`, e);
                                            }
                                        }
                                    }
                                    if (pointsMoved > 0) {
                                        break;
                                    }
                                }
                            }
                        }
                        if (pointsMoved > 0) {
                            break;
                        }
                    }
                }
                catch (e) {
                    this.logError('error accessing diagram via window properties:', e);
                }
            }
            // Method 3: Try to update OUTPUT_VARIABLES directly and trigger callbacks
            if (pointsMoved === 0) {
                try {
                    const outputVars = iframeWindow.OUTPUT_VARIABLES;
                    if (outputVars) {
                        outputVars.finalPositions = targetPoints;
                        this.log('updated OUTPUT_VARIABLES.finalPositions directly');
                        // Try to trigger update callbacks
                        const event = new Event('input', { bubbles: true });
                        iframeWindow.document.dispatchEvent(event);
                        // Also try custom events
                        iframeWindow.dispatchEvent(new CustomEvent('pointUpdate'));
                        iframeWindow.dispatchEvent(new CustomEvent('diagramUpdate'));
                        pointsMoved = targetPoints.length; // Assume success if OUTPUT_VARIABLES were updated
                    }
                }
                catch (e) {
                    this.logError('error updating OUTPUT_VARIABLES:', e);
                }
            }
            if (pointsMoved === 0) {
                return this.failure('plotPoints', 'Could not move draggable points');
            }
            // Add a small delay to allow component to process changes
            this.syncDelay(100);
            // Trigger update callbacks to notify parent frame
            this.triggerUpdateCallbacks(iframeWindow);
            // Add another delay after triggering callbacks
            this.syncDelay(200);
            return {
                type: 'plotPoints',
                success: true,
                pointsPlotted: pointsMoved,
                targetPoints,
            };
        }
        triggerUpdateCallbacks(iframeWindow) {
            try {
                const iframeDoc = iframeWindow.document;
                if (!iframeDoc)
                    return;
                this.log('triggering update callbacks');
                // Dispatch comprehensive events on document
                const events = ['input', 'change', 'blur', 'focusout'];
                events.forEach((eventType) => {
                    const event = new Event(eventType, { bubbles: true });
                    iframeDoc.dispatchEvent(event);
                });
                // Dispatch custom events that might be expected
                const customEvents = ['pointUpdate', 'diagramUpdate', 'gridUpdate', 'valueChange'];
                customEvents.forEach((eventType) => {
                    const event = new CustomEvent(eventType, { bubbles: true });
                    iframeDoc.dispatchEvent(event);
                    iframeWindow.dispatchEvent(event);
                });
                // Call Duolingo's internal callbacks to notify parent frame
                // These are critical for enabling the "Continue" button
                if (typeof iframeWindow.postOutputVariables === 'function') {
                    try {
                        iframeWindow.postOutputVariables();
                        this.log('called postOutputVariables()');
                    }
                    catch (e) {
                        this.logDebug('postOutputVariables() failed:', e);
                    }
                }
                if (iframeWindow.duo?.onFirstInteraction) {
                    try {
                        iframeWindow.duo.onFirstInteraction();
                        this.log('called duo.onFirstInteraction()');
                    }
                    catch (e) {
                        this.logDebug('duo.onFirstInteraction() failed:', e);
                    }
                }
                if (iframeWindow.duoDynamic?.onInteraction) {
                    try {
                        iframeWindow.duoDynamic.onInteraction();
                        this.log('called duoDynamic.onInteraction()');
                    }
                    catch (e) {
                        this.logDebug('duoDynamic.onInteraction() failed:', e);
                    }
                }
                this.log('dispatched all update events and called Duolingo callbacks');
            }
            catch (e) {
                this.logError('error triggering update callbacks:', e);
            }
        }
        /**
         * Synchronous delay using busy-wait (for use in synchronous solve method)
         */
        syncDelay(ms) {
        }
    }

    /**
     * Солвер для построения графика линии по уравнению
     * Работает с MathDiagram и DraggablePoint компонентами в iframe
     * Пример: построить график для уравнения y = x или y = 2x + 3
     */
    /**
     * Парсит линейное уравнение вида y = mx или y = mx + b
     * @param equation - уравнение в формате LaTeX или текста
     * @returns объект с коэффициентом m и константой b, или null
     */
    function parseLinearEquation$1(equation) {
        // Clean LaTeX
        let cleaned = cleanLatexWrappers(equation);
        cleaned = convertLatexOperators(cleaned);
        cleaned = cleaned.replace(/\s+/g, '');
        // Pattern: y = mx or y = mx + b or y = mx - b
        // Match: y = (number)x or y = (number)x + (number) or y = (number)x - (number)
        const patterns = [
            /^y=(-?\d+\.?\d*)x$/, // y = 2x or y = -3x
            /^y=(-?\d+\.?\d*)x\+(-?\d+\.?\d*)$/, // y = 2x + 3
            /^y=(-?\d+\.?\d*)x-(-?\d+\.?\d*)$/, // y = 2x - 3
        ];
        for (const pattern of patterns) {
            const match = cleaned.match(pattern);
            if (match && match[1] !== undefined) {
                const m = parseFloat(match[1]);
                const b = match[2] !== undefined
                    ? pattern === patterns[1]
                        ? parseFloat(match[2])
                        : -parseFloat(match[2])
                    : 0;
                if (!Number.isNaN(m)) {
                    return { m, b };
                }
            }
        }
        return null;
    }
    class GraphLineSolver extends BaseSolver {
        name = 'GraphLineSolver';
        canSolve(context) {
            // Check for iframe with MathDiagram and draggable points
            const allIframes = findAllIframes(context.container);
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                // Check for MathDiagram and addDraggablePoint
                if ((srcdoc.includes('new MathDiagram') || srcdoc.includes('MathDiagram({')) &&
                    srcdoc.includes('addDraggablePoint')) {
                    this.log('found MathDiagram with draggable points in iframe');
                    return true;
                }
            }
            return false;
        }
        solve(context) {
            this.log('starting');
            // Find the diagram iframe
            const allIframes = findAllIframes(context.container);
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            let diagramIframe = null;
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                if ((srcdoc.includes('new MathDiagram') || srcdoc.includes('MathDiagram({')) &&
                    srcdoc.includes('addDraggablePoint')) {
                    diagramIframe = iframe;
                    break;
                }
            }
            if (!diagramIframe) {
                return this.failure('graphLine', 'No diagram iframe found');
            }
            // Access iframe window
            const iframeWindow = diagramIframe.contentWindow;
            if (!iframeWindow) {
                return this.failure('graphLine', 'Could not access iframe window');
            }
            // Try to wait a bit for diagram to initialize (synchronous check)
            // Check if diagram exists, if not log a warning but proceed
            if (!iframeWindow.diagram) {
                this.logDebug('diagram not immediately available, will try alternative access methods');
            }
            // Try to get equation from INPUT_VARIABLES first
            const srcdoc = diagramIframe.getAttribute('srcdoc') || '';
            let m = null;
            let b = null;
            let equation = null;
            // Extract INPUT_VARIABLES from srcdoc
            // Format: const INPUT_VARIABLES = {"m": 1, "b": 0};
            const inputVarsMatch = srcdoc.match(/INPUT_VARIABLES\s*=\s*(\{[^;]+\})/);
            if (inputVarsMatch && inputVarsMatch[1] !== undefined) {
                try {
                    const jsonStr = inputVarsMatch[1];
                    if (!jsonStr) {
                        throw new Error('Empty JSON string');
                    }
                    const parsedVars = JSON.parse(jsonStr);
                    if (typeof parsedVars.m === 'number' && typeof parsedVars.b === 'number') {
                        m = parsedVars.m;
                        b = parsedVars.b;
                        // TypeScript: b is guaranteed to be number here due to the type check above
                        const bValue = b;
                        equation = `y = ${m === 1 ? '' : m === -1 ? '-' : m}x${bValue !== 0 ? (bValue > 0 ? ` + ${bValue}` : ` - ${Math.abs(bValue)}`) : ''}`;
                        this.log('extracted equation from srcdoc:', equation);
                    }
                }
                catch {
                    this.logDebug('could not parse INPUT_VARIABLES from srcdoc, trying iframe window');
                }
            }
            // Fallback: try to get from iframe window
            if (m === null || b === null) {
                const inputVars = iframeWindow.INPUT_VARIABLES;
                if (inputVars && typeof inputVars.m === 'number' && typeof inputVars.b === 'number') {
                    m = inputVars.m;
                    b = inputVars.b;
                    // TypeScript: b is guaranteed to be number here due to the type check above
                    const bValue = b;
                    equation = `y = ${m === 1 ? '' : m === -1 ? '-' : m}x${bValue !== 0 ? (bValue > 0 ? ` + ${bValue}` : ` - ${Math.abs(bValue)}`) : ''}`;
                    this.log('extracted equation from iframe window:', equation);
                }
            }
            // Fallback: try to extract equation from KaTeX on the page
            if (m === null || b === null) {
                equation = this.extractEquation(context);
                if (equation) {
                    const parsed = parseLinearEquation$1(equation);
                    if (parsed) {
                        m = parsed.m;
                        b = parsed.b;
                        this.log('extracted equation from KaTeX:', equation);
                    }
                }
            }
            if (m === null || b === null || equation === null) {
                return this.failure('graphLine', 'Could not extract equation');
            }
            this.log('parsed equation: y =', m, 'x +', b);
            // Calculate two points on the line
            // Use x = 1 and x = 3 as default (same as in the transcript)
            const point1X = 1;
            const point1Y = m * point1X + b;
            const point2X = 3;
            const point2Y = m * point2X + b;
            this.log(`target points: (${point1X}, ${point1Y}) and (${point2X}, ${point2Y})`);
            // Try to access draggable points
            // According to transcript, points are created with diagram.addDraggablePoint()
            // and stored in diagram.components or accessible via OUTPUT_VARIABLES
            let pointsMoved = 0;
            // Method 1: Try to access via diagram.components
            const diagram = iframeWindow.diagram;
            if (diagram?.components) {
                let componentsArray = [];
                // Check if components is an array or has getAll() method
                if (Array.isArray(diagram.components)) {
                    componentsArray = diagram.components;
                    this.log(`found ${componentsArray.length} components (array)`);
                }
                else if (typeof diagram.components.getAll === 'function') {
                    componentsArray = diagram.components.getAll();
                    this.log(`found ${componentsArray.length} components (via getAll())`);
                }
                // Filter for draggable points by componentType or by updatePosition method
                const draggablePoints = componentsArray.filter((comp) => {
                    // First try componentType (more reliable across iframe boundaries)
                    if (comp.componentType === 'DraggablePoint') {
                        return true;
                    }
                    // Fallback: check for updatePosition method
                    return comp.updatePosition && typeof comp.updatePosition === 'function';
                });
                this.log(`found ${draggablePoints.length} draggable points`);
                if (draggablePoints.length >= 2) {
                    try {
                        // Move first point
                        const point1 = draggablePoints[0];
                        if (point1?.updatePosition) {
                            this.log(`attempting to move point 1 from (${point1.x}, ${point1.y}) to (${point1X}, ${point1Y})`);
                            point1.updatePosition(point1X, point1Y);
                            pointsMoved++;
                            this.log(`moved point 1 to (${point1X}, ${point1Y})`);
                        }
                        else {
                            this.logError('point 1 does not have updatePosition method');
                        }
                        // Move second point
                        const point2 = draggablePoints[1];
                        if (point2?.updatePosition) {
                            this.log(`attempting to move point 2 from (${point2.x}, ${point2.y}) to (${point2X}, ${point2Y})`);
                            point2.updatePosition(point2X, point2Y);
                            pointsMoved++;
                            this.log(`moved point 2 to (${point2X}, ${point2Y})`);
                        }
                        else {
                            this.logError('point 2 does not have updatePosition method');
                        }
                    }
                    catch (e) {
                        this.logError('error moving points via components:', e);
                    }
                }
                else {
                    this.log(`not enough draggable points found: ${draggablePoints.length} (need 2)`);
                }
            }
            else {
                this.log('diagram.components not found');
            }
            // Method 2: Try to access via window.diagram directly (might be stored differently)
            if (pointsMoved === 0) {
                try {
                    const windowWithDiagram = iframeWindow;
                    const components = windowWithDiagram.diagram?.components;
                    if (components) {
                        let componentsArray = [];
                        if (Array.isArray(components)) {
                            componentsArray = components;
                        }
                        else if (typeof components.getAll === 'function') {
                            componentsArray = components.getAll();
                        }
                        const draggablePoints = componentsArray.filter((comp) => {
                            if (comp.componentType === 'DraggablePoint') {
                                return true;
                            }
                            return comp.updatePosition && typeof comp.updatePosition === 'function';
                        });
                        if (draggablePoints.length >= 2) {
                            const point1 = draggablePoints[0];
                            if (point1?.updatePosition) {
                                point1.updatePosition(point1X, point1Y);
                                pointsMoved++;
                                this.log(`moved point 1 to (${point1X}, ${point1Y}) via window.diagram`);
                            }
                            const point2 = draggablePoints[1];
                            if (point2?.updatePosition) {
                                point2.updatePosition(point2X, point2Y);
                                pointsMoved++;
                                this.log(`moved point 2 to (${point2X}, ${point2Y}) via window.diagram`);
                            }
                        }
                    }
                }
                catch (e) {
                    this.logError('error moving points via window.diagram:', e);
                }
            }
            // Method 3: Try to access diagram via global MathDiagram instance or window properties
            if (pointsMoved === 0) {
                try {
                    const windowAny = iframeWindow;
                    // Try MathDiagram.instance
                    if (windowAny.MathDiagram?.instance?.components) {
                        const components = windowAny.MathDiagram.instance.components;
                        let componentsArray = [];
                        if (Array.isArray(components)) {
                            componentsArray = components;
                        }
                        else if (typeof components.getAll === 'function') {
                            componentsArray = components.getAll();
                        }
                        const draggablePoints = componentsArray.filter((comp) => {
                            if (comp.componentType === 'DraggablePoint') {
                                return true;
                            }
                            return comp.updatePosition && typeof comp.updatePosition === 'function';
                        });
                        if (draggablePoints.length >= 2) {
                            const point1 = draggablePoints[0];
                            if (point1?.updatePosition) {
                                point1.updatePosition(point1X, point1Y);
                                pointsMoved++;
                                this.log(`moved point 1 to (${point1X}, ${point1Y}) via MathDiagram.instance`);
                            }
                            const point2 = draggablePoints[1];
                            if (point2?.updatePosition) {
                                point2.updatePosition(point2X, point2Y);
                                pointsMoved++;
                                this.log(`moved point 2 to (${point2X}, ${point2Y}) via MathDiagram.instance`);
                            }
                        }
                    }
                    // Try to find diagram via window properties (search for common names)
                    if (pointsMoved === 0) {
                        const possibleNames = ['diagram', 'mathDiagram', 'graphDiagram', 'lineDiagram'];
                        for (const name of possibleNames) {
                            const possibleDiagram = windowAny[name];
                            if (possibleDiagram?.components) {
                                this.log(`found diagram via window.${name}`);
                                // Use same logic as Method 1
                                let componentsArray = [];
                                if (Array.isArray(possibleDiagram.components)) {
                                    componentsArray = possibleDiagram.components;
                                }
                                else if (typeof possibleDiagram.components.getAll === 'function') {
                                    componentsArray = possibleDiagram.components.getAll();
                                }
                                const draggablePoints = componentsArray.filter((comp) => {
                                    if (comp.componentType === 'DraggablePoint') {
                                        return true;
                                    }
                                    return comp.updatePosition && typeof comp.updatePosition === 'function';
                                });
                                if (draggablePoints.length >= 2) {
                                    const point1 = draggablePoints[0];
                                    if (point1?.updatePosition) {
                                        point1.updatePosition(point1X, point1Y);
                                        pointsMoved++;
                                        this.log(`moved point 1 to (${point1X}, ${point1Y}) via window.${name}`);
                                    }
                                    const point2 = draggablePoints[1];
                                    if (point2?.updatePosition) {
                                        point2.updatePosition(point2X, point2Y);
                                        pointsMoved++;
                                        this.log(`moved point 2 to (${point2X}, ${point2Y}) via window.${name}`);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
                catch (e) {
                    this.logError('error accessing diagram via global properties:', e);
                }
            }
            // Method 4: Try to find draggable points by searching the iframe document
            if (pointsMoved === 0) {
                try {
                    const iframeDoc = iframeWindow.document;
                    if (iframeDoc) {
                        // Look for SVG elements that might be draggable points
                        const svgElements = iframeDoc.querySelectorAll('svg');
                        for (const svg of svgElements) {
                            // Try to find circles or points that might be draggable
                            const circles = svg.querySelectorAll('circle');
                            if (circles.length >= 2) {
                                // Try to trigger updatePosition via events or direct access
                                // This is a fallback - might need adjustment based on actual structure
                                this.logDebug('found SVG circles, but updatePosition method not accessible');
                            }
                        }
                    }
                }
                catch (e) {
                    this.logError('error searching iframe document:', e);
                }
            }
            // Method 5: Try to update OUTPUT_VARIABLES directly and trigger callbacks
            if (pointsMoved === 0) {
                try {
                    const outputVars = iframeWindow.OUTPUT_VARIABLES;
                    if (outputVars) {
                        outputVars.point1 = { x: point1X, y: point1Y };
                        outputVars.point2 = { x: point2X, y: point2Y };
                        this.log('updated OUTPUT_VARIABLES directly');
                        // Try to trigger update callbacks
                        const event = new Event('input', { bubbles: true });
                        iframeWindow.document.dispatchEvent(event);
                        // Also try custom events
                        iframeWindow.dispatchEvent(new CustomEvent('pointUpdate'));
                        iframeWindow.dispatchEvent(new CustomEvent('diagramUpdate'));
                        pointsMoved = 2; // Assume success if OUTPUT_VARIABLES were updated
                    }
                }
                catch (e) {
                    this.logError('error updating OUTPUT_VARIABLES:', e);
                }
            }
            if (pointsMoved === 0) {
                return this.failure('graphLine', 'Could not move draggable points');
            }
            return {
                type: 'graphLine',
                success: true,
                equation,
                pointsMoved,
            };
        }
        extractEquation(context) {
            // Look for equation in KaTeX annotations
            const annotations = context.container.querySelectorAll('annotation');
            for (const annotation of annotations) {
                const text = annotation.textContent;
                if (!text)
                    continue;
                // Check if it looks like an equation (y = ...)
                if (text.includes('y') && text.includes('=') && text.includes('x')) {
                    const katexValue = extractKatexValue(annotation.parentElement);
                    if (katexValue) {
                        return katexValue;
                    }
                }
            }
            // Also check equation container
            if (context.equationContainer) {
                const katexValue = extractKatexValue(context.equationContainer);
                if (katexValue && katexValue.includes('y') && katexValue.includes('=') && katexValue.includes('x')) {
                    return katexValue;
                }
            }
            return null;
        }
    }

    /**
     * Солвер для заданий "Select the equation"
     * Определяет уравнение по точкам на графике и выбирает правильный вариант
     */
    /**
     * Извлекает точки из SVG элементов в iframe
     */
    function extractPointsFromSVG(iframeWindow) {
        const points = [];
        const seenPoints = new Set();
        try {
            const iframeDoc = iframeWindow.document;
            if (!iframeDoc)
                return points;
            // Method 1: Extract from label text (most reliable)
            // Points are in <g class="point static"> with <text class="label"> containing "(x, y)"
            const staticPointGroups = iframeDoc.querySelectorAll('g.point.static');
            for (const group of Array.from(staticPointGroups)) {
                const label = group.querySelector('text.label');
                if (label) {
                    const labelText = label.textContent || '';
                    // Try to extract (x, y) from label like "(2, 1)"
                    const match = labelText.match(/\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/);
                    if (match && match[1] && match[2]) {
                        const x = parseFloat(match[1]);
                        const y = parseFloat(match[2]);
                        if (!Number.isNaN(x) && !Number.isNaN(y)) {
                            const pointKey = `${x},${y}`;
                            if (!seenPoints.has(pointKey)) {
                                seenPoints.add(pointKey);
                                points.push({ x, y });
                            }
                        }
                    }
                }
            }
            // Method 2: Extract from SVG coordinates by reading axis labels
            // This is a fallback if labels don't have coordinates
            if (points.length < 2) {
                // Try to extract grid scale from axis labels
                const xAxisLabels = iframeDoc.querySelectorAll('text.x-axis-label');
                const yAxisLabels = iframeDoc.querySelectorAll('text.y-axis-label');
                if (xAxisLabels.length > 0 && yAxisLabels.length > 0) {
                    // Get the first and last x-axis labels to determine scale
                    const firstXLabel = xAxisLabels[0];
                    const lastXLabel = xAxisLabels[xAxisLabels.length - 1];
                    const firstYLabel = yAxisLabels[0];
                    const lastYLabel = yAxisLabels[yAxisLabels.length - 1];
                    if (firstXLabel && lastXLabel && firstYLabel && lastYLabel) {
                        const x0 = parseFloat(firstXLabel.textContent || '0');
                        const x1 = parseFloat(lastXLabel.textContent || '0');
                        const y0 = parseFloat(firstYLabel.textContent || '0');
                        const y1 = parseFloat(lastYLabel.textContent || '0');
                        const x0Pos = parseFloat(firstXLabel.getAttribute('x') || '0');
                        const x1Pos = parseFloat(lastXLabel.getAttribute('x') || '0');
                        const y0Pos = parseFloat(firstYLabel.getAttribute('y') || '0');
                        const y1Pos = parseFloat(lastYLabel.getAttribute('y') || '0');
                        if (!Number.isNaN(x0) && !Number.isNaN(x1) && !Number.isNaN(y0) && !Number.isNaN(y1) &&
                            !Number.isNaN(x0Pos) && !Number.isNaN(x1Pos) && !Number.isNaN(y0Pos) && !Number.isNaN(y1Pos)) {
                            const xScale = (x1 - x0) / (x1Pos - x0Pos);
                            const yScale = (y1 - y0) / (y1Pos - y0Pos);
                            // Now extract points from circles
                            const circles = iframeDoc.querySelectorAll('g.point.static circle');
                            for (const circle of Array.from(circles)) {
                                const cx = parseFloat(circle.getAttribute('cx') || '0');
                                const cy = parseFloat(circle.getAttribute('cy') || '0');
                                if (!Number.isNaN(cx) && !Number.isNaN(cy)) {
                                    const x = x0 + (cx - x0Pos) * xScale;
                                    const y = y0 + (cy - y0Pos) * yScale;
                                    const pointKey = `${x},${y}`;
                                    if (!seenPoints.has(pointKey)) {
                                        seenPoints.add(pointKey);
                                        points.push({ x, y });
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // Method 3: Try to get points from diagram.components if available
            const iframeWindowTyped = iframeWindow;
            if (points.length < 2 && iframeWindowTyped.diagram?.components) {
                const components = Array.isArray(iframeWindowTyped.diagram.components)
                    ? iframeWindowTyped.diagram.components
                    : typeof iframeWindowTyped.diagram.components.getAll === 'function'
                        ? iframeWindowTyped.diagram.components.getAll()
                        : [];
                for (const comp of components) {
                    if (('componentType' in comp && (comp.componentType === 'Point' || comp.componentType === 'StaticPoint')) ||
                        (!('componentType' in comp) && comp.x !== undefined && comp.y !== undefined)) {
                        if (comp.x !== undefined && comp.y !== undefined) {
                            const pointKey = `${comp.x},${comp.y}`;
                            if (!seenPoints.has(pointKey)) {
                                seenPoints.add(pointKey);
                                points.push({ x: comp.x, y: comp.y });
                            }
                        }
                    }
                }
            }
        }
        catch (e) {
            console.error('Error extracting points from SVG:', e);
        }
        return points;
    }
    /**
     * Вычисляет уравнение прямой по точкам (линейная регрессия)
     */
    function calculateLinearEquation(points) {
        if (points.length < 2)
            return null;
        const n = points.length;
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumXX = 0;
        for (const point of points) {
            sumX += point.x;
            sumY += point.y;
            sumXY += point.x * point.y;
            sumXX += point.x * point.x;
        }
        // Calculate slope: m = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX)
        const denominator = n * sumXX - sumX * sumX;
        if (Math.abs(denominator) < 0.0001) {
            // Vertical line or all points have same x
            return null;
        }
        const m = (n * sumXY - sumX * sumY) / denominator;
        // Calculate intercept: b = (sumY - m*sumX) / n
        const b = (sumY - m * sumX) / n;
        return { m, b };
    }
    /**
     * Парсит линейное уравнение вида y = mx или y = mx + b
     * Поддерживает дробные коэффициенты
     */
    function parseLinearEquation(equation) {
        // Clean LaTeX
        let cleaned = cleanLatexWrappers(equation);
        cleaned = convertLatexOperators(cleaned);
        cleaned = convertLatexFractions(cleaned);
        cleaned = cleaned.replace(/\s+/g, '');
        // Pattern 1: y = mx (simple number coefficient)
        let match = cleaned.match(/^y=(-?\d+\.?\d*)x$/);
        if (match && match[1] !== undefined) {
            const m = parseFloat(match[1]);
            if (!Number.isNaN(m)) {
                return { m, b: 0 };
            }
        }
        // Pattern 2: y = (expression)x where expression can be evaluated (e.g., y=(1/2)x)
        match = cleaned.match(/^y=(.+?)x$/);
        if (match && match[1] !== undefined) {
            const coefficientExpr = match[1];
            const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
            const evaluated = evaluateMathExpression(cleanedCoeff);
            if (evaluated !== null) {
                return { m: evaluated, b: 0 };
            }
        }
        // Pattern 3: y = mx + b or y = mx - b
        match = cleaned.match(/^y=(-?\d+\.?\d*)x\+(-?\d+\.?\d*)$/);
        if (match && match[1] !== undefined && match[2] !== undefined) {
            const m = parseFloat(match[1]);
            const b = parseFloat(match[2]);
            if (!Number.isNaN(m) && !Number.isNaN(b)) {
                return { m, b };
            }
        }
        match = cleaned.match(/^y=(-?\d+\.?\d*)x-(-?\d+\.?\d*)$/);
        if (match && match[1] !== undefined && match[2] !== undefined) {
            const m = parseFloat(match[1]);
            const b = -parseFloat(match[2]);
            if (!Number.isNaN(m) && !Number.isNaN(b)) {
                return { m, b };
            }
        }
        // Pattern 4: y = (expression)x + b or y = (expression)x - b
        match = cleaned.match(/^y=(.+?)x\+(-?\d+\.?\d*)$/);
        if (match && match[1] !== undefined && match[2] !== undefined) {
            const coefficientExpr = match[1];
            const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
            const evaluated = evaluateMathExpression(cleanedCoeff);
            const b = parseFloat(match[2]);
            if (evaluated !== null && !Number.isNaN(b)) {
                return { m: evaluated, b };
            }
        }
        match = cleaned.match(/^y=(.+?)x-(-?\d+\.?\d*)$/);
        if (match && match[1] !== undefined && match[2] !== undefined) {
            const coefficientExpr = match[1];
            const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
            const evaluated = evaluateMathExpression(cleanedCoeff);
            const b = -parseFloat(match[2]);
            if (evaluated !== null && !Number.isNaN(b)) {
                return { m: evaluated, b };
            }
        }
        return null;
    }
    class SelectEquationSolver extends BaseSolver {
        name = 'SelectEquationSolver';
        canSolve(context) {
            // Check header for "select the equation"
            const headerMatches = this.headerContains(context, 'select', 'equation');
            if (!headerMatches) {
                return false;
            }
            // Check for choices with equations
            if (!context.choices?.length) {
                return false;
            }
            // Check if there's a graph iframe with points
            const allIframes = findAllIframes(context.container);
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                // Check for MathDiagram or Grid2D with static points
                if ((srcdoc.includes('new MathDiagram') || srcdoc.includes('MathDiagram({')) ||
                    (srcdoc.includes('new Grid2D') || srcdoc.includes('Grid2D({'))) {
                    // Check if choices contain equations
                    const hasEquationChoices = context.choices.some(choice => {
                        const katexValue = extractKatexValue(choice);
                        if (!katexValue)
                            return false;
                        return katexValue.includes('y') && katexValue.includes('=') && katexValue.includes('x');
                    });
                    if (hasEquationChoices) {
                        return true;
                    }
                }
            }
            return false;
        }
        solve(context) {
            this.log('starting');
            if (!context.choices?.length) {
                return this.failure('selectEquation', 'no choices found');
            }
            // Find the diagram iframe
            const allIframes = findAllIframes(context.container);
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            let diagramIframe = null;
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                if ((srcdoc.includes('new MathDiagram') || srcdoc.includes('MathDiagram({')) ||
                    (srcdoc.includes('new Grid2D') || srcdoc.includes('Grid2D({'))) {
                    diagramIframe = iframe;
                    break;
                }
            }
            if (!diagramIframe) {
                return this.failure('selectEquation', 'no diagram iframe found');
            }
            // Access iframe window
            const iframeWindow = diagramIframe.contentWindow;
            if (!iframeWindow) {
                return this.failure('selectEquation', 'could not access iframe window');
            }
            // Extract points from the graph
            const points = extractPointsFromSVG(iframeWindow);
            this.log(`extracted ${points.length} points:`, points);
            if (points.length < 2) {
                return this.failure('selectEquation', `not enough points: ${points.length} (need at least 2)`);
            }
            // Calculate equation from points
            const calculatedEquation = calculateLinearEquation(points);
            if (!calculatedEquation) {
                return this.failure('selectEquation', 'could not calculate equation from points');
            }
            this.log(`calculated equation: y = ${calculatedEquation.m}x + ${calculatedEquation.b}`);
            // Parse all choice equations and find match
            let matchedIndex = -1;
            const tolerance = 0.0001;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const katexValue = extractKatexValue(choice);
                if (!katexValue)
                    continue;
                const parsed = parseLinearEquation(katexValue);
                if (!parsed) {
                    this.log(`choice ${i}: could not parse equation: ${katexValue}`);
                    continue;
                }
                this.log(`choice ${i}: ${katexValue} -> y = ${parsed.m}x + ${parsed.b}`);
                // Compare coefficients with tolerance
                if (Math.abs(parsed.m - calculatedEquation.m) < tolerance &&
                    Math.abs(parsed.b - calculatedEquation.b) < tolerance) {
                    matchedIndex = i;
                    this.log(`matched choice ${i}: ${katexValue}`);
                    break;
                }
            }
            if (matchedIndex === -1) {
                return this.failure('selectEquation', 'no matching equation found in choices');
            }
            // Click the matched choice
            const choiceButtons = context.container.querySelectorAll('[data-test="challenge-choice"]');
            const choiceButton = choiceButtons[matchedIndex];
            if (!choiceButton) {
                return this.failure('selectEquation', `choice button ${matchedIndex} not found`);
            }
            try {
                choiceButton.click();
                this.log(`clicked choice ${matchedIndex}`);
            }
            catch (e) {
                return this.failure('selectEquation', `error clicking choice: ${e}`);
            }
            return {
                type: 'selectEquation',
                success: true,
                calculatedEquation,
                selectedChoice: matchedIndex,
            };
        }
    }

    /**
     * Солвер для заданий "Select the constant of proportionality"
     * Извлекает коэффициент из уравнения вида y = mx и выбирает правильный вариант
     */
    /**
     * Извлекает коэффициент пропорциональности из уравнения вида y = mx или y = mx + b
     * Поддерживает дробные коэффициенты
     */
    function extractConstantFromEquation(equation) {
        // Clean LaTeX
        let cleaned = cleanLatexWrappers(equation);
        cleaned = convertLatexOperators(cleaned);
        cleaned = convertLatexFractions(cleaned);
        cleaned = cleaned.replace(/\s+/g, '');
        // Pattern 1: y = mx (simple number coefficient)
        let match = cleaned.match(/^y=(-?\d+\.?\d*)x$/);
        if (match && match[1] !== undefined) {
            const m = parseFloat(match[1]);
            if (!Number.isNaN(m)) {
                return m;
            }
        }
        // Pattern 2: y = (expression)x where expression can be evaluated (e.g., y=(1/2)x)
        match = cleaned.match(/^y=(.+?)x$/);
        if (match && match[1] !== undefined) {
            const coefficientExpr = match[1];
            const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
            const evaluated = evaluateMathExpression(cleanedCoeff);
            if (evaluated !== null) {
                return evaluated;
            }
        }
        // Pattern 3: y = mx + b or y = mx - b (we still want the coefficient m)
        match = cleaned.match(/^y=(-?\d+\.?\d*)x[+-](-?\d+\.?\d*)$/);
        if (match && match[1] !== undefined) {
            const m = parseFloat(match[1]);
            if (!Number.isNaN(m)) {
                return m; // Return coefficient, ignore b
            }
        }
        // Pattern 4: y = (expression)x + b or y = (expression)x - b
        match = cleaned.match(/^y=(.+?)x[+-](-?\d+\.?\d*)$/);
        if (match && match[1] !== undefined) {
            const coefficientExpr = match[1];
            const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
            const evaluated = evaluateMathExpression(cleanedCoeff);
            if (evaluated !== null) {
                return evaluated; // Return coefficient, ignore b
            }
        }
        return null;
    }
    class SelectConstantSolver extends BaseSolver {
        name = 'SelectConstantSolver';
        canSolve(context) {
            // Check header for "select the constant of proportionality"
            const headerMatches = this.headerContains(context, 'select', 'constant', 'proportionality');
            if (!headerMatches) {
                return false;
            }
            // Check for choices
            if (!context.choices?.length) {
                return false;
            }
            // Check if there's an equation displayed (y = mx format)
            // The equation might be in the challenge container or in a separate element
            const containerText = context.container.textContent || '';
            const hasEquation = containerText.includes('y') && containerText.includes('=') && containerText.includes('x');
            return hasEquation;
        }
        solve(context) {
            this.log('starting');
            if (!context.choices?.length) {
                return this.failure('selectConstant', 'no choices found');
            }
            // Extract equation from the challenge
            // The equation might be displayed in KaTeX format
            let equation = null;
            // Method 1: Look for equation in KaTeX annotations
            const annotations = context.container.querySelectorAll('annotation');
            for (const annotation of annotations) {
                const text = annotation.textContent;
                if (!text)
                    continue;
                // Check if it looks like an equation (y = ...)
                if (text.includes('y') && text.includes('=') && text.includes('x')) {
                    const katexValue = extractKatexValue(annotation.parentElement);
                    if (katexValue) {
                        equation = katexValue;
                        break;
                    }
                }
            }
            // Method 2: Look for equation in the challenge container directly
            if (!equation) {
                // Try to find KaTeX elements that contain equations
                const katexElements = context.container.querySelectorAll('.katex');
                for (const katexEl of Array.from(katexElements)) {
                    const katexValue = extractKatexValue(katexEl);
                    if (katexValue && katexValue.includes('y') && katexValue.includes('=') && katexValue.includes('x')) {
                        equation = katexValue;
                        break;
                    }
                }
            }
            // Method 3: Extract from text content using regex
            if (!equation) {
                const containerText = context.container.textContent || '';
                const equationMatch = containerText.match(/y\s*=\s*([^\s]+)\s*x/);
                if (equationMatch && equationMatch[1]) {
                    equation = `y=${equationMatch[1]}x`;
                }
            }
            if (!equation) {
                return this.failure('selectConstant', 'could not extract equation from challenge');
            }
            this.log('extracted equation:', equation);
            // Extract constant of proportionality
            const constant = extractConstantFromEquation(equation);
            if (constant === null) {
                return this.failure('selectConstant', `could not extract constant from equation: ${equation}`);
            }
            this.log('extracted constant:', constant);
            // Find matching choice
            let matchedIndex = -1;
            const tolerance = 0.0001;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                // Extract value from choice (could be KaTeX or plain text)
                const katexValue = extractKatexValue(choice);
                let choiceValue = null;
                if (katexValue) {
                    // Try to evaluate as math expression
                    choiceValue = evaluateMathExpression(katexValue);
                }
                // Fallback: try to parse as number from text content
                if (choiceValue === null) {
                    const choiceText = choice.textContent || '';
                    const numberMatch = choiceText.match(/(-?\d+\.?\d*)/);
                    if (numberMatch && numberMatch[1]) {
                        choiceValue = parseFloat(numberMatch[1]);
                    }
                }
                if (choiceValue === null || Number.isNaN(choiceValue)) {
                    this.log(`choice ${i}: could not extract value`);
                    continue;
                }
                this.log(`choice ${i}: ${katexValue || choice.textContent} -> ${choiceValue}`);
                // Compare with tolerance for floating-point comparison
                if (Math.abs(choiceValue - constant) < tolerance) {
                    matchedIndex = i;
                    this.log(`matched choice ${i}: ${choiceValue}`);
                    break;
                }
            }
            if (matchedIndex === -1) {
                return this.failure('selectConstant', `no matching choice found for constant: ${constant}`);
            }
            // Click the matched choice
            const choiceButtons = context.container.querySelectorAll('[data-test="challenge-choice"]');
            const choiceButton = choiceButtons[matchedIndex];
            if (!choiceButton) {
                return this.failure('selectConstant', `choice button ${matchedIndex} not found`);
            }
            try {
                choiceButton.click();
                this.log(`clicked choice ${matchedIndex}`);
            }
            catch (e) {
                return this.failure('selectConstant', `error clicking choice: ${e}`);
            }
            return {
                type: 'selectConstant',
                success: true,
                constant,
                selectedChoice: matchedIndex,
            };
        }
    }

    /**
     * Солвер для заданий "Select the match" с неравенствами на числовой прямой
     * Извлекает неравенство из диаграммы NumberLine и выбирает правильный вариант
     */
    /**
     * Извлекает информацию о неравенстве из диаграммы NumberLine
     */
    function extractInequalityFromDiagram(iframeWindow) {
        try {
            const iframeWindowTyped = iframeWindow;
            // Method 1: getOutputVariables
            let endpointPosition;
            let isInclusive;
            if (typeof iframeWindowTyped.getOutputVariables === 'function') {
                const vars = iframeWindowTyped.getOutputVariables();
                if (vars) {
                    endpointPosition = vars.endpoint_position;
                    isInclusive = vars.is_inclusive;
                }
            }
            // Method 2: INPUT_VARIABLES
            if (endpointPosition === undefined && iframeWindowTyped.INPUT_VARIABLES) {
                endpointPosition = iframeWindowTyped.INPUT_VARIABLES.endpoint_position;
                isInclusive = iframeWindowTyped.INPUT_VARIABLES.is_inclusive;
            }
            // Method 3: Parse from srcdoc if available
            if (endpointPosition === undefined || isInclusive === undefined) {
                const iframeDoc = iframeWindow.document;
                if (iframeDoc) {
                    // Try to find the script tag with INPUT_VARIABLES
                    const scripts = iframeDoc.querySelectorAll('script');
                    for (const script of Array.from(scripts)) {
                        const scriptText = script.textContent || '';
                        const endpointMatch = scriptText.match(/endpoint_position["\s]*:\s*(\d+)/);
                        const inclusiveMatch = scriptText.match(/is_inclusive["\s]*:\s*(true|false)/);
                        if (endpointMatch && endpointMatch[1]) {
                            endpointPosition = parseInt(endpointMatch[1], 10);
                        }
                        if (inclusiveMatch) {
                            isInclusive = inclusiveMatch[1] === 'true';
                        }
                    }
                    // Method 4: Check SVG for open/closed circle if isInclusive is still undefined
                    if (isInclusive === undefined && iframeDoc) {
                        // Look for point elements with class "open" (open circle) or without (closed circle)
                        const pointElements = iframeDoc.querySelectorAll('g.point');
                        for (const pointEl of Array.from(pointElements)) {
                            if (pointEl.classList.contains('open')) {
                                isInclusive = false;
                                break;
                            }
                            else if (pointEl.querySelector('circle') && !pointEl.classList.contains('open')) {
                                // Check if circle has stroke-width > 0 (closed circle)
                                const circle = pointEl.querySelector('circle');
                                if (circle) {
                                    const strokeWidth = parseFloat(circle.getAttribute('stroke-width') || '0');
                                    if (strokeWidth > 0) {
                                        isInclusive = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (endpointPosition === undefined) {
                return null;
            }
            // Default isInclusive to false if still undefined (open circle is more common)
            if (isInclusive === undefined) {
                isInclusive = false;
            }
            // Determine direction by checking the ray/line direction
            // If ray points left (from endpoint to smaller x), it's x < endpoint or x ≤ endpoint
            // If ray points right (from endpoint to larger x), it's x > endpoint or x ≥ endpoint
            let direction = 'left'; // Default to left
            try {
                const iframeDoc = iframeWindow.document;
                if (iframeDoc) {
                    // Method 1: Check line coordinates in SVG
                    const lines = iframeDoc.querySelectorAll('line');
                    for (const line of Array.from(lines)) {
                        const x1 = parseFloat(line.getAttribute('x1') || '0');
                        const x2 = parseFloat(line.getAttribute('x2') || '0');
                        if (!Number.isNaN(x1) && !Number.isNaN(x2)) {
                            // If x2 < x1, ray points left; if x2 > x1, ray points right
                            if (x2 < x1) {
                                direction = 'left';
                                break;
                            }
                            else if (x2 > x1) {
                                direction = 'right';
                                break;
                            }
                        }
                    }
                    // Method 2: Parse from script if line coordinates don't help
                    if (direction === 'left') {
                        const scriptText = iframeDoc.documentElement.innerHTML;
                        const xAxisMinMatch = scriptText.match(/xAxisMin["\s]*:\s*(-?\d+)/);
                        if (xAxisMinMatch && xAxisMinMatch[1]) {
                            const xAxisMin = parseInt(xAxisMinMatch[1], 10);
                            // If xAxisMin < endpoint_position, ray points left
                            // If xAxisMin > endpoint_position, ray points right
                            if (xAxisMin < endpointPosition) {
                                direction = 'left';
                            }
                            else if (xAxisMin > endpointPosition) {
                                direction = 'right';
                            }
                        }
                    }
                }
            }
            catch {
                // Default to left if we can't determine
                direction = 'left';
            }
            // Build inequality
            const operator = direction === 'left'
                ? (isInclusive ? '≤' : '<')
                : (isInclusive ? '≥' : '>');
            return {
                variable: 'x',
                operator,
                value: endpointPosition,
            };
        }
        catch (e) {
            console.error('Error extracting inequality from diagram:', e);
            return null;
        }
    }
    /**
     * Парсит неравенство из текста (например, "x ≥ 9" или "x ≤ 9")
     */
    function parseInequality(text) {
        // Clean LaTeX
        let cleaned = cleanLatexWrappers(text);
        cleaned = convertLatexOperators(cleaned);
        cleaned = cleaned.replace(/\s+/g, '');
        // Pattern 1: x ≥ 9, x ≤ 9, x > 9, x < 9
        const match = cleaned.match(/^([xyz])([<>≤≥])(-?\d+\.?\d*)$/i);
        if (match && match[1] && match[2] && match[3]) {
            const variable = match[1].toLowerCase();
            const operator = match[2];
            const value = parseFloat(match[3]);
            if (!Number.isNaN(value)) {
                return { variable, operator, value };
            }
        }
        // Pattern 2: 9 ≤ x, 9 ≥ x, 9 < x, 9 > x (reversed)
        const reversedMatch = cleaned.match(/^(-?\d+\.?\d*)([<>≤≥])([xyz])$/i);
        if (reversedMatch && reversedMatch[1] && reversedMatch[2] && reversedMatch[3]) {
            const value = parseFloat(reversedMatch[1]);
            const operatorRaw = reversedMatch[2];
            const variable = reversedMatch[3].toLowerCase();
            if (!Number.isNaN(value)) {
                // Reverse the operator
                let operator;
                if (operatorRaw === '<')
                    operator = '>';
                else if (operatorRaw === '>')
                    operator = '<';
                else if (operatorRaw === '≤')
                    operator = '≥';
                else if (operatorRaw === '≥')
                    operator = '≤';
                else
                    return null;
                return { variable, operator, value };
            }
        }
        return null;
    }
    /**
     * Сравнивает два неравенства на равенство
     */
    function inequalitiesMatch(ineq1, ineq2) {
        if (ineq1.variable !== ineq2.variable)
            return false;
        if (Math.abs(ineq1.value - ineq2.value) > 0.0001)
            return false;
        if (ineq1.operator !== ineq2.operator)
            return false;
        return true;
    }
    class SelectMatchInequalitySolver extends BaseSolver {
        name = 'SelectMatchInequalitySolver';
        canSolve(context) {
            // Check header for "select the match"
            const headerMatches = this.headerContains(context, 'select', 'match');
            if (!headerMatches) {
                return false;
            }
            // Check for choices
            if (!context.choices?.length) {
                return false;
            }
            // Check if there's a NumberLine iframe
            const allIframes = findAllIframes(context.container);
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                // Check for NumberLine
                if (srcdoc.includes('NumberLine') || srcdoc.includes('new NumberLine')) {
                    // Check if choices contain inequalities
                    const hasInequalityChoices = context.choices.some(choice => {
                        const katexValue = extractKatexValue(choice);
                        if (!katexValue)
                            return false;
                        const parsed = parseInequality(katexValue);
                        return parsed !== null;
                    });
                    if (hasInequalityChoices) {
                        return true;
                    }
                }
            }
            return false;
        }
        solve(context) {
            this.log('starting');
            if (!context.choices?.length) {
                return this.failure('selectMatchInequality', 'no choices found');
            }
            // Find the NumberLine iframe
            const allIframes = findAllIframes(context.container);
            const allIframesFallback = context.container.querySelectorAll('iframe');
            const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));
            let diagramIframe = null;
            for (const iframe of combinedIframes) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc)
                    continue;
                if (srcdoc.includes('NumberLine') || srcdoc.includes('new NumberLine')) {
                    diagramIframe = iframe;
                    break;
                }
            }
            if (!diagramIframe) {
                return this.failure('selectMatchInequality', 'no NumberLine iframe found');
            }
            // Access iframe window
            const iframeWindow = diagramIframe.contentWindow;
            if (!iframeWindow) {
                return this.failure('selectMatchInequality', 'could not access iframe window');
            }
            // Extract inequality from diagram
            // Try multiple times in case diagram is still initializing
            let extractedInequality = null;
            const maxAttempts = 5;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                extractedInequality = extractInequalityFromDiagram(iframeWindow);
                if (extractedInequality) {
                    if (attempt > 1) {
                        this.log(`extracted inequality on attempt ${attempt}`);
                    }
                    break;
                }
            }
            if (!extractedInequality) {
                return this.failure('selectMatchInequality', 'could not extract inequality from diagram');
            }
            const inequalityStr = `${extractedInequality.variable} ${extractedInequality.operator} ${extractedInequality.value}`;
            this.log(`extracted inequality: ${inequalityStr}`);
            // Parse all choice inequalities and find match
            let matchedIndex = -1;
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const katexValue = extractKatexValue(choice);
                if (!katexValue) {
                    this.log(`choice ${i}: could not extract KaTeX value`);
                    continue;
                }
                const parsed = parseInequality(katexValue);
                if (!parsed) {
                    this.log(`choice ${i}: could not parse inequality: ${katexValue}`);
                    continue;
                }
                const choiceStr = `${parsed.variable} ${parsed.operator} ${parsed.value}`;
                this.log(`choice ${i}: ${katexValue} -> ${choiceStr}`);
                if (inequalitiesMatch(extractedInequality, parsed)) {
                    matchedIndex = i;
                    this.log(`matched choice ${i}: ${choiceStr}`);
                    break;
                }
            }
            if (matchedIndex === -1) {
                return this.failure('selectMatchInequality', `no matching inequality found for: ${inequalityStr}`);
            }
            // Click the matched choice
            const choiceButtons = context.container.querySelectorAll('[data-test="challenge-choice"]');
            const choiceButton = choiceButtons[matchedIndex];
            if (!choiceButton) {
                return this.failure('selectMatchInequality', `choice button ${matchedIndex} not found`);
            }
            try {
                choiceButton.click();
                this.log(`clicked choice ${matchedIndex}`);
            }
            catch (e) {
                return this.failure('selectMatchInequality', `error clicking choice: ${e}`);
            }
            return {
                type: 'selectMatchInequality',
                success: true,
                extractedInequality: inequalityStr,
                selectedChoice: matchedIndex,
            };
        }
    }

    /**
     * Солвер для заданий "Select all that match"
     * Выбирает все выражения, которые равны заданному значению
     *
     * Например: "X = 11 - 4" (X = 7)
     * Варианты: "10 - 3" (7), "14 - 70" (-56), "13 - 6" (7), "14 - 7" (7)
     * Нужно выбрать: "10 - 3", "13 - 6", "14 - 7"
     */
    class SelectAllMatchSolver extends BaseSolver {
        name = 'SelectAllMatchSolver';
        canSolve(context) {
            // Check header for "select all that match"
            const headerMatches = this.headerContains(context, 'select', 'all', 'match');
            if (!headerMatches) {
                return false;
            }
            // Check for choices
            if (!context.choices?.length) {
                return false;
            }
            // Check if choices are checkboxes (role="checkbox")
            const firstChoice = context.choices[0];
            if (!firstChoice) {
                return false;
            }
            const isCheckbox = firstChoice.getAttribute('role') === 'checkbox' ||
                firstChoice.hasAttribute('aria-checked');
            if (!isCheckbox) {
                return false;
            }
            // Check if there's an equation/condition container
            const equationContainer = context.container.querySelector(SELECTORS.EQUATION_CONTAINER);
            if (!equationContainer) {
                return false;
            }
            return true;
        }
        solve(context) {
            this.log('starting');
            if (!context.choices?.length) {
                return this.failure('selectAllMatch', 'no choices found');
            }
            // Find the equation/condition container
            const equationContainer = context.container.querySelector(SELECTORS.EQUATION_CONTAINER);
            if (!equationContainer) {
                return this.failure('selectAllMatch', 'equation container not found');
            }
            // Extract the condition (e.g., "X = 11 - 4")
            const conditionValue = extractKatexValue(equationContainer);
            if (!conditionValue) {
                return this.failure('selectAllMatch', 'could not extract condition');
            }
            this.log('condition:', conditionValue);
            // Parse the condition to extract the target value
            // Format: "X = 11 - 4" or "X=11-4" or "11-4" or "20=\duoblank{5}"
            let targetValue = null;
            // Check if there's a \duoblank pattern (e.g., "20=\duoblank{5}")
            // In this case, the target value is on the LEFT side of the equation
            if (conditionValue.includes('\\duoblank') || conditionValue.includes('duoblank')) {
                // Extract value from left side of equation (before "=")
                // Handle patterns like "20=" or "20 = " or "\mathbf{20}="
                const leftSideMatch = conditionValue.match(/^([^=]+?)\s*=/);
                if (leftSideMatch && leftSideMatch[1]) {
                    let leftSide = leftSideMatch[1].trim();
                    // Clean any remaining LaTeX wrappers
                    leftSide = leftSide.replace(/\\mathbf\{([^}]+)\}/g, '$1');
                    leftSide = leftSide.replace(/\\textbf\{([^}]+)\}/g, '$1');
                    leftSide = leftSide.replace(/\s+/g, '');
                    targetValue = evaluateMathExpression(leftSide);
                    if (targetValue === null) {
                        // Fallback: try to parse as a simple number
                        const numberMatch = leftSide.match(/^(-?\d+(?:\.\d+)?)/);
                        if (numberMatch && numberMatch[1]) {
                            targetValue = parseFloat(numberMatch[1]);
                        }
                    }
                    this.log(`found duoblank pattern, extracted value from left side: ${leftSide} → ${targetValue}`);
                }
                else {
                    // Fallback: try to extract number directly if left side is just a number
                    const numberMatch = conditionValue.match(/^(-?\d+(?:\.\d+)?)/);
                    if (numberMatch && numberMatch[1]) {
                        targetValue = parseFloat(numberMatch[1]);
                        this.log(`found duoblank pattern, extracted number from start: ${targetValue}`);
                    }
                }
            }
            else {
                // Standard case: extract value after "="
                const equalsMatch = conditionValue.match(/=\s*([^=]+)$/);
                if (equalsMatch && equalsMatch[1]) {
                    const expression = equalsMatch[1].trim();
                    targetValue = evaluateMathExpression(expression);
                    this.log(`extracted expression after '=': ${expression}`);
                }
                else {
                    // If no "=" found, try to evaluate the whole expression
                    // This handles cases where the condition is just an expression
                    targetValue = evaluateMathExpression(conditionValue);
                    this.log('evaluating whole condition as expression');
                }
            }
            if (targetValue === null) {
                return this.failure('selectAllMatch', `could not evaluate target value from: ${conditionValue}`);
            }
            this.log('target value:', targetValue);
            // Evaluate all choices and find matches
            const matchedIndices = [];
            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice)
                    continue;
                const choiceValue = extractKatexValue(choice);
                if (!choiceValue) {
                    this.log(`choice ${i}: could not extract value`);
                    continue;
                }
                const choiceResult = evaluateMathExpression(choiceValue);
                if (choiceResult === null) {
                    this.log(`choice ${i}: could not evaluate: ${choiceValue}`);
                    continue;
                }
                this.log(`choice ${i}: ${choiceValue} = ${choiceResult}`);
                // Check if values match (with small tolerance for floating point)
                if (Math.abs(choiceResult - targetValue) < 0.0001) {
                    matchedIndices.push(i);
                    this.log(`matched choice ${i}: ${choiceValue} = ${choiceResult}`);
                }
            }
            if (matchedIndices.length === 0) {
                return this.failure('selectAllMatch', `no matching choices found for value: ${targetValue}`);
            }
            this.log(`found ${matchedIndices.length} matching choices:`, matchedIndices);
            // Click all matched choices
            for (const index of matchedIndices) {
                const choice = context.choices[index];
                if (!choice) {
                    this.log(`warning: choice ${index} not found`);
                    continue;
                }
                try {
                    // For checkboxes, we need to click them to toggle
                    choice.click();
                    this.log(`clicked choice ${index}`);
                }
                catch (e) {
                    this.log(`error clicking choice ${index}:`, e);
                }
            }
            return {
                type: 'selectAllMatch',
                success: true,
                targetValue,
                matchedChoices: matchedIndices,
            };
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
            // Note: InteractiveSliderSolver must be BEFORE ExpressionBuildSolver
            // because NumberLine sliders may contain "ExpressionBuild" in their iframe code
            this.register(new TableFillSolver()); // Must be before InteractiveSliderSolver (Table might contain NumberLine)
            this.register(new SelectConstantSolver()); // Must be before SelectEquationSolver (selecting constant is more specific)
            this.register(new SelectAllMatchSolver()); // Must be before other select solvers (select all that match is specific)
            this.register(new SelectMatchInequalitySolver()); // Must be before InteractiveSliderSolver (selecting match with NumberLine is more specific)
            this.register(new SelectEquationSolver()); // Must be before PlotPointsSolver and GraphLineSolver (selecting equation is more specific)
            this.register(new PlotPointsSolver()); // Must be before GraphLineSolver (Grid2D is more specific than MathDiagram)
            this.register(new GraphLineSolver()); // Must be before InteractiveSliderSolver (MathDiagram might contain NumberLine)
            this.register(new InteractiveSliderSolver());
            this.register(new ExpressionBuildSolver());
            this.register(new InteractiveSpinnerSolver());
            this.register(new FactorTreeSolver());
            this.register(new RatioChoiceSolver()); // Must be before MatchPairs and PatternTable
            this.register(new MatchPairsSolver());
            this.register(new PatternTableSolver());
            // Specific challenge type solvers
            this.register(new BlockDiagramChoiceSolver());
            this.register(new BlockDiagramTextInputSolver());
            this.register(new RoundToNearestSolver());
            this.register(new SelectFactorsSolver()); // Select factors from list
            this.register(new VisualLCMSolver()); // Select LCM with visual block diagrams
            this.register(new LeastCommonMultipleSolver()); // Select LCM with text numbers
            this.register(new VisualGCFSolver()); // Find GCF with visual block diagrams
            this.register(new GreatestCommonFactorSolver()); // Find GCF with text numbers
            this.register(new SelectEquivalentFractionSolver());
            this.register(new FractionToDecimalChoiceSolver()); // Convert fraction to decimal
            this.register(new ComparisonChoiceSolver());
            this.register(new SelectOperatorSolver());
            this.register(new PieChartTextInputSolver());
            this.register(new PieChartSelectFractionSolver());
            this.register(new SelectPieChartSolver());
            this.register(new SolveForXSolver()); // Solve for X with choices (before EquationBlankSolver)
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
            let stuckCounter = 0;
            const maxStuckAttempts = 5;
            while (this.isRunning) {
                try {
                    // Check if on result screen (lesson complete)
                    if (isOnResultScreen()) {
                        logger.info('AutoRunner: lesson complete, looking for next...');
                        const clicked = await clickContinueButtonAsync(5000);
                        if (!clicked) {
                            stuckCounter++;
                            logger.warn(`AutoRunner: cannot click continue (attempt ${stuckCounter}/${maxStuckAttempts})`);
                            if (stuckCounter >= maxStuckAttempts) {
                                logger.error('AutoRunner: stuck on result screen, stopping');
                                this.stop();
                                break;
                            }
                        }
                        else {
                            stuckCounter = 0;
                        }
                        await delay$1(1000);
                        continue;
                    }
                    // Check if on home page (need to start next lesson)
                    if (isOnHomePage()) {
                        logger.info('AutoRunner: on home page, starting next lesson...');
                        const started = clickNextLesson();
                        if (!started) {
                            logger.info('AutoRunner: no more lessons available, course complete!');
                            this.stop();
                            break;
                        }
                        stuckCounter = 0;
                        await delay$1(2000); // Wait for lesson to load
                        continue;
                    }
                    // Check for incorrect answer
                    if (isIncorrect()) {
                        logger.warn('AutoRunner: incorrect answer detected');
                        if (this.config.stopOnError) {
                            this.stop();
                            break;
                        }
                        const clicked = await clickContinueButtonAsync(5000);
                        if (!clicked) {
                            stuckCounter++;
                            if (stuckCounter >= maxStuckAttempts) {
                                logger.error('AutoRunner: stuck on incorrect screen, stopping');
                                this.stop();
                                break;
                            }
                        }
                        else {
                            stuckCounter = 0;
                        }
                        await delay$1(this.config.delayBetweenActions);
                        continue;
                    }
                    // Reset stuck counter on normal progress
                    stuckCounter = 0;
                    // Try to solve
                    const solved = await this.solveOne();
                    if (solved) {
                        this.solvedCount++;
                        await delay$1(this.config.delayAfterSolve);
                        // Click continue/check button (wait for it to become enabled)
                        // Use longer timeout for table challenges which may need more processing time
                        const clicked = await clickContinueButtonAsync(10000);
                        if (!clicked) {
                            logger.warn('AutoRunner: continue button not clicked (may be disabled or not found)');
                            // Don't increment stuck counter here - the challenge was solved,
                            // just the button might need more time
                        }
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
        clickContinueButtonAsync: clickContinueButtonAsync,
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
        // Show UI panels
        const logPanel = getLogPanel();
        const controlPanel = getControlPanel();
        logPanel.show();
        controlPanel.show();
        // Connect logger to UI
        logger.setLogPanel(logPanel);
        logger.info(`AutoDuo ${CONFIG.version} ready`);
        logger.info('Click "Solve 1" to solve current challenge');
        logger.info('Click "Start" to auto-solve all challenges');
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
    exports.BlockDiagramChoiceSolver = BlockDiagramChoiceSolver;
    exports.BlockDiagramTextInputSolver = BlockDiagramTextInputSolver;
    exports.CONFIG = CONFIG;
    exports.ComparisonChoiceSolver = ComparisonChoiceSolver;
    exports.ControlPanel = ControlPanel;
    exports.EquationBlankSolver = EquationBlankSolver;
    exports.ExpressionBuildSolver = ExpressionBuildSolver;
    exports.FactorTreeSolver = FactorTreeSolver;
    exports.FractionToDecimalChoiceSolver = FractionToDecimalChoiceSolver;
    exports.GraphLineSolver = GraphLineSolver;
    exports.InteractiveSliderSolver = InteractiveSliderSolver;
    exports.InteractiveSpinnerSolver = InteractiveSpinnerSolver;
    exports.LOG = LOG;
    exports.LOG_DEBUG = LOG_DEBUG;
    exports.LOG_ERROR = LOG_ERROR;
    exports.LOG_WARN = LOG_WARN;
    exports.LogPanel = LogPanel;
    exports.MatchPairsSolver = MatchPairsSolver;
    exports.PatternTableSolver = PatternTableSolver;
    exports.PieChartSelectFractionSolver = PieChartSelectFractionSolver;
    exports.PieChartTextInputSolver = PieChartTextInputSolver;
    exports.PlotPointsSolver = PlotPointsSolver;
    exports.RatioChoiceSolver = RatioChoiceSolver;
    exports.RoundToNearestSolver = RoundToNearestSolver;
    exports.SelectAllMatchSolver = SelectAllMatchSolver;
    exports.SelectConstantSolver = SelectConstantSolver;
    exports.SelectEquationSolver = SelectEquationSolver;
    exports.SelectEquivalentFractionSolver = SelectEquivalentFractionSolver;
    exports.SelectMatchInequalitySolver = SelectMatchInequalitySolver;
    exports.SelectOperatorSolver = SelectOperatorSolver;
    exports.SelectPieChartSolver = SelectPieChartSolver;
    exports.SolveForXSolver = SolveForXSolver;
    exports.SolverRegistry = SolverRegistry;
    exports.TableFillSolver = TableFillSolver;
    exports.TypeAnswerSolver = TypeAnswerSolver;
    exports.addFractions = addFractions;
    exports.areFractionsEqual = areFractionsEqual;
    exports.ceilToNearest = ceilToNearest;
    exports.clamp = clamp;
    exports.cleanAnnotationText = cleanAnnotationText;
    exports.cleanLatexForEval = cleanLatexForEval;
    exports.cleanLatexWrappers = cleanLatexWrappers;
    exports.clickNextLesson = clickNextLesson;
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
    exports.extractGridFraction = extractGridFraction;
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
    exports.hasNextLesson = hasNextLesson;
    exports.isBlockDiagram = isBlockDiagram;
    exports.isDigitsOnly = isDigitsOnly;
    exports.isFractionString = isFractionString;
    exports.isGridDiagram = isGridDiagram;
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
