/**
 * Солвер для заданий с выбором круговой диаграммы
 *
 * Показывается уравнение (например, 1/3 + 1/3 = ?) или дробь (1/4),
 * и несколько вариантов круговых диаграмм. Нужно выбрать подходящую.
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractPieChartFraction, isPieChart } from '../parsers/PieChartParser';
import { isBlockDiagram } from '../parsers/BlockDiagramParser';
import { cleanLatexWrappers, convertLatexFractions } from '../parsers/latex';
import { evaluateMathExpression } from '../math/expressions';

interface ISelectPieChartResult extends ISolverResult {
    type: 'selectPieChart';
    targetValue: number;
    selectedChoice: number;
}

export class SelectPieChartSolver extends BaseSolver {
    readonly name = 'SelectPieChartSolver';

    /**
     * Проверяет, является ли задание на выбор круговой диаграммы
     */
    canSolve(context: IChallengeContext): boolean {
        if (!context.choices?.length) return false;

        // Exclude "Show this another way" challenges with block diagrams
        // These should be handled by BlockDiagramChoiceSolver
        const headerMatches = this.headerContains(context, 'show', 'another', 'way');
        if (headerMatches) {
            // Check if main challenge has a block diagram
            const mainIframe = context.container.querySelector<HTMLIFrameElement>(
                'iframe[title="Math Web Element"]',
            );
            if (mainIframe) {
                const srcdoc = mainIframe.getAttribute('srcdoc');
                if (srcdoc && isBlockDiagram(srcdoc)) {
                    // This is a block diagram choice challenge, not a pie chart challenge
                    return false;
                }
            }
        }

        // Check if choices contain pie chart iframes (not block diagrams)
        const hasPieChartChoices = context.choices.some(choice => {
            const iframe = choice?.querySelector('iframe[title="Math Web Element"]');
            if (!iframe) return false;
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) return false;

            // Explicitly exclude block diagrams
            if (isBlockDiagram(srcdoc)) {
                return false;
            }

            // Check if it's actually a pie chart
            return isPieChart(srcdoc);
        });

        return hasPieChartChoices;
    }

    /**
     * Решает задание
     */
    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.choices?.length) {
            return this.failure('selectPieChart', 'no choices found');
        }

        this.log('starting');

        // Get target value from equation
        const targetValue = this.extractTargetValue(context);
        if (targetValue === null) {
            return this.failure('selectPieChart', 'could not determine target value');
        }

        this.log('target value =', targetValue);

        // Find matching pie chart
        let matchedIndex = -1;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const iframe = choice.querySelector('iframe[title="Math Web Element"]');
            if (!iframe) continue;

            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            const fraction = extractPieChartFraction(srcdoc);
            if (!fraction) continue;

            this.logDebug('choice', i, '=', `${fraction.numerator}/${fraction.denominator}`, '=', fraction.value);

            // Check if values match (with tolerance for floating point)
            if (Math.abs(fraction.value - targetValue) < 0.0001) {
                matchedIndex = i;
                this.log('found matching choice', i);
                break;
            }
        }

        if (matchedIndex === -1) {
            return this.failure('selectPieChart', 'no matching pie chart found');
        }

        const matchedChoice = context.choices[matchedIndex];
        if (matchedChoice) {
            this.click(matchedChoice);
            this.log('clicked choice', matchedIndex);
        }

        return this.success<ISelectPieChartResult>({
            type: 'selectPieChart',
            targetValue,
            selectedChoice: matchedIndex,
        });
    }

    /**
     * Извлекает целевое значение из уравнения
     */
    private extractTargetValue(context: IChallengeContext): number | null {
        if (!context.equationContainer) return null;

        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) return null;

        const equation = annotation.textContent;
        this.log('equation =', equation);

        // Clean and convert the expression
        let cleaned = cleanLatexWrappers(equation);
        cleaned = cleaned.replace(/\\duoblank\{[^}]*\}/g, '');
        cleaned = convertLatexFractions(cleaned);
        cleaned = cleaned.replace(/\s+/g, '');

        // If there's an = sign, evaluate the left side
        if (cleaned.includes('=')) {
            const leftSide = cleaned.split('=')[0];
            if (leftSide) {
                return evaluateMathExpression(leftSide);
            }
        }

        // Otherwise evaluate the whole expression
        return evaluateMathExpression(cleaned);
    }
}
