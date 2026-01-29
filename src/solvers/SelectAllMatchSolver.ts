/**
 * Солвер для заданий "Select all that match"
 * Выбирает все выражения, которые равны заданному значению
 *
 * Например: "X = 11 - 4" (X = 7)
 * Варианты: "10 - 3" (7), "14 - 70" (-56), "13 - 6" (7), "14 - 7" (7)
 * Нужно выбрать: "10 - 3", "13 - 6", "14 - 7"
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { evaluateMathExpression } from '../math/expressions';
import { SELECTORS } from '../dom/selectors';

interface ISelectAllMatchResult extends ISolverResult {
    type: 'selectAllMatch';
    targetValue: number;
    matchedChoices: number[];
}

export class SelectAllMatchSolver extends BaseSolver {
    readonly name = 'SelectAllMatchSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check header for "select all that match"
        const headerMatches = this.headerContains(context, 'select', 'all', 'match');
        if (!headerMatches) {
            return false;
        }

        // Check for choices
        if (!context.choices?.length) {
            return false;
        }

        // Check if choices are checkboxes (role="checkbox")
        const firstChoice = context.choices[0];
        if (!firstChoice) {
            return false;
        }

        const isCheckbox = firstChoice.getAttribute('role') === 'checkbox' ||
            firstChoice.hasAttribute('aria-checked');

        if (!isCheckbox) {
            return false;
        }

        // Check if there's an equation/condition container
        const equationContainer = context.container.querySelector(SELECTORS.EQUATION_CONTAINER);
        if (!equationContainer) {
            return false;
        }

        return true;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        if (!context.choices?.length) {
            return this.failure('selectAllMatch', 'no choices found');
        }

        // Find the equation/condition container
        const equationContainer = context.container.querySelector(SELECTORS.EQUATION_CONTAINER);
        if (!equationContainer) {
            return this.failure('selectAllMatch', 'equation container not found');
        }

        // Extract the condition (e.g., "X = 11 - 4")
        const conditionValue = extractKatexValue(equationContainer);
        if (!conditionValue) {
            return this.failure('selectAllMatch', 'could not extract condition');
        }

        this.log('condition:', conditionValue);

        // Parse the condition to extract the target value
        // Format: "X = 11 - 4" or "X=11-4" or "11-4" or "20=\duoblank{5}"
        let targetValue: number | null = null;

        // Check if there's a \duoblank pattern (e.g., "20=\duoblank{5}")
        // In this case, the target value is on the LEFT side of the equation
        if (conditionValue.includes('\\duoblank') || conditionValue.includes('duoblank')) {
            // Extract value from left side of equation (before "=")
            // Handle patterns like "20=" or "20 = " or "\mathbf{20}="
            const leftSideMatch = conditionValue.match(/^([^=]+?)\s*=/);
            if (leftSideMatch && leftSideMatch[1]) {
                let leftSide = leftSideMatch[1].trim();
                // Clean any remaining LaTeX wrappers
                leftSide = leftSide.replace(/\\mathbf\{([^}]+)\}/g, '$1');
                leftSide = leftSide.replace(/\\textbf\{([^}]+)\}/g, '$1');
                leftSide = leftSide.replace(/\s+/g, '');

                targetValue = evaluateMathExpression(leftSide);
                if (targetValue === null) {
                    // Fallback: try to parse as a simple number
                    const numberMatch = leftSide.match(/^(-?\d+(?:\.\d+)?)/);
                    if (numberMatch && numberMatch[1]) {
                        targetValue = parseFloat(numberMatch[1]);
                    }
                }
                this.log(`found duoblank pattern, extracted value from left side: ${leftSide} → ${targetValue}`);
            } else {
                // Fallback: try to extract number directly if left side is just a number
                const numberMatch = conditionValue.match(/^(-?\d+(?:\.\d+)?)/);
                if (numberMatch && numberMatch[1]) {
                    targetValue = parseFloat(numberMatch[1]);
                    this.log(`found duoblank pattern, extracted number from start: ${targetValue}`);
                }
            }
        } else {
            // Standard case: extract value after "="
            const equalsMatch = conditionValue.match(/=\s*([^=]+)$/);
            if (equalsMatch && equalsMatch[1]) {
                const expression = equalsMatch[1].trim();
                targetValue = evaluateMathExpression(expression);
                this.log(`extracted expression after '=': ${expression}`);
            } else {
                // If no "=" found, try to evaluate the whole expression
                // This handles cases where the condition is just an expression
                targetValue = evaluateMathExpression(conditionValue);
                this.log('evaluating whole condition as expression');
            }
        }

        if (targetValue === null) {
            return this.failure('selectAllMatch', `could not evaluate target value from: ${conditionValue}`);
        }

        this.log('target value:', targetValue);

        // Evaluate all choices and find matches
        const matchedIndices: number[] = [];

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const choiceValue = extractKatexValue(choice);
            if (!choiceValue) {
                this.log(`choice ${i}: could not extract value`);
                continue;
            }

            const choiceResult = evaluateMathExpression(choiceValue);
            if (choiceResult === null) {
                this.log(`choice ${i}: could not evaluate: ${choiceValue}`);
                continue;
            }

            this.log(`choice ${i}: ${choiceValue} = ${choiceResult}`);

            // Check if values match (with small tolerance for floating point)
            if (Math.abs(choiceResult - targetValue) < 0.0001) {
                matchedIndices.push(i);
                this.log(`matched choice ${i}: ${choiceValue} = ${choiceResult}`);
            }
        }

        if (matchedIndices.length === 0) {
            return this.failure('selectAllMatch', `no matching choices found for value: ${targetValue}`);
        }

        this.log(`found ${matchedIndices.length} matching choices:`, matchedIndices);

        // Click all matched choices
        for (const index of matchedIndices) {
            const choice = context.choices[index];
            if (!choice) {
                this.log(`warning: choice ${index} not found`);
                continue;
            }

            try {
                // For checkboxes, we need to click them to toggle
                (choice as HTMLElement).click();
                this.log(`clicked choice ${index}`);
            } catch (e) {
                this.log(`error clicking choice ${index}:`, e);
            }
        }

        return {
            type: 'selectAllMatch',
            success: true,
            targetValue,
            matchedChoices: matchedIndices,
        } as ISelectAllMatchResult;
    }
}
