/**
 * Солвер для заданий с блок-диаграммой и текстовым вводом
 *
 * Показывает блок-диаграмму и требует ввести число в текстовое поле.
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractBlockDiagramValue, isBlockDiagram } from '../parsers/BlockDiagramParser';

interface IBlockDiagramTextInputResult extends ISolverResult {
    type: 'blockDiagramTextInput';
    blockValue: number;
    typedAnswer: string;
}

export class BlockDiagramTextInputSolver extends BaseSolver {
    readonly name = 'BlockDiagramTextInputSolver';

    canSolve(context: IChallengeContext): boolean {
        // Must have text input
        const textInput = context.container.querySelector<HTMLInputElement>(
            'input[type="text"][data-test="challenge-text-input"]',
        );
        if (!textInput) {
            return false;
        }

        // Must have iframe with block diagram
        const iframe = context.container.querySelector<HTMLIFrameElement>(
            'iframe[title="Math Web Element"]',
        );
        if (!iframe) {
            return false;
        }

        const srcdoc = iframe.getAttribute('srcdoc');
        if (!srcdoc) {
            return false;
        }

        // Check if it's a block diagram
        if (!isBlockDiagram(srcdoc)) {
            return false;
        }

        return true;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        // Find the block diagram iframe
        const iframe = context.container.querySelector<HTMLIFrameElement>(
            'iframe[title="Math Web Element"]',
        );
        if (!iframe) {
            return this.failure('blockDiagramTextInput', 'no iframe found');
        }

        const srcdoc = iframe.getAttribute('srcdoc');
        if (!srcdoc) {
            return this.failure('blockDiagramTextInput', 'no srcdoc');
        }

        // Extract block diagram value
        const blockValue = extractBlockDiagramValue(srcdoc);
        if (blockValue === null) {
            return this.failure('blockDiagramTextInput', 'could not extract block diagram value');
        }

        this.log('block diagram value:', blockValue);

        // Find text input
        const textInput = context.container.querySelector<HTMLInputElement>(
            'input[type="text"][data-test="challenge-text-input"]',
        );
        if (!textInput) {
            return this.failure('blockDiagramTextInput', 'no text input found');
        }

        // Type the answer
        const answer = String(blockValue);
        textInput.value = answer;
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        textInput.dispatchEvent(new Event('change', { bubbles: true }));

        this.log('typed answer:', answer);

        return this.success<IBlockDiagramTextInputResult>({
            type: 'blockDiagramTextInput',
            blockValue,
            typedAnswer: answer,
        });
    }
}
