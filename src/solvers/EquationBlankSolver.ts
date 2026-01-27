/**
 * Солвер для уравнений с пропуском и выбором ответа
 *
 * Например: "_ + 4 = 7" с вариантами "1", "2", "3"
 * Нужно выбрать правильный вариант.
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, IEquationResult, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { evaluateMathExpression } from '../math/expressions';
import { solveEquationWithBlank } from '../math/equations';

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
        const answer = solveEquationWithBlank(equation);
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
}
