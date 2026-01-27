/**
 * Решение уравнений с пропуском (X)
 */

import { evaluateMathExpression } from './expressions';
import { cleanLatexWrappers, cleanLatexForEval } from '../parsers/latex';
import { logger } from '../utils/logger';

/**
 * Решает уравнение с пропуском вида "A op X = B" или "X op A = B"
 *
 * @param equation - уравнение в формате LaTeX
 * @returns решение или null
 *
 * @example
 * solveEquationWithBlank('3 + \\duoblank{1} = 7') // 4
 * solveEquationWithBlank('X * 5 = 25') // 5
 */
export function solveEquationWithBlank(equation: string): number | null {
    logger.debug('solveEquationWithBlank: input', equation);

    // Clean the equation
    let cleaned = equation
        .replace(/\\duoblank\{[^}]*\}/g, 'X')
        .replace(/\s+/g, '');

    cleaned = cleanLatexWrappers(cleaned);
    cleaned = cleanLatexForEval(cleaned);

    logger.debug('solveEquationWithBlank: cleaned', cleaned);

    // Split by = to get left and right sides
    const parts = cleaned.split('=');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        logger.debug('solveEquationWithBlank: invalid equation format');
        return null;
    }

    const [left, right] = parts;

    // Optimization: If X is alone on one side
    if (right === 'X' && !left.includes('X')) {
        const result = evaluateMathExpression(left);
        if (result !== null) {
            logger.debug('solveEquationWithBlank: X alone on right, result =', result);
            return result;
        }
    }

    if (left === 'X' && !right.includes('X')) {
        const result = evaluateMathExpression(right);
        if (result !== null) {
            logger.debug('solveEquationWithBlank: X alone on left, result =', result);
            return result;
        }
    }

    // Determine which side has X and solve
    if (left.includes('X')) {
        return solveForX(left, right);
    } else if (right.includes('X')) {
        return solveForX(right, left);
    }

    logger.debug('solveEquationWithBlank: X not found');
    return null;
}

/**
 * Решает выражение с X относительно целевого значения
 *
 * @param exprWithX - выражение с X (например "X+4" или "3*X")
 * @param otherSide - другая сторона уравнения
 * @returns решение или null
 */
export function solveForX(exprWithX: string, otherSide: string): number | null {
    const target = evaluateMathExpression(otherSide);
    if (target === null) {
        logger.debug('solveForX: could not evaluate other side');
        return null;
    }

    // Try algebraic patterns first (faster)
    const algebraicResult = solveAlgebraically(exprWithX, target);
    if (algebraicResult !== null) {
        return algebraicResult;
    }

    // Fallback to brute force with extended range
    return solveBruteForce(exprWithX, target, -10000, 10000);
}

/**
 * Пытается решить алгебраически для простых паттернов
 */
function solveAlgebraically(exprWithX: string, target: number): number | null {
    const patterns: { pattern: RegExp; solve: (n: number) => number }[] = [
        { pattern: /^X$/, solve: (): number => target },
        { pattern: /^X\+(\d+)$/, solve: (n): number => target - n },
        { pattern: /^X-(\d+)$/, solve: (n): number => target + n },
        { pattern: /^(\d+)\+X$/, solve: (n): number => target - n },
        { pattern: /^(\d+)-X$/, solve: (n): number => n - target },
        { pattern: /^X\*(\d+)$/, solve: (n): number => target / n },
        { pattern: /^(\d+)\*X$/, solve: (n): number => target / n },
        { pattern: /^X\/(\d+)$/, solve: (n): number => target * n },
        { pattern: /^(\d+)\/X$/, solve: (n): number => n / target },
        // Patterns with parentheses
        { pattern: /^\(X\)\+(\d+)$/, solve: (n): number => target - n },
        { pattern: /^\(X\)-(\d+)$/, solve: (n): number => target + n },
        { pattern: /^\(X\)\*(\d+)$/, solve: (n): number => target / n },
        { pattern: /^\(X\)\/(\d+)$/, solve: (n): number => target * n },
    ];

    for (const { pattern, solve } of patterns) {
        const match = exprWithX.match(pattern);
        if (match) {
            const n = match[1] ? parseInt(match[1], 10) : 0;
            const result = solve(n);
            if (Number.isFinite(result)) {
                logger.debug('solveForX: algebraic solution X =', result);
                return result;
            }
        }
    }

    return null;
}

