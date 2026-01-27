/**
 * Утилиты для ожидания элементов DOM
 */

export interface IWaitConfig {
    timeout?: number;
    interval?: number;
}

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_INTERVAL = 100;

/**
 * Ожидает появления элемента по селектору
 */
export function waitForElement(
    selector: string,
    config: IWaitConfig = {},
    parent: Element | Document = document,
): Promise<Element | null> {
    const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = config;

    return new Promise((resolve) => {
        const startTime = Date.now();

        const check = (): void => {
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
export function waitForElements(
    selector: string,
    minCount = 1,
    config: IWaitConfig = {},
    parent: Element | Document = document,
): Promise<Element[]> {
    const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = config;

    return new Promise((resolve) => {
        const startTime = Date.now();

        const check = (): void => {
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
export function waitForAnyElement(
    selectors: string[],
    config: IWaitConfig = {},
): Promise<{ element: Element; selector: string } | null> {
    const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = config;

    return new Promise((resolve) => {
        const startTime = Date.now();

        const check = (): void => {
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
export function waitForIframeContent(
    iframe: HTMLIFrameElement,
    config: IWaitConfig = {},
): Promise<boolean> {
    const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = config;

    return new Promise((resolve) => {
        const startTime = Date.now();

        const check = (): void => {
            try {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc && srcdoc.length > 0) {
                    resolve(true);
                    return;
                }
            } catch {
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
