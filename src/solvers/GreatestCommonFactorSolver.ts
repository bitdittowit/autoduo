import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { cleanLatexWrappers } from '../parsers/latex';
import { click } from '../dom/interactions';

interface IGCFResult extends ISolverResult {
    type: 'greatestCommonFactor';
    numbers: number[];
    gcf: number;
    selectedChoice: number;
}

/**
 * Solver for "Find the greatest common factor" (GCF/GCD) challenges
 *
 * Example:
 * - Header: "Find the greatest common factor"
 * - Table with pairs and their GCF:
 *   - 14,12 → 2
 *   - 15,12 → 3
 *   - 16,12 → ? (need to find GCF(16,12) = 4)
 * - Choices: 4, 8
 * - Answer: 4
 */
export class GreatestCommonFactorSolver extends BaseSolver {
    readonly name = 'GreatestCommonFactorSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check header text
        if (!context.headerText) {
            return false;
        }

        const headerLower = context.headerText.toLowerCase();

        // Check if this is a "greatest common factor" or "GCF" challenge
        if (
            headerLower.includes('greatest common factor') ||
            headerLower.includes('gcf') ||
            headerLower.includes('gcd') ||
            (headerLower.includes('наибольш') && headerLower.includes('делител'))
        ) {
            // Verify we have a table with cells
            const table = context.container.querySelector('[class*="qjbi"]');
            return table !== null;
        }

        return false;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        // Find the table with pairs and GCF values
        const table = context.container.querySelector('[class*="qjbi"]');
        if (!table) {
            return this.failure('greatestCommonFactor', 'No table found');
        }

        // Find all cells in the table
        const cells = Array.from(table.querySelectorAll('[class*="ihM27"]'));
        this.log('found', cells.length, 'cells');

        if (cells.length === 0) {
            return this.failure('greatestCommonFactor', 'No cells found in table');
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
            return this.failure('greatestCommonFactor', 'Could not find question numbers');
        }

        // Calculate GCF
        if (questionNumbers[0] === undefined || questionNumbers[1] === undefined) {
            return this.failure('greatestCommonFactor', 'Invalid question numbers');
        }
        const gcf = this.calculateGCD(questionNumbers[0], questionNumbers[1]);
        this.log('calculated GCF:', gcf);

        // Find the correct choice
        if (!context.choices || context.choices.length === 0) {
            return this.failure('greatestCommonFactor', 'No choices found');
        }

        this.log('found', context.choices.length, 'choices');

        let matchingChoice = -1;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const annotation = choice.querySelector('annotation');
            if (!annotation?.textContent) continue;

            let text = annotation.textContent;
            text = cleanLatexWrappers(text);

            const choiceNumber = parseInt(text.trim(), 10);
            this.log('choice', i + 1, ':', choiceNumber);

            if (choiceNumber === gcf) {
                matchingChoice = i;
                this.log('found matching choice at index', i);
                break;
            }
        }

        if (matchingChoice === -1) {
            return this.failure(
                'greatestCommonFactor',
                `Could not find matching choice for GCF ${gcf}`,
            );
        }

        // Click the choice
        const choiceButton = context.container
            .querySelectorAll('[data-test="challenge-choice"]')[matchingChoice];
        if (choiceButton) {
            this.log('clicking choice', matchingChoice);
            click(choiceButton);
        }

        return {
            type: 'greatestCommonFactor',
            success: true,
            numbers: questionNumbers,
            gcf,
            selectedChoice: matchingChoice + 1,
        } as IGCFResult;
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
