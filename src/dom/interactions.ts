/**
 * Утилиты для взаимодействия с DOM
 */

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
 * Кликает кнопку продолжения/проверки
 */
export function clickContinueButton(): boolean {
    const selectors = [
        '[data-test="player-next"]',
        'button[data-test="player-next"]',
    ];

    for (const selector of selectors) {
        const button = document.querySelector<HTMLButtonElement>(selector);
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
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
