/**
 * Солвер для заданий "Show this another way"
 *
 * Показывает блок-диаграмму и варианты ответов с числами.
 * Нужно выбрать число, соответствующее количеству блоков.
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractBlockDiagramValue, isBlockDiagram } from '../parsers/BlockDiagramParser';
import { extractKatexValue } from '../parsers/KatexParser';
import { evaluateMathExpression } from '../math/expressions';
import { findAllIframes } from '../dom/selectors';

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

        // Exclude if there's a NumberLine slider (those use InteractiveSliderSolver)
        const allIframes = findAllIframes(context.container);
        for (const iframe of allIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (srcdoc?.includes('NumberLine')) {
                // Exclude ExpressionBuild components
                if (!srcdoc.includes('exprBuild') && !srcdoc.includes('ExpressionBuild')) {
                    return false; // This is a slider challenge, not a choice challenge
                }
            }
        }

        // Check if choices contain block diagrams (new variant: equation + block diagram choices)
        const hasBlockDiagramChoices = context.choices.some(choice => {
            const iframe = choice?.querySelector('iframe[title="Math Web Element"]');
            if (!iframe) return false;
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) return false;
            return isBlockDiagram(srcdoc);
        });

        if (hasBlockDiagramChoices) {
            return true;
        }

        // Fallback: check if main container has block diagram (old variant: block diagram + number choices)
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

        // Use isBlockDiagram() for more accurate detection
        return isBlockDiagram(srcdoc);
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        if (!context.choices?.length) {
            return this.failure('blockDiagramChoice', 'no choices found');
        }

        // Check if choices contain block diagrams (new variant: equation + block diagram choices)
        const hasBlockDiagramChoices = context.choices.some(choice => {
            const iframe = choice?.querySelector('iframe[title="Math Web Element"]');
            if (!iframe) return false;
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) return false;
            return isBlockDiagram(srcdoc);
        });

        let targetValue: number | null = null;
        let blockValue: number | null = null;

        if (hasBlockDiagramChoices) {
            // Variant 1: Equation shows number, choices show block diagrams
            // Extract target value from equation (KaTeX in main container)
            if (context.equationContainer) {
                const valueStr = extractKatexValue(context.equationContainer);
                if (valueStr) {
                    targetValue = evaluateMathExpression(valueStr);
                    this.log('target value from equationContainer:', targetValue);
                }
            }

            // Fallback: try to find KaTeX in container directly
            if (targetValue === null) {
                const katexElement = context.container.querySelector('.katex');
                if (katexElement) {
                    const valueStr = extractKatexValue(katexElement);
                    if (valueStr) {
                        targetValue = evaluateMathExpression(valueStr);
                        this.log('target value from katex in container:', targetValue);
                    }
                }
            }

            // Another fallback: look for number in _1KXkZ or similar containers
            if (targetValue === null) {
                const numberContainer = context.container.querySelector('._1KXkZ, ._2On2O');
                if (numberContainer) {
                    const valueStr = extractKatexValue(numberContainer);
                    if (valueStr) {
                        targetValue = evaluateMathExpression(valueStr);
                        this.log('target value from number container:', targetValue);
                    }
                }
            }

            if (targetValue === null) {
                return this.failure('blockDiagramChoice', 'could not extract target value from equation');
            }

            // Find choice with block diagram matching target value
            let matchedIndex = -1;
            let matchedBlockValue = 0;

            this.log('searching', context.choices.length, 'choices for block diagram matching', targetValue);

            for (let i = 0; i < context.choices.length; i++) {
                const choice = context.choices[i];
                if (!choice) {
                    this.log('choice', i, 'is null');
                    continue;
                }

                // Find block diagram iframe in choice
                const iframe = choice.querySelector<HTMLIFrameElement>(
                    'iframe[title="Math Web Element"]',
                );
                if (!iframe) {
                    this.log('choice', i, 'no iframe');
                    continue;
                }

                const srcdoc = iframe.getAttribute('srcdoc');
                if (!srcdoc) {
                    this.log('choice', i, 'no srcdoc');
                    continue;
                }

                // Check if it's actually a block diagram
                if (!isBlockDiagram(srcdoc)) {
                    this.log('choice', i, 'is not a block diagram');
                    continue;
                }

                // Extract block diagram value
                const diagramValue = extractBlockDiagramValue(srcdoc);
                if (diagramValue === null) {
                    this.log('choice', i, 'could not extract block diagram value');
                    continue;
                }

                this.log('choice', i, 'block diagram value:', diagramValue, 'target:', targetValue);

                if (Math.abs(diagramValue - targetValue) < 0.0001) {
                    matchedIndex = i;
                    matchedBlockValue = diagramValue;
                    blockValue = diagramValue;
                    this.log('found matching choice', i, ':', targetValue, '=', diagramValue);
                    break;
                } else {
                    this.log('choice', i, 'does not match:', diagramValue, '!=', targetValue);
                }
            }

            if (matchedIndex === -1) {
                return this.failure(
                    'blockDiagramChoice',
                    `no choice matches target value ${targetValue}`,
                );
            }

            const matchedChoice = context.choices[matchedIndex];
            if (matchedChoice) {
                this.click(matchedChoice);
                this.log('clicked choice', matchedIndex);
            }

            return this.success<IBlockDiagramChoiceResult>({
                type: 'blockDiagramChoice',
                blockValue: matchedBlockValue,
                selectedChoice: matchedIndex,
                selectedValue: matchedBlockValue,
            });
        } else {
            // Variant 2: Block diagram in main container, choices show numbers (old variant)
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
            blockValue = extractBlockDiagramValue(srcdoc);
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
}
