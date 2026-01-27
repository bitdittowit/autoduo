/**
 * Базовый абстрактный класс для всех солверов
 */

import type { ISolver, ISolverResult, IChallengeContext } from '../types';
import { logger } from '../utils/logger';

/**
 * Абстрактный базовый класс солвера
 *
 * Все конкретные солверы должны наследоваться от этого класса
 * и реализовывать методы canSolve и solve
 */
export abstract class BaseSolver implements ISolver {
    abstract readonly name: string;

    /**
     * Проверяет, может ли солвер решить данное задание
     * @param context - контекст задания
     */
    abstract canSolve(context: IChallengeContext): boolean;

    /**
     * Решает задание
     * @param context - контекст задания
     */
    abstract solve(context: IChallengeContext): ISolverResult | null;

    /**
     * Логирует сообщение с именем солвера
     */
    protected log(...args: unknown[]): void {
        logger.info(`[${this.name}]`, ...args);
    }

    /**
     * Логирует debug сообщение с именем солвера
     */
    protected logDebug(...args: unknown[]): void {
        logger.debug(`[${this.name}]`, ...args);
    }

    /**
     * Логирует ошибку с именем солвера
     */
    protected logError(...args: unknown[]): void {
        logger.error(`[${this.name}]`, ...args);
    }

    /**
     * Создаёт результат успеха
     */
    protected success<T extends ISolverResult>(result: Omit<T, 'success'>): T {
        return { ...result, success: true } as T;
    }

    /**
     * Создаёт результат ошибки
     */
    protected failure(type: string, error: string): ISolverResult {
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
    protected click(element: Element): void {
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
    protected typeInput(input: HTMLInputElement, value: string): void {
        // Set value via native setter to trigger React's change detection
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
     * Извлекает текст из header (всегда в нижнем регистре)
     */
    protected getHeaderText(context: IChallengeContext): string {
        if (context.headerText) return context.headerText.toLowerCase();
        if (context.header?.textContent) {
            return context.header.textContent.toLowerCase();
        }
        return '';
    }

    /**
     * Проверяет, содержит ли header определённые слова
     */
    protected headerContains(context: IChallengeContext, ...words: string[]): boolean {
        const text = this.getHeaderText(context);
        return words.every(word => text.includes(word.toLowerCase()));
    }
}
