/**
 * Утилиты для взаимодействия с DOM
 */

import { logger } from '../utils/logger';

/**
 * Симулирует клик по элементу
 */
export function click(element: Element): void {
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
export function pressEnter(): void {
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
export function typeInput(input: HTMLInputElement, value: string): void {
    // Use native setter to work with React
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
    )?.set;

    if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value);
    } else {
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
export function clickContinueButton(): boolean {
    const selectors = [
        '[data-test="player-next"]',
        'button[data-test="player-next"]',
    ];

    for (const selector of selectors) {
        const button = document.querySelector<HTMLButtonElement>(selector);
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
export async function clickContinueButtonAsync(
    maxWaitMs = 5000,
    checkInterval = 50,
): Promise<boolean> {
    const selectors = [
        '[data-test="player-next"]',
        'button[data-test="player-next"]',
    ];

    const findButton = (): HTMLButtonElement | null => {
        for (const selector of selectors) {
            const button = document.querySelector<HTMLButtonElement>(selector);
            if (button) {
                return button;
            }
        }
        return null;
    };

    const isButtonEnabled = (button: HTMLButtonElement): boolean => {
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
    } else {
        logger.debug('clickContinueButtonAsync: button found but disabled, waiting for enable...');
    }

    // Use Promise to coordinate between observer and polling
    let resolvePromise: ((value: boolean) => void) | null = null;
    const clickPromise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
    });

    let observer: MutationObserver | null = null;
    let clicked = false;

    const tryClick = (btn: HTMLButtonElement | null): boolean => {
        if (clicked || !btn) return false;

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
        if (clicked) return;

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
    const pollCheck = async (): Promise<void> => {
        while (!clicked && Date.now() - startTime < maxWaitMs) {
            button = findButton();

            if (tryClick(button)) {
                return;
            }

            await delay(checkInterval);
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
            } else {
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
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
