import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { cleanLatexWrappers } from '../parsers/latex';
import { click } from '../dom/interactions';

interface IVisualGCFResult extends ISolverResult {
    type: 'visualGCF';
    numbers: number[];
    gcf: number;
    selectedChoice: number;
    choiceBlockCounts: number[];
}

/**
 * Solver for "Find the greatest common factor" challenges
 * with visual block diagram choices
 *
 * Example:
 * - Header: "Find the greatest common factor"
 * - Table with pairs and visual representations:
 *   - 14,12 → [diagram with 2 blocks]
 *   - 15,12 → [diagram with 3 blocks]
 *   - 16,12 → ? (need to find GCF(16,12) = 4)
 * - Choices: iframes with block diagrams
 *   - Choice 1: [diagram with 4 blocks] ✓
 *   - Choice 2: [diagram with many blocks]
 */
export class VisualGCFSolver extends BaseSolver {
    readonly name = 'VisualGCFSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check header text
        if (!context.headerText) {
            return false;
        }

        const headerLower = context.headerText.toLowerCase();

        // Check if this is a "greatest common factor" challenge
        if (!(
            headerLower.includes('greatest common factor') ||
            headerLower.includes('gcf') ||
            headerLower.includes('gcd') ||
            (headerLower.includes('наибольш') && headerLower.includes('делител'))
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
            return this.failure('visualGCF', 'No table found');
        }

        // Find all cells in the table
        const cells = Array.from(table.querySelectorAll('[class*="ihM27"]'));
        this.log('found', cells.length, 'cells');

        if (cells.length === 0) {
            return this.failure('visualGCF', 'No cells found in table');
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
            return this.failure('visualGCF', 'Could not find question numbers');
        }

        // Calculate GCF
        if (questionNumbers[0] === undefined || questionNumbers[1] === undefined) {
            return this.failure('visualGCF', 'Invalid question numbers');
        }
        const gcf = this.calculateGCD(questionNumbers[0], questionNumbers[1]);
        this.log('calculated GCF:', gcf);

        // Find the correct choice by counting blocks in iframes
        if (!context.choices || context.choices.length === 0) {
            return this.failure('visualGCF', 'No choices found');
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

            if (blockCount === gcf) {
                matchingChoice = i;
                this.log('found matching choice at index', i);
            }
        }

        if (matchingChoice === -1) {
            const msg = `Could not find matching choice for GCF ${gcf}. ` +
                `Found: ${choiceBlockCounts.join(', ')}`;
            return this.failure('visualGCF', msg);
        }

        // Click the choice
        const choiceButton = context.container.querySelectorAll('[data-test="challenge-choice"]')[matchingChoice];
        if (choiceButton) {
            this.log('clicking choice', matchingChoice);
            click(choiceButton);
        }

        return {
            type: 'visualGCF',
            success: true,
            numbers: questionNumbers,
            gcf,
            selectedChoice: matchingChoice + 1,
            choiceBlockCounts,
        } as IVisualGCFResult;
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
     * Extract numbers from a string like "16,12" or "16, 12"
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
}
