import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { cleanLatexWrappers } from '../parsers/latex';
import { click } from '../dom/interactions';

interface ISelectFactorsResult extends ISolverResult {
    type: 'selectFactors';
    number: number;
    factors: number[];
    selectedChoice: number;
}

export class SelectFactorsSolver extends BaseSolver {
    readonly name = 'SelectFactorsSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check header text
        if (!context.headerText) {
            return false;
        }

        const headerLower = context.headerText.toLowerCase();

        // Check if this is a "Select the factors" challenge
        if (
            headerLower.includes('select') &&
            (headerLower.includes('factor') || headerLower.includes('делител'))
        ) {
            // Verify we have choices
            return context.choices !== undefined && context.choices.length > 0;
        }

        return false;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.choices || context.choices.length === 0) {
            return this.failure('selectFactors', 'No choices found');
        }

        this.log('starting');

        // Extract the number
        const number = this.extractNumber(context);
        if (number === null) {
            return this.failure('selectFactors', 'Could not extract number');
        }

        this.log('number =', number);

        // Calculate all factors
        const factors = this.calculateFactors(number);
        this.log('factors =', factors);

        // Find the choice with the most correct factors
        let bestChoice = -1;
        let bestScore = -1;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const choiceNumbers = this.extractNumbersFromChoice(choice);
            this.log(`choice ${i + 1}:`, choiceNumbers);

            // Calculate score: count how many are actual factors
            let score = 0;
            let hasNonFactor = false;

            for (const num of choiceNumbers) {
                if (factors.includes(num)) {
                    score++;
                } else {
                    hasNonFactor = true;
                    break; // If any number is not a factor, this choice is wrong
                }
            }

            // Only consider if all numbers are factors
            if (!hasNonFactor && score > bestScore) {
                bestScore = score;
                bestChoice = i;
            }
        }

        if (bestChoice === -1) {
            return this.failure('selectFactors', 'Could not find correct choice');
        }

        this.log('best choice =', bestChoice + 1, 'with score', bestScore);

        // Click the choice
        const choiceButton = context.container.querySelectorAll('[data-test="challenge-choice"]')[bestChoice];
        if (choiceButton) {
            click(choiceButton);
        }

        return {
            type: 'selectFactors',
            success: true,
            number,
            factors,
            selectedChoice: bestChoice + 1,
        } as ISelectFactorsResult;
    }

    private extractNumber(context: IChallengeContext): number | null {
        // Find the number in the challenge (usually in a KaTeX element between header and choices)
        const mathElements = context.container.querySelectorAll('.katex');

        for (const mathEl of mathElements) {
            // Skip the header
            if (mathEl.closest('[data-test="challenge-header"]')) {
                continue;
            }

            // Skip choices
            if (mathEl.closest('[data-test="challenge-choice"]')) {
                continue;
            }

            // Get annotation text
            const annotation = mathEl.querySelector('annotation');
            if (!annotation?.textContent) continue;

            let text = annotation.textContent;
            text = cleanLatexWrappers(text);

            // Try to parse as a number
            const num = parseInt(text.trim(), 10);
            if (!isNaN(num) && num > 0) {
                return num;
            }
        }

        return null;
    }

    private extractNumbersFromChoice(choice: Element): number[] {
        const numbers: number[] = [];

        // Get annotation text from choice
        const annotation = choice.querySelector('annotation');
        if (!annotation?.textContent) return numbers;

        let text = annotation.textContent;
        text = cleanLatexWrappers(text);

        // Parse numbers from text like "1, 4, 8, 16"
        const parts = text.split(',');

        for (const part of parts) {
            const num = parseInt(part.trim(), 10);
            if (!isNaN(num)) {
                numbers.push(num);
            }
        }

        return numbers;
    }

    private calculateFactors(n: number): number[] {
        const factors: number[] = [];

        for (let i = 1; i <= n; i++) {
            if (n % i === 0) {
                factors.push(i);
            }
        }

        return factors;
    }
}
