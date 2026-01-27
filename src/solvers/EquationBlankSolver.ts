/**
 * Солвер для уравнений с пропуском и выбором ответа
 *
 * Например: "_ + 4 = 7" с вариантами "1", "2", "3"
 * Нужно выбрать правильный вариант.
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, IEquationResult, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { cleanLatexWrappers, convertLatexFractions, convertLatexOperators } from '../parsers/latex';
import { evaluateMathExpression } from '../math/expressions';

export class EquationBlankSolver extends BaseSolver {
    readonly name = 'EquationBlankSolver';

    /**
     * Проверяет, является ли задание уравнением с пропуском и выбором
     */
    canSolve(context: IChallengeContext): boolean {
        if (!context.equationContainer || !context.choices?.length) return false;

        // Check if equation has blank and equals sign
        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) return false;

        const text = annotation.textContent;
        return text.includes('\\duoblank') && text.includes('=');
    }

    /**
     * Решает задание
     */
    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.equationContainer || !context.choices?.length) {
            return this.failure('equationBlank', 'missing equationContainer or choices');
        }

        this.log('starting');

        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) {
            return this.failure('equationBlank', 'annotation not found');
        }

        const equation = annotation.textContent;
        this.log('equation =', equation);

        // Solve for the blank
        const answer = this.solveEquation(equation);
        if (answer === null) {
            return this.failure('equationBlank', 'could not solve equation');
        }

        this.log('solved answer =', answer);

        // Find and click matching choice(s)
        const matchingIndices: number[] = [];
        const isMultiSelect = context.choices[0]?.getAttribute('role') === 'checkbox';

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const choiceValue = extractKatexValue(choice);
            if (choiceValue === null) continue;

            this.logDebug('choice', i, '=', choiceValue);

            // Try to evaluate as expression or parse as number
            let choiceNum: number | null = null;

            if (/[+\-*/]/.test(choiceValue)) {
                choiceNum = evaluateMathExpression(choiceValue);
            } else {
                choiceNum = parseFloat(choiceValue);
                if (Number.isNaN(choiceNum)) choiceNum = null;
            }

            if (choiceNum !== null && Math.abs(choiceNum - answer) < 0.0001) {
                matchingIndices.push(i);
                this.log('found matching choice at index', i);

                if (!isMultiSelect) break;
            }
        }

        if (matchingIndices.length === 0) {
            return this.failure('equationBlank', `no matching choice for answer ${answer}`);
        }

        // Click matching choices
        for (const idx of matchingIndices) {
            const choice = context.choices[idx];
            if (choice) {
                this.click(choice);
                this.log('clicked choice', idx);
            }
        }

        const firstMatch = matchingIndices[0];
        if (firstMatch === undefined) {
            return this.failure('equationBlank', 'unexpected: no matching indices');
        }

        return this.success<IEquationResult>({
            type: 'equationBlank',
            equation,
            answer,
            selectedChoice: firstMatch,
        });
    }

    /**
     * Решает уравнение с пропуском
     */
    private solveEquation(equation: string): number | null {
        let cleaned = equation
            .replace(/\\duoblank\{[^}]*\}/g, 'X')
            .replace(/\s+/g, '');

        cleaned = cleanLatexWrappers(cleaned);
        cleaned = convertLatexOperators(cleaned);
        cleaned = convertLatexFractions(cleaned);

        // Split by = to get both sides
        const parts = cleaned.split('=');
        if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

        const [left, right] = parts;

        // Determine which side has X
        if (left.includes('X')) {
            return this.solveForX(left, right);
        } else if (right.includes('X')) {
            return this.solveForX(right, left);
        }

        return null;
    }

    /**
     * Решает выражение относительно X
     */
    private solveForX(exprWithX: string, otherSide: string): number | null {
        const target = evaluateMathExpression(otherSide);
        if (target === null) return null;

        // Simple patterns
        const patterns: { pattern: RegExp; solve: (n: number) => number }[] = [
            { pattern: /^X\+(\d+)$/, solve: (n: number): number => target - n },
            { pattern: /^X-(\d+)$/, solve: (n: number): number => target + n },
            { pattern: /^(\d+)\+X$/, solve: (n: number): number => target - n },
            { pattern: /^(\d+)-X$/, solve: (n: number): number => n - target },
            { pattern: /^X\*(\d+)$/, solve: (n: number): number => target / n },
            { pattern: /^(\d+)\*X$/, solve: (n: number): number => target / n },
            { pattern: /^X\/(\d+)$/, solve: (n: number): number => target * n },
            { pattern: /^X$/, solve: (): number => target },
        ];

        for (const { pattern, solve } of patterns) {
            const match = exprWithX.match(pattern);
            if (match) {
                const n = match[1] ? parseInt(match[1], 10) : 0;
                const result = solve(n);
                if (Number.isFinite(result)) return result;
            }
        }

        // Brute force for complex expressions
        for (let x = -100; x <= 100; x++) {
            const testExpr = exprWithX.replace(/X/g, `(${x})`);
            const testResult = evaluateMathExpression(testExpr);
            if (testResult !== null && Math.abs(testResult - target) < 0.0001) {
                return x;
            }
        }

        return null;
    }
}
