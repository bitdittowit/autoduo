/**
 * Солвер для выбора дроби по круговой диаграмме
 *
 * Показывается pie chart, нужно выбрать соответствующую дробь из вариантов
 * Это обратный случай от SelectPieChartSolver
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractPieChartFraction } from '../parsers/PieChartParser';
import { parseFractionExpression } from '../parsers/FractionParser';
import { extractLatexContent } from '../parsers/latex';
import { findAllIframes } from '../dom/selectors';

interface IPieChartSelectFractionResult extends ISolverResult {
    type: 'pieChartSelectFraction';
    pieChartNumerator: number;
    pieChartDenominator: number;
    selectedChoice: number;
}

export class PieChartSelectFractionSolver extends BaseSolver {
    readonly name = 'PieChartSelectFractionSolver';

    canSolve(context: IChallengeContext): boolean {
        if (!context.choices?.length) return false;

        // Must have an iframe with pie chart (not in choices)
        const allIframes = findAllIframes(context.container);

        // Check if there's a pie chart iframe that's NOT inside a choice
        for (const iframe of allIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc?.includes('<svg')) continue;

            // Check if this iframe is inside a choice
            const isInChoice = context.choices.some(choice =>
                choice?.contains(iframe),
            );

            if (!isInChoice) {
                // Found pie chart outside choices
                // Now check if choices have text fractions (not pie charts)
                const choicesHaveText = context.choices.some(choice => {
                    const annotation = choice?.querySelector('annotation');
                    return annotation?.textContent?.includes('frac') ||
                           annotation?.textContent?.includes('/');
                });

                if (choicesHaveText) {
                    return true;
                }
            }
        }

        return false;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.choices?.length) {
            return this.failure('pieChartSelectFraction', 'no choices found');
        }

        this.log('starting');

        // Find the pie chart iframe
        const allIframes = findAllIframes(context.container);
        let pieChartSrcdoc: string | null = null;

        for (const iframe of allIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc?.includes('<svg')) continue;

            const isInChoice = context.choices.some(choice =>
                choice?.contains(iframe),
            );

            if (!isInChoice) {
                pieChartSrcdoc = srcdoc;
                break;
            }
        }

        if (!pieChartSrcdoc) {
            return this.failure('pieChartSelectFraction', 'no pie chart found');
        }

        // Extract fraction from pie chart
        const pieChartFraction = extractPieChartFraction(pieChartSrcdoc);
        if (!pieChartFraction) {
            return this.failure('pieChartSelectFraction', 'could not extract pie chart fraction');
        }

        this.log(
            'pie chart shows',
            `${pieChartFraction.numerator}/${pieChartFraction.denominator}`,
            '=',
            pieChartFraction.value,
        );

        // Find matching choice
        let matchedChoiceIndex = -1;
        let exactMatchIndex = -1;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const annotation = choice.querySelector('annotation');
            if (!annotation?.textContent) continue;

            let choiceText = annotation.textContent;

            // Clean LaTeX wrappers
            while (choiceText.includes('\\mathbf{')) {
                choiceText = extractLatexContent(choiceText, '\\mathbf');
            }
            while (choiceText.includes('\\textbf{')) {
                choiceText = extractLatexContent(choiceText, '\\textbf');
            }

            // Parse the fraction
            const choiceFraction = parseFractionExpression(choiceText);
            if (!choiceFraction) {
                this.logDebug('choice', i, 'could not parse fraction');
                continue;
            }

            this.log(
                'choice',
                i,
                '=',
                `${choiceFraction.numerator}/${choiceFraction.denominator}`,
                '=',
                choiceFraction.value,
            );

            // Check for exact match first
            const exactMatch =
                choiceFraction.numerator === pieChartFraction.numerator &&
                choiceFraction.denominator === pieChartFraction.denominator;

            // Check for value match (equivalent fractions)
            const valueMatch =
                Math.abs(choiceFraction.value - pieChartFraction.value) < 0.0001;

            if (exactMatch) {
                exactMatchIndex = i;
                this.log('EXACT MATCH at choice', i);
                break;
            } else if (valueMatch && matchedChoiceIndex === -1) {
                matchedChoiceIndex = i;
                this.log('VALUE MATCH at choice', i);
                // Don't break - continue looking for exact match
            }
        }

        // Prefer exact match over value match
        const finalIndex = exactMatchIndex !== -1 ? exactMatchIndex : matchedChoiceIndex;

        if (finalIndex === -1) {
            return this.failure(
                'pieChartSelectFraction',
                `no matching choice for ${pieChartFraction.numerator}/${pieChartFraction.denominator}`,
            );
        }

        // Click the matched choice
        const matchedChoice = context.choices[finalIndex];
        if (matchedChoice) {
            this.log('clicking choice', finalIndex);
            this.click(matchedChoice);
        }

        return this.success<IPieChartSelectFractionResult>({
            type: 'pieChartSelectFraction',
            pieChartNumerator: pieChartFraction.numerator,
            pieChartDenominator: pieChartFraction.denominator,
            selectedChoice: finalIndex,
        });
    }
}
