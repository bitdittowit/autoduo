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
 * Проверяет, находимся ли на домашней странице
 */
export function isOnHomePage(): boolean {
    const url = window.location.href;
    return url.includes('/learn') && !url.includes('/lesson') && !url.includes('/practice');
}
