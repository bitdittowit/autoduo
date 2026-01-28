import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { cleanLatexWrappers } from '../parsers/latex';
import { click } from '../dom/interactions';

interface IVisualLCMResult extends ISolverResult {
    type: 'visualLCM';
    numbers: number[];
    lcm: number;
    selectedChoice: number;
    choiceBlockCounts: number[];
}

/**
 * Solver for "Select the least common multiple" challenges
 * with visual block diagram choices
 *
 * Example:
 * - Header: "Select the least common multiple"
 * - Table with pairs and visual representations:
 *   - 7,7 → [diagram with 7 blocks]
 *   - 7,14 → [diagram with 14 blocks]
 *   - 7,21 → ? (need to find LCM(7,21) = 21)
 * - Choices: iframes with block diagrams
 *   - Choice 1: [diagram with 19 blocks]
 *   - Choice 2: [diagram with 21 blocks] ✓
 */
export class VisualLCMSolver extends BaseSolver {
    readonly name = 'VisualLCMSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check header text
        if (!context.headerText) {
            return false;
        }

        const headerLower = context.headerText.toLowerCase();

        // Check if this is a "least common multiple" challenge
        if (!(
            headerLower.includes('least common multiple') ||
            headerLower.includes('lcm') ||
            (headerLower.includes('наименьш') && headerLower.includes('кратн'))
        )) {
            return false;
        }

        // Verify we have a table with cells
        const table = context.container.querySelector('[class*="qjbi"]');
        if (!table) {
            return false;
        }

        // Check if choices contain iframes (visual representation)
        if (!context.choices || context.choices.length === 0) {
            return false;
        }

        // Check if at least one choice contains an iframe with srcdoc
        const hasVisualChoices = Array.from(context.choices).some(choice => {
            const iframe = choice.querySelector('iframe[srcdoc]');
            return iframe !== null;
        });

        return hasVisualChoices;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        // Find the table with pairs
        const table = context.container.querySelector('[class*="qjbi"]');
        if (!table) {
            return this.failure('visualLCM', 'No table found');
        }

        // Find all cells in the table
        const cells = Array.from(table.querySelectorAll('[class*="ihM27"]'));
        this.log('found', cells.length, 'cells');

        if (cells.length === 0) {
            return this.failure('visualLCM', 'No cells found in table');
        }

        // Find the cell with "?" - this is our question
        let questionNumbers: number[] = [];

        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i] as HTMLElement;
            const annotation = cell.querySelector('annotation');
            if (!annotation?.textContent) continue;

            let text = annotation.textContent;
            text = cleanLatexWrappers(text);

            // Check if this is the question cell (contains ?)
            if (text.includes('?')) {
                // The previous cell should contain the numbers
                if (i > 0) {
                    const prevCell = cells[i - 1] as HTMLElement;
                    const prevAnnotation = prevCell.querySelector('annotation');
                    if (prevAnnotation?.textContent) {
                        let prevText = prevAnnotation.textContent;
                        prevText = cleanLatexWrappers(prevText);
                        questionNumbers = this.extractNumbers(prevText);
                        this.log('question numbers:', questionNumbers);
                        break;
                    }
                }
            }
        }

        if (questionNumbers.length !== 2) {
            return this.failure('visualLCM', 'Could not find question numbers');
        }

        // Calculate LCM
        if (questionNumbers[0] === undefined || questionNumbers[1] === undefined) {
            return this.failure('visualLCM', 'Invalid question numbers');
        }
        const lcm = this.calculateLCM(questionNumbers[0], questionNumbers[1]);
        this.log('calculated LCM:', lcm);

        // Find the correct choice by counting blocks in iframes
        if (!context.choices || context.choices.length === 0) {
            return this.failure('visualLCM', 'No choices found');
        }

        this.log('found', context.choices.length, 'choices');

        const choiceBlockCounts: number[] = [];
        let matchingChoice = -1;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const blockCount = this.countBlocksInChoice(choice);
            choiceBlockCounts.push(blockCount);
            this.log('choice', i + 1, ':', blockCount, 'blocks');

            if (blockCount === lcm) {
                matchingChoice = i;
                this.log('found matching choice at index', i);
            }
        }

        if (matchingChoice === -1) {
            const msg = `Could not find matching choice for LCM ${lcm}. ` +
                `Found: ${choiceBlockCounts.join(', ')}`;
            return this.failure('visualLCM', msg);
        }

        // Click the choice
        const choiceButton = context.container.querySelectorAll('[data-test="challenge-choice"]')[matchingChoice];
        if (choiceButton) {
            this.log('clicking choice', matchingChoice);
            click(choiceButton);
        }

        return {
            type: 'visualLCM',
            success: true,
            numbers: questionNumbers,
            lcm,
            selectedChoice: matchingChoice + 1,
            choiceBlockCounts,
        } as IVisualLCMResult;
    }

    /**
     * Count blocks in a choice by parsing the iframe's srcdoc
     */
    private countBlocksInChoice(choice: Element): number {
        const iframe = choice.querySelector('iframe[srcdoc]');
        if (!iframe) {
            return 0;
        }

        const srcdoc = iframe.getAttribute('srcdoc');
        if (!srcdoc) {
            return 0;
        }

        // Parse the SVG content from srcdoc
        // Count <path> and <rect> elements (these represent blocks)
        const pathMatches = srcdoc.match(/<path/g);
        const rectMatches = srcdoc.match(/<rect/g);

        const pathCount = pathMatches ? pathMatches.length : 0;
        const rectCount = rectMatches ? rectMatches.length : 0;

        return pathCount + rectCount;
    }

    /**
     * Extract numbers from a string like "7,21" or "7, 21"
     */
    private extractNumbers(text: string): number[] {
        const numbers: number[] = [];
        const parts = text.split(',');

        for (const part of parts) {
            const num = parseInt(part.trim(), 10);
            if (!isNaN(num)) {
                numbers.push(num);
            }
        }

        return numbers;
    }

    /**
     * Calculate Greatest Common Divisor (GCD) using Euclidean algorithm
     */
    private calculateGCD(a: number, b: number): number {
        while (b !== 0) {
            const temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }

    /**
     * Calculate Least Common Multiple (LCM)
     * LCM(a, b) = (a * b) / GCD(a, b)
     */
    private calculateLCM(a: number, b: number): number {
        return (a * b) / this.calculateGCD(a, b);
    }
}
