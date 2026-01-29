/**
 * Solver for "Show this another way" challenges
 *
 * Converts fraction to decimal and selects the correct answer.
 * Example: 8/10 → 0.8
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { parseFractionExpression } from '../parsers/FractionParser';
import { extractKatexValue } from '../parsers/KatexParser';

interface IFractionToDecimalResult extends ISolverResult {
    type: 'fractionToDecimal';
    fraction: { numerator: number; denominator: number };
    decimal: number;
    selectedChoice: number;
}

export class FractionToDecimalChoiceSolver extends BaseSolver {
    readonly name = 'FractionToDecimalChoiceSolver';

    /**
     * Checks if this is a "show another way" challenge
     */
    canSolve(context: IChallengeContext): boolean {
        // Check header
        const headerText = this.getHeaderText(context);
        const isShowAnotherWay =
            headerText.includes('another') &&
            (headerText.includes('way') || headerText.includes('show'));

        // Must have choices and equation container
        const hasChoices = context.choices != null && context.choices.length > 0;
        const hasEquation = context.equationContainer != null;

        if (!isShowAnotherWay || !hasChoices || !hasEquation || !context.equationContainer) {
            return false;
        }

        // Check if equation contains a fraction (not just a decimal or integer)
        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) return false;

        const hasFraction =
            annotation.textContent.includes('\\frac') || annotation.textContent.includes('/');

        return hasFraction;
    }

    /**
     * Solves the challenge
     */
    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.equationContainer || !context.choices?.length) {
            return this.failure('fractionToDecimal', 'missing equationContainer or choices');
        }

        this.log('starting');

        // Extract fraction from equation
        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) {
            return this.failure('fractionToDecimal', 'annotation not found');
        }

        const fraction = parseFractionExpression(annotation.textContent);
        if (!fraction) {
            return this.failure('fractionToDecimal', 'could not parse fraction');
        }

        const targetValue = fraction.value;
        this.log(
            'fraction =',
            `${fraction.numerator}/${fraction.denominator}`,
            '=',
            targetValue,
        );

        // Find matching choice
        let matchedIndex = -1;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            // Extract value from choice
            const choiceValue = extractKatexValue(choice);
            if (!choiceValue) continue;

            // Parse as number
            const choiceNum = parseFloat(choiceValue);
            if (isNaN(choiceNum)) continue;

            this.logDebug('choice', i, '=', choiceNum);

            // Compare with tolerance for floating point
            if (Math.abs(choiceNum - targetValue) < 0.0001) {
                matchedIndex = i;
                this.log('found match at choice', i);
                break;
            }
        }

        if (matchedIndex === -1) {
            return this.failure('fractionToDecimal', 'no matching decimal found');
        }

        // Click the choice
        const matchedChoice = context.choices[matchedIndex];
        if (matchedChoice) {
            this.click(matchedChoice);
            this.log('clicked choice', matchedIndex);
        }

        return this.success<IFractionToDecimalResult>({
            type: 'fractionToDecimal',
            fraction: {
                numerator: fraction.numerator,
                denominator: fraction.denominator,
            },
            decimal: targetValue,
            selectedChoice: matchedIndex,
        });
    }
}
