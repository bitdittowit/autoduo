/**
 * Задержка выполнения
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Проверяет, является ли значение числом
 */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);
}

/**
 * Безопасный parseInt с проверкой результата
 */
export function safeParseInt(value: string): number | null {
    const parsed = parseInt(value, 10);
    return isNumber(parsed) ? parsed : null;
}

/**
 * Безопасный parseFloat с проверкой результата
 */
export function safeParseFloat(value: string): number | null {
    const parsed = parseFloat(value);
    return isNumber(parsed) ? parsed : null;
}

/**
 * Убирает лишние пробелы из строки
 */
export function normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, ' ').trim();
}

/**
 * Проверяет, содержит ли строка только цифры
 */
export function isDigitsOnly(str: string): boolean {
    return /^\d+$/.test(str);
}

/**
 * Clamp значение в диапазон
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
