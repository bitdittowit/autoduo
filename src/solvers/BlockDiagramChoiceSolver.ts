/**
 * Солвер для заданий "Show this another way"
 *
 * Показывает блок-диаграмму и варианты ответов с числами.
 * Нужно выбрать число, соответствующее количеству блоков.
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractBlockDiagramValue } from '../parsers/BlockDiagramParser';
import { extractKatexValue } from '../parsers/KatexParser';
import { evaluateMathExpression } from '../math/expressions';

interface IBlockDiagramChoiceResult extends ISolverResult {
    type: 'blockDiagramChoice';
    blockValue: number;
    selectedChoice: number;
    selectedValue: number;
}

export class BlockDiagramChoiceSolver extends BaseSolver {
    readonly name = 'BlockDiagramChoiceSolver';

    canSolve(context: IChallengeContext): boolean {
        // Must have choices
        if (!context.choices?.length || context.choices.length < 2) {
            return false;
        }

        // Check for "Show this another way" or similar headers
        const headerMatches = this.headerContains(context, 'show', 'another', 'way');
        if (!headerMatches) {
            return false;
        }

        // Must have iframe with block diagram in the challenge
        const iframe = context.container.querySelector<HTMLIFrameElement>(
            'iframe[title="Math Web Element"]',
        );
        if (!iframe) {
            return false;
        }

        const srcdoc = iframe.getAttribute('srcdoc');
        if (!srcdoc?.includes('<svg') || !srcdoc.includes('<rect')) {
            return false;
        }

        return true;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        if (!context.choices?.length) {
            return this.failure('blockDiagramChoice', 'no choices found');
        }

        // Find the block diagram iframe
        const iframe = context.container.querySelector<HTMLIFrameElement>(
            'iframe[title="Math Web Element"]',
        );
        if (!iframe) {
            return this.failure('blockDiagramChoice', 'no iframe found');
        }

        const srcdoc = iframe.getAttribute('srcdoc');
        if (!srcdoc) {
            return this.failure('blockDiagramChoice', 'no srcdoc');
        }

        // Extract block diagram value
        const blockValue = extractBlockDiagramValue(srcdoc);
        if (blockValue === null) {
            return this.failure('blockDiagramChoice', 'could not extract block diagram value');
        }

        this.log('block diagram value:', blockValue);

        // Find choice with matching value
        let matchedIndex = -1;
        let matchedValue = 0;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            // Extract value from choice (KaTeX)
            const valueStr = extractKatexValue(choice);
            if (!valueStr) {
                this.log('choice', i, 'no KaTeX value');
                continue;
            }

            const value = evaluateMathExpression(valueStr);
            if (value === null) {
                this.log('choice', i, 'could not evaluate:', valueStr);
                continue;
            }

            this.log('choice', i, '=', value);

            if (Math.abs(value - blockValue) < 0.0001) {
                matchedIndex = i;
                matchedValue = value;
                this.log('found matching choice', i, ':', blockValue, '=', value);
                break;
            }
        }

        if (matchedIndex === -1) {
            return this.failure(
                'blockDiagramChoice',
                `no choice matches block value ${blockValue}`,
            );
        }

        const matchedChoice = context.choices[matchedIndex];
        if (matchedChoice) {
            this.click(matchedChoice);
            this.log('clicked choice', matchedIndex);
        }

        return this.success<IBlockDiagramChoiceResult>({
            type: 'blockDiagramChoice',
            blockValue,
            selectedChoice: matchedIndex,
            selectedValue: matchedValue,
        });
    }
}
