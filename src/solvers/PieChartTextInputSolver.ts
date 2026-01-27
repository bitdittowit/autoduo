/**
 * Солвер для заданий с круговой диаграммой и текстовым вводом
 *
 * Показывается круговая диаграмма, нужно ввести соответствующую дробь.
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, IFractionResult, ISolverResult } from '../types';
import { extractPieChartFraction } from '../parsers/PieChartParser';

export class PieChartTextInputSolver extends BaseSolver {
    readonly name = 'PieChartTextInputSolver';

    /**
     * Проверяет, является ли задание на ввод дроби по круговой диаграмме
     */
    canSolve(context: IChallengeContext): boolean {
        // Must have iframe with pie chart and text input
        if (!context.iframe || !context.textInput) return false;

        // Check if iframe contains a pie chart
        const srcdoc = context.iframe.getAttribute('srcdoc');
        if (!srcdoc) return false;

        return srcdoc.includes('<circle') || srcdoc.includes('fill="#');
    }

    /**
     * Решает задание
     */
    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.iframe || !context.textInput) {
            return this.failure('pieChartTextInput', 'missing iframe or textInput');
        }

        this.log('starting');

        const srcdoc = context.iframe.getAttribute('srcdoc');
        if (!srcdoc) {
            return this.failure('pieChartTextInput', 'no srcdoc in iframe');
        }

        const fraction = extractPieChartFraction(srcdoc);
        if (!fraction) {
            return this.failure('pieChartTextInput', 'could not extract fraction from pie chart');
        }

        this.log('extracted fraction:', `${fraction.numerator}/${fraction.denominator}`, '=', fraction.value);

        // Format as "numerator/denominator"
        const answer = `${fraction.numerator}/${fraction.denominator}`;
        this.typeInput(context.textInput, answer);
        this.log('typed answer:', answer);

        return this.success<IFractionResult>({
            type: 'selectFraction',
            original: fraction,
            answer,
        });
    }
}
