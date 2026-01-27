/**
 * CSS селекторы для элементов Duolingo
 */

export const SELECTORS = {
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
export function findAllIframes(container: Element): HTMLIFrameElement[] {
    const titled = container.querySelectorAll<HTMLIFrameElement>(SELECTORS.MATH_IFRAME);
    const sandbox = container.querySelectorAll<HTMLIFrameElement>(SELECTORS.SANDBOX_IFRAME);

    // Unique set
    const set = new Set([...titled, ...sandbox]);
    return Array.from(set);
}

/**
 * Находит iframe с определённым контентом
 */
export function findIframeByContent(
    iframes: HTMLIFrameElement[],
    contentSubstring: string,
): HTMLIFrameElement | null {
    for (const iframe of iframes) {
        const srcdoc = iframe.getAttribute('srcdoc');
        if (srcdoc?.includes(contentSubstring)) {
            return iframe;
        }
    }
    return null;
}
