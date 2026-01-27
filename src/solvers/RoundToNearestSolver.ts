/**
 * Солвер для заданий "Round to the nearest X"
 *
 * Поддерживает два режима:
 * 1. С выбором ответа (блок-диаграммы или KaTeX числа)
 * 2. С вводом ответа (текстовое поле)
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, IRoundingResult, ISolverResult } from '../types';
import { roundToNearest, extractRoundingBase } from '../math/rounding';
import { extractBlockDiagramValue } from '../parsers/BlockDiagramParser';
import { cleanAnnotationText } from '../parsers/KatexParser';

export class RoundToNearestSolver extends BaseSolver {
    readonly name = 'RoundToNearestSolver';

    /**
     * Проверяет, является ли задание заданием на округление
     */
    canSolve(context: IChallengeContext): boolean {
        return this.headerContains(context, 'round', 'nearest');
    }

    /**
     * Решает задание на округление
     */
    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        // Extract rounding base from header
        const headerText = this.getHeaderText(context);
        const roundingBase = extractRoundingBase(headerText);

        if (!roundingBase) {
            return this.failure('roundToNearest', 'could not extract rounding base from header');
        }

        this.log('rounding base =', roundingBase);

        // Extract number to round from equation container
        const numberToRound = this.extractNumberToRound(context);

        if (numberToRound === null) {
            return this.failure('roundToNearest', 'could not extract number to round');
        }

        // Calculate rounded value
        const roundedValue = roundToNearest(numberToRound, roundingBase);
        this.log(numberToRound, 'rounds to', roundedValue);

        // Solve based on input type
        if (context.textInput) {
            return this.solveWithTextInput(context.textInput, numberToRound, roundingBase, roundedValue);
        }

        if (context.choices && context.choices.length > 0) {
            return this.solveWithChoices(context.choices, numberToRound, roundingBase, roundedValue);
        }

        return this.failure('roundToNearest', 'no text input or choices found');
    }

    /**
     * Извлекает число для округления из контекста
     */
    private extractNumberToRound(context: IChallengeContext): number | null {
        if (!context.equationContainer) {
            this.logError('equationContainer is null');
            return null;
        }

        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) {
            this.logError('annotation not found');
            return null;
        }

        const cleaned = cleanAnnotationText(annotation.textContent);
        const number = parseInt(cleaned, 10);

        if (Number.isNaN(number)) {
            this.logError('could not parse number from:', cleaned);
            return null;
        }

        this.log('number to round =', number);
        return number;
    }

    /**
     * Решает задание с текстовым вводом
     */
    private solveWithTextInput(
        textInput: HTMLInputElement,
        numberToRound: number,
        roundingBase: number,
        roundedValue: number,
    ): IRoundingResult {
        this.typeInput(textInput, roundedValue.toString());
        this.log('typed answer:', roundedValue);

        return this.success<IRoundingResult>({
            type: 'roundToNearest',
            numberToRound,
            roundingBase,
            roundedValue,
            answer: roundedValue,
        });
    }

    /**
     * Решает задание с выбором ответа
     */
    private solveWithChoices(
        choices: Element[],
        numberToRound: number,
        roundingBase: number,
        roundedValue: number,
    ): IRoundingResult | null {
        let matchedIndex = -1;

        for (let i = 0; i < choices.length; i++) {
            const choice = choices[i];
            if (!choice) continue;

            // Try block diagram first
            const blockValue = this.getBlockDiagramValue(choice);
            if (blockValue !== null) {
                this.logDebug('choice', i, 'has', blockValue, 'blocks');
                if (blockValue === roundedValue) {
                    matchedIndex = i;
                    this.log('found matching choice', i, 'with', blockValue, 'blocks');
                    break;
                }
                continue;
            }

            // Try KaTeX number
            const katexValue = this.getKatexValue(choice);
            if (katexValue !== null) {
                this.logDebug('choice', i, 'KaTeX value =', katexValue);
                if (katexValue === roundedValue) {
                    matchedIndex = i;
                    this.log('found matching choice', i, 'with KaTeX value', katexValue);
                    break;
                }
            }
        }

        if (matchedIndex === -1) {
            return this.failure(
                'roundToNearest',
                `no matching choice found for rounded value ${roundedValue}`,
            ) as IRoundingResult | null;
        }

        const matchedChoice = choices[matchedIndex];
        if (matchedChoice) {
            this.click(matchedChoice);
            this.log('clicked choice', matchedIndex);
        }

        return this.success<IRoundingResult>({
            type: 'roundToNearest',
            numberToRound,
            roundingBase,
            roundedValue,
            selectedChoice: matchedIndex,
        });
    }

    /**
     * Извлекает значение из блок-диаграммы в choice
     */
    private getBlockDiagramValue(choice: Element): number | null {
        const iframe = choice.querySelector('iframe[title="Math Web Element"]');
        if (!iframe) return null;

        const srcdoc = iframe.getAttribute('srcdoc');
        if (!srcdoc) return null;

        return extractBlockDiagramValue(srcdoc);
    }

    /**
     * Извлекает числовое значение из KaTeX в choice
     */
    private getKatexValue(choice: Element): number | null {
        const annotation = choice.querySelector('annotation');
        if (!annotation?.textContent) return null;

        const cleaned = cleanAnnotationText(annotation.textContent);
        const value = parseInt(cleaned, 10);

        return Number.isNaN(value) ? null : value;
    }
}
