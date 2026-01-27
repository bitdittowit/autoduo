/**
 * Определяет тип задания и извлекает контекст
 */

import type { IChallengeContext } from '../types';
import { SELECTORS } from '../dom/selectors';
import { logger } from '../utils/logger';

/**
 * Определяет и создаёт контекст текущего задания
 */
export function detectChallenge(): IChallengeContext | null {
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
function createChallengeContext(container: Element): IChallengeContext {
    const header = container.querySelector(SELECTORS.CHALLENGE_HEADER);
    const equationContainer = container.querySelector(SELECTORS.EQUATION_CONTAINER);
    const textInput = container.querySelector<HTMLInputElement>(SELECTORS.TEXT_INPUT);
    const choices = Array.from(container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE));
    const tapTokens = Array.from(container.querySelectorAll(SELECTORS.CHALLENGE_TAP_TOKEN));
    const iframe = container.querySelector<HTMLIFrameElement>(SELECTORS.MATH_IFRAME);

    // Use tap tokens as choices if no regular choices
    const finalChoices = choices.length > 0 ? choices : tapTokens;

    const context: IChallengeContext = {
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
export function isOnResultScreen(): boolean {
    return document.querySelector(SELECTORS.SESSION_COMPLETE) !== null;
}

/**
 * Проверяет, был ли ответ неправильным
 */
export function isIncorrect(): boolean {
    return document.querySelector(SELECTORS.BLAME_INCORRECT) !== null;
}

/**
 * Проверяет, находимся ли на домашней странице курса
 */
export function isOnHomePage(): boolean {
    const url = window.location.href;
    return url.includes('/learn') && !url.includes('/lesson') && !url.includes('/practice');
}

/**
 * Проверяет, есть ли доступный следующий урок
 */
export function hasNextLesson(): boolean {
    // Look for skill path with START indicator or unlocked lessons
    const startButton = document.querySelector('[data-test*="skill-path-level"] button:not([disabled])');
    return startButton !== null;
}

/**
 * Кликает на следующий доступный урок
 * @returns true если урок найден и клик выполнен
 */
export function clickNextLesson(): boolean {
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
                const startBtn = document.querySelector(
                    'button[data-test="start-button"], a[href*="/lesson"]',
                );
                if (startBtn) {
                    (startBtn as HTMLElement).click();
                }
            }, 300);
            return true;
        }
    }

    // Fallback: find any unlocked skill button and click it
    const skillButtons = document.querySelectorAll(
        '[data-test*="skill-path-level"] button:not([disabled])',
    );

    for (const btn of skillButtons) {
        // Skip completed lessons (they have checkmark icons)
        const isCompleted = btn.querySelector('svg path[d*="M34.2346"]') !== null;
        if (!isCompleted) {
            logger.info('clicking next available lesson');
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            setTimeout(() => {
                const startBtn = document.querySelector(
                    'button[data-test="start-button"], a[href*="/lesson"]',
                );
                if (startBtn) {
                    (startBtn as HTMLElement).click();
                }
            }, 300);
            return true;
        }
    }

    logger.warn('no available lessons found');
    return false;
}
