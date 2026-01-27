/**
 * Солвер для заданий "Select the equivalent fraction"
 *
 * Находит дробь с равным значением среди вариантов ответа.
 * Например: 2/4 эквивалентна 1/2
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, IFractionResult, ISolverResult } from '../types';
import { parseFractionExpression } from '../parsers/FractionParser';
import { areFractionsEqual } from '../math/fractions';

export class SelectEquivalentFractionSolver extends BaseSolver {
    readonly name = 'SelectEquivalentFractionSolver';

    /**
     * Проверяет, является ли задание на выбор эквивалентной дроби
     */
    canSolve(context: IChallengeContext): boolean {
        // Check header for "equivalent" or "equal"
        const headerText = this.getHeaderText(context);
        const isEquivalent = headerText.includes('equivalent') ||
            headerText.includes('equal') ||
            headerText.includes('same');

        // Must have choices and equation container with fraction
        const hasChoices = context.choices != null && context.choices.length > 0;
        const hasEquation = context.equationContainer != null;

        return isEquivalent && hasChoices && hasEquation;
    }

    /**
     * Решает задание
     */
    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.equationContainer || !context.choices?.length) {
            return this.failure('selectFraction', 'missing equationContainer or choices');
        }

        this.log('starting');

        // Extract target fraction from equation
        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) {
            return this.failure('selectFraction', 'annotation not found');
        }

        const targetFraction = parseFractionExpression(annotation.textContent);
        if (!targetFraction) {
            return this.failure('selectFraction', 'could not parse target fraction');
        }

        this.log('target =', `${targetFraction.numerator}/${targetFraction.denominator}`, '=', targetFraction.value);

        // Find equivalent fraction among choices
        let matchedIndex = -1;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const choiceAnnotation = choice.querySelector('annotation');
            if (!choiceAnnotation?.textContent) continue;

            const choiceFraction = parseFractionExpression(choiceAnnotation.textContent);
            if (!choiceFraction) continue;

            this.logDebug('choice', i, '=', `${choiceFraction.numerator}/${choiceFraction.denominator}`);

            if (areFractionsEqual(
                targetFraction.numerator,
                targetFraction.denominator,
                choiceFraction.numerator,
                choiceFraction.denominator,
            )) {
                matchedIndex = i;
                this.log('found equivalent at choice', i);
                break;
            }
        }

        if (matchedIndex === -1) {
            return this.failure('selectFraction', 'no equivalent fraction found');
        }

        const matchedChoice = context.choices[matchedIndex];
        if (matchedChoice) {
            this.click(matchedChoice);
            this.log('clicked choice', matchedIndex);
        }

        return this.success<IFractionResult>({
            type: 'selectFraction',
            original: targetFraction,
            selectedChoice: matchedIndex,
        });
    }
}
