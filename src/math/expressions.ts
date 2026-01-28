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
 * Supports exponentiation (**)
 */
export function isValidMathExpression(expr: string): boolean {
    const cleaned = expr.replace(/\s+/g, '');
    // Allow ** for exponentiation
    const cleanedForValidation = cleaned.replace(/\*\*/g, '');
    return /^[\d+\-*/().]+$/.test(cleanedForValidation) && cleaned.length > 0;
}
