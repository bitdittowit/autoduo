/**
 * Парсер для дробей из LaTeX выражений
 */

import { logger } from '../utils/logger';
import type { IFraction, ISimplifiedFraction } from '../types';
import { extractLatexContent, convertLatexFractions } from './latex';
import { evaluateMathExpression } from '../math/expressions';

/**
 * Парсит дробь из LaTeX выражения
 *
 * Поддерживает форматы:
 * - \frac{a}{b}
 * - a/b
 * - Составные выражения: \frac{1}{5}+\frac{2}{5}
 *
 * @param expr - LaTeX выражение
 * @returns объект с числителем, знаменателем и значением, или null
 *
 * @example
 * parseFractionExpression('\\frac{1}{2}') // { numerator: 1, denominator: 2, value: 0.5 }
 * parseFractionExpression('3/4') // { numerator: 3, denominator: 4, value: 0.75 }
 */
export function parseFractionExpression(expr: string): ISimplifiedFraction | null {
    logger.debug('parseFractionExpression: input', expr);

    let cleaned = expr;

    // Remove LaTeX wrappers
    while (cleaned.includes('\\mathbf{')) {
        cleaned = extractLatexContent(cleaned, '\\mathbf');
    }
    while (cleaned.includes('\\textbf{')) {
        cleaned = extractLatexContent(cleaned, '\\textbf');
    }

    logger.debug('parseFractionExpression: after removing wrappers:', cleaned);

    // Try to match single \frac{numerator}{denominator} (whole string)
    const fracMatch = cleaned.match(/^\\frac\{(\d+)\}\{(\d+)\}$/);
    if (fracMatch?.[1] && fracMatch[2]) {
        const numerator = parseInt(fracMatch[1], 10);
        const denominator = parseInt(fracMatch[2], 10);
        return {
            numerator,
            denominator,
            value: numerator / denominator,
        };
    }

    // Try simple fraction format: number/number
    const simpleFracMatch = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (simpleFracMatch?.[1] && simpleFracMatch[2]) {
        const numerator = parseInt(simpleFracMatch[1], 10);
        const denominator = parseInt(simpleFracMatch[2], 10);
        return {
            numerator,
            denominator,
            value: numerator / denominator,
        };
    }

    // Try to evaluate expression with multiple fractions
    // Convert all \frac to (a/b)
    cleaned = convertLatexFractions(cleaned);
    cleaned = cleaned.replace(/\s+/g, '');

    logger.debug('parseFractionExpression: converted expression:', cleaned);

    // If it's a compound expression with + or -, evaluate it
    if (cleaned.includes('+') || cleaned.includes('-')) {
        const result = evaluateMathExpression(cleaned);
        if (result !== null) {
            // Try to convert back to a simple fraction
            // Find a reasonable denominator (try common ones)
            const commonDenominators = [2, 3, 4, 5, 6, 8, 10, 12, 100];
            for (const testDenom of commonDenominators) {
                const testNum = Math.round(result * testDenom);
                if (Math.abs(testNum / testDenom - result) < 0.0001) {
                    return {
                        numerator: testNum,
                        denominator: testDenom,
                        value: result,
                    };
                }
            }
        }
    }

    return null;
}

/**
 * Извлекает простую дробь из строки формата "a/b"
 *
 * @param str - строка с дробью
 * @returns объект дроби или null
 */
export function parseSimpleFraction(str: string): IFraction | null {
    const match = str.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
    if (!match?.[1] || !match[2]) return null;

    const numerator = parseInt(match[1], 10);
    const denominator = parseInt(match[2], 10);

    if (Number.isNaN(numerator) || Number.isNaN(denominator) || denominator === 0) {
        return null;
    }

    return { numerator, denominator };
}

/**
 * Проверяет, является ли строка дробью
 */
export function isFractionString(str: string): boolean {
    return /^\d+\s*\/\s*\d+$/.test(str.trim()) || /\\frac\{\d+\}\{\d+\}/.test(str);
}
