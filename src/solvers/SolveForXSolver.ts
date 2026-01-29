/**
 * Солвер для заданий "Solve for X" с выбором ответа
 *
 * Например: "3+X=19" с вариантами "22", "16", "15"
 * Нужно решить уравнение и выбрать правильный вариант.
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, IEquationResult, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { evaluateMathExpression } from '../math/expressions';
import { solveEquationWithBlank } from '../math/equations';

export class SolveForXSolver extends BaseSolver {
    readonly name = 'SolveForXSolver';

    /**
     * Проверяет, является ли задание "Solve for X" с выбором ответа
     */
    canSolve(context: IChallengeContext): boolean {
        if (!context.equationContainer || !context.choices?.length) return false;

        // Check header for "Solve for X" (case-insensitive)
        const headerText = context.headerText || '';
        const hasSolveForXHeader = headerText.includes('solve for x');

        if (!hasSolveForXHeader) return false;

        // Check if equation has X and equals sign
        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) return false;

        const text = annotation.textContent;
        // Check for X (case-insensitive) and equals sign
        // X can be in LaTeX format \mathbf{X} or just X
        // Pattern: \mathbf{X}, \mathbf{x}, or standalone X/x (not part of another word)
        const hasX = /\\mathbf\{[Xx]\}|[^a-zA-Z][Xx][^a-zA-Z]|^[Xx][^a-zA-Z]|[^a-zA-Z][Xx]$/.test(text);
        const hasEquals = text.includes('=');

        return hasX && hasEquals;
    }

    /**
     * Решает задание
     */
    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.equationContainer || !context.choices?.length) {
            return this.failure('solveForX', 'missing equationContainer or choices');
        }

        this.log('starting');

        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) {
            return this.failure('solveForX', 'annotation not found');
        }

        let equation = annotation.textContent;
        this.log('equation =', equation);

        // Replace \mathbf{X} or \mathbf{x} with X for solving
        // solveEquationWithBlank expects X (not \duoblank) for this type
        equation = equation.replace(/\\mathbf\{([Xx])\}/gi, 'X');
        // Also handle plain X/x in LaTeX context (ensure it's uppercase X)
        equation = equation.replace(/\b([Xx])\b/g, 'X');

        // Solve for X
        const answer = solveEquationWithBlank(equation);
        if (answer === null) {
            return this.failure('solveForX', 'could not solve equation');
        }

        this.log('solved answer =', answer);

        // Find and click matching choice
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
                this.click(choice);
                this.log('found matching choice at index', i);
                this.log('clicked choice', i);

                return this.success<IEquationResult>({
                    type: 'solveForX',
                    equation,
                    answer,
                    selectedChoice: i,
                });
            }
        }

        return this.failure('solveForX', `no matching choice for answer ${answer}`);
    }
}