/**
 * Решает перебором в заданном диапазоне
 */
function solveBruteForce(
    exprWithX: string,
    target: number,
    min: number,
    max: number,
): number | null {
    // Try integer values first
    for (let x = min; x <= max; x++) {
        const testExpr = exprWithX.replace(/X/g, `(${x})`);
        const testResult = evaluateMathExpression(testExpr);

        if (testResult !== null && Math.abs(testResult - target) < 0.0001) {
            logger.debug('solveForX: brute force solution X =', x);
            return x;
        }
    }

    logger.debug('solveForX: no solution found in range', min, 'to', max);
    return null;
}

/**
 * Решает неравенство с пропуском
 *
 * @param inequality - неравенство в формате LaTeX
 * @param denominator - знаменатель для результата (если известен)
 * @returns дробь как строка "a/b" или null
 */
export function solveInequalityWithBlank(
    inequality: string,
    denominator?: number,
): string | null {
    let cleaned = cleanLatexWrappers(inequality);

    // Detect operator
    let operator: string | null = null;
    if (cleaned.includes('>=') || cleaned.includes('\\ge')) {
        operator = '>=';
    } else if (cleaned.includes('<=') || cleaned.includes('\\le')) {
        operator = '<=';
    } else if (cleaned.includes('>') || cleaned.includes('\\gt')) {
        operator = '>';
    } else if (cleaned.includes('<') || cleaned.includes('\\lt')) {
        operator = '<';
    }

    if (!operator) return null;

    // Normalize operators
    cleaned = cleaned
        .replace(/\\ge/g, '>=')
        .replace(/\\le/g, '<=')
        .replace(/\\gt/g, '>')
        .replace(/\\lt/g, '<');

    // Split by operator
    const operatorRegex = />=|<=|>|</;
    const parts = cleaned.split(operatorRegex);
    if (parts.length !== 2) return null;

    const [leftStr, rightStr] = parts;
    const leftHasBlank = leftStr?.includes('\\duoblank');
    const rightHasBlank = rightStr?.includes('\\duoblank');

    if (!leftHasBlank && !rightHasBlank) return null;

    // Get known value
    const knownSide = leftHasBlank ? rightStr : leftStr;
    if (!knownSide) return null;

    // Parse fraction from known side
    const fracMatch = knownSide.match(/\\frac\{(\d+)\}\{(\d+)\}/);
    let knownValue: number;
    let knownDenom: number;

    if (fracMatch?.[1] && fracMatch[2]) {
        const num = parseInt(fracMatch[1], 10);
        knownDenom = parseInt(fracMatch[2], 10);
        knownValue = num / knownDenom;
    } else {
        const numMatch = knownSide.match(/(\d+)/);
        if (!numMatch?.[1]) return null;
        knownValue = parseFloat(numMatch[1]);
        knownDenom = denominator ?? 1;
    }

    // Calculate target numerator based on inequality direction
    let targetNum: number;

    if (leftHasBlank) {
        // ? [op] known
        switch (operator) {
        case '>': targetNum = Math.floor(knownValue * knownDenom) + 1; break;
        case '>=': targetNum = Math.ceil(knownValue * knownDenom); break;
        case '<': targetNum = Math.ceil(knownValue * knownDenom) - 1; break;
        case '<=': targetNum = Math.floor(knownValue * knownDenom); break;
        default: return null;
        }
    } else {
        // known [op] ?
        switch (operator) {
        case '>': targetNum = Math.ceil(knownValue * knownDenom) - 1; break;
        case '>=': targetNum = Math.floor(knownValue * knownDenom); break;
        case '<': targetNum = Math.floor(knownValue * knownDenom) + 1; break;
        case '<=': targetNum = Math.ceil(knownValue * knownDenom); break;
        default: return null;
        }
    }

    if (targetNum <= 0) targetNum = 1;

    return `${targetNum}/${knownDenom}`;
}
