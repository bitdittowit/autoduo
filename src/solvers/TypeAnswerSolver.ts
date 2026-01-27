/**
 * Солвер для заданий с вводом ответа (Type the answer)
 *
 * Поддерживает:
 * - Уравнения с пропуском (X + 4 = 7)
 * - Упрощение дробей (2/4 -> 1/2)
 * - Неравенства с пропуском (5/5 > ?)
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, IEquationResult, IFractionResult, ISolverResult } from '../types';
import { simplifyFraction } from '../math/fractions';
import { evaluateMathExpression } from '../math/expressions';
import { parseFractionExpression } from '../parsers/FractionParser';
import { cleanLatexForEval, cleanLatexWrappers } from '../parsers/latex';

export class TypeAnswerSolver extends BaseSolver {
    readonly name = 'TypeAnswerSolver';

    /**
     * Проверяет, является ли задание заданием с вводом ответа
     * Это catch-all солвер для заданий с текстовым полем
     */
    canSolve(context: IChallengeContext): boolean {
        // Must have text input and equation container
        return context.textInput != null && context.equationContainer != null;
    }

    /**
     * Решает задание с вводом ответа
     */
    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.textInput || !context.equationContainer) {
            return this.failure('typeAnswer', 'missing textInput or equationContainer');
        }

        this.log('starting');

        // Extract equation from annotation
        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) {
            return this.failure('typeAnswer', 'annotation not found');
        }

        const equation = annotation.textContent;
        this.log('equation =', equation);

        // Try different solving strategies
        const result = this.trySolveSimplifyFraction(context.textInput, equation)
            ?? this.trySolveInequality(context.textInput, equation)
            ?? this.trySolveEquationWithBlank(context.textInput, equation);

        return result;
    }

    /**
     * Пробует решить как задание на упрощение дроби
     */
    private trySolveSimplifyFraction(
        textInput: HTMLInputElement,
        equation: string,
    ): IFractionResult | null {
        // Check if it's a simplify fraction type (no =, no \duoblank)
        if (equation.includes('=') || equation.includes('\\duoblank')) {
            return null;
        }

        this.log('detected SIMPLIFY FRACTION type');

        const fractionResult = parseFractionExpression(equation);
        if (!fractionResult) {
            this.logDebug('could not parse fraction from expression');
            return null;
        }

        this.log('parsed fraction:', `${fractionResult.numerator}/${fractionResult.denominator}`);

        // Simplify the fraction
        const simplified = simplifyFraction(fractionResult.numerator, fractionResult.denominator);
        this.log('simplified to:', `${simplified.numerator}/${simplified.denominator}`);

        // Format and type the answer
        const answer = `${simplified.numerator}/${simplified.denominator}`;
        this.typeInput(textInput, answer);
        this.log('typed answer:', answer);

        return this.success<IFractionResult>({
            type: 'simplifyFraction',
            original: fractionResult,
            simplified,
            answer,
        });
    }

    /**
     * Пробует решить как неравенство с пропуском
     */
    private trySolveInequality(
        textInput: HTMLInputElement,
        equation: string,
    ): IEquationResult | null {
        const hasInequality = equation.includes('>') || equation.includes('<') ||
            equation.includes('\\gt') || equation.includes('\\lt') ||
            equation.includes('\\ge') || equation.includes('\\le');
        const hasBlank = equation.includes('\\duoblank');

        if (!hasInequality || !hasBlank) {
            return null;
        }

        this.log('detected INEQUALITY with blank type');

        const answer = this.solveInequalityWithBlank(equation);
        if (answer === null) {
            this.logDebug('could not solve inequality');
            return null;
        }

        this.typeInput(textInput, answer);
        this.log('typed answer:', answer);

        return this.success<IEquationResult>({
            type: 'typeAnswer',
            equation,
            answer,
        });
    }

    /**
     * Пробует решить как уравнение с пропуском
     */
    private trySolveEquationWithBlank(
        textInput: HTMLInputElement,
        equation: string,
    ): IEquationResult | null {
        this.log('solving as equation with blank');

        const answer = this.solveEquationWithBlank(equation);
        if (answer === null) {
            return this.failure('typeAnswer', 'could not solve equation') as IEquationResult | null;
        }

        this.typeInput(textInput, answer.toString());
        this.log('typed answer:', answer);

        return this.success<IEquationResult>({
            type: 'typeAnswer',
            equation,
            answer,
        });
    }

    /**
     * Решает уравнение с пропуском (e.g., "_ + 4 = 7")
     */
    private solveEquationWithBlank(equation: string): number | null {
        // Clean and prepare the equation
        let cleaned = equation
            .replace(/\\duoblank\{[^}]*\}/g, 'X')  // Replace \duoblank with X
            .replace(/\s+/g, '');                   // Remove whitespace

        cleaned = cleanLatexWrappers(cleaned);
        cleaned = cleanLatexForEval(cleaned);

        this.logDebug('cleaned equation:', cleaned);

        // Split by = to get left and right sides
        const parts = cleaned.split('=');
        if (parts.length !== 2) {
            this.logDebug('equation does not have exactly one =');
            return null;
        }

        const [left, right] = parts;

        // Determine which side has X and solve
        if (left?.includes('X') && right) {
            return this.solveForX(left, right);
        } else if (right?.includes('X') && left) {
            return this.solveForX(right, left);
        }

        this.logDebug('X not found in equation');
        return null;
    }

    /**
     * Решает выражение с X
     */
    private solveForX(exprWithX: string, otherSide: string): number | null {
        const targetValue = evaluateMathExpression(otherSide);
        if (targetValue === null) {
            this.logDebug('could not evaluate other side');
            return null;
        }

        // Try different values for X using binary search or simple iteration
        // For simple cases like "X + 4" or "X - 3", we can solve algebraically
        const simplePatterns: { pattern: RegExp; solve: (n: number) => number }[] = [
            { pattern: /^X\+(\d+)$/, solve: (n: number): number => targetValue - n },
            { pattern: /^X-(\d+)$/, solve: (n: number): number => targetValue + n },
            { pattern: /^(\d+)\+X$/, solve: (n: number): number => targetValue - n },
            { pattern: /^(\d+)-X$/, solve: (n: number): number => n - targetValue },
            { pattern: /^X\*(\d+)$/, solve: (n: number): number => targetValue / n },
            { pattern: /^(\d+)\*X$/, solve: (n: number): number => targetValue / n },
            { pattern: /^X\/(\d+)$/, solve: (n: number): number => targetValue * n },
            { pattern: /^(\d+)\/X$/, solve: (n: number): number => n / targetValue },
            { pattern: /^X$/, solve: (): number => targetValue },
        ];

        for (const { pattern, solve } of simplePatterns) {
            const match = exprWithX.match(pattern);
            if (match) {
                const n = match[1] ? parseInt(match[1], 10) : 0;
                const result = solve(n);
                if (Number.isFinite(result) && Number.isInteger(result)) {
                    return result;
                }
            }
        }

        // Fallback: try brute force for small integers
        for (let x = -100; x <= 100; x++) {
            const testExpr = exprWithX.replace(/X/g, `(${x})`);
            const testResult = evaluateMathExpression(testExpr);
            if (testResult !== null && Math.abs(testResult - targetValue) < 0.0001) {
                return x;
            }
        }

        this.logDebug('could not solve for X');
        return null;
    }

    /**
     * Решает неравенство с пропуском
     */
    private solveInequalityWithBlank(equation: string): string | null {
        let cleaned = cleanLatexWrappers(equation);

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

        // Normalize the operator in the string
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

        // Find which side has the blank
        const leftHasBlank = leftStr?.includes('\\duoblank');
        const rightHasBlank = rightStr?.includes('\\duoblank');

        if (!leftHasBlank && !rightHasBlank) return null;

        // Evaluate the known side
        const knownSide = leftHasBlank ? rightStr : leftStr;
        if (!knownSide) return null;

        const fractionResult = parseFractionExpression(knownSide);
        if (!fractionResult) return null;

        const knownValue = fractionResult.value;
        const knownDenom = fractionResult.denominator;

        // Find a fraction that satisfies the inequality
        // Use the same denominator for simplicity
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

        // Return as fraction string
        if (targetNum <= 0) targetNum = 1; // Ensure positive
        return `${targetNum}/${knownDenom}`;
    }
}
