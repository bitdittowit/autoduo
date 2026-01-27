/**
 * Вычисление математических выражений
 */

import { logger } from '../utils/logger';
import { convertLatexOperators } from '../parsers/latex';

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
export function evaluateMathExpression(expr: string | null | undefined): number | null {
    if (!expr) {
        logger.debug('evaluateMathExpression: expression is null/empty');
        return null;
    }

    logger.debug('evaluateMathExpression: input', expr);

    // Clean the expression
    let cleaned = expr.toString()
        .replace(/\s+/g, '');        // Remove whitespace

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

        const result = new Function('return ' + cleaned)() as unknown;

        if (typeof result !== 'number' || !Number.isFinite(result)) {
            logger.warn('evaluateMathExpression: result is not a valid number', result);
            return null;
        }

        logger.debug('evaluateMathExpression: result', result);
        return result;
    } catch (e) {
        logger.error('evaluateMathExpression: eval error', e instanceof Error ? e.message : String(e));
        return null;
    }
}

/**
 * Проверяет, является ли строка валидным математическим выражением
 */
export function isValidMathExpression(expr: string): boolean {
    const cleaned = expr.replace(/\s+/g, '');
    return /^[\d+\-*/().]+$/.test(cleaned) && cleaned.length > 0;
}
