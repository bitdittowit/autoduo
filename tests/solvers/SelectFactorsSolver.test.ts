import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectFactorsSolver } from '../../src/solvers/SelectFactorsSolver';
import type { IChallengeContext, ISolverResult } from '../../src/types';

interface ISelectFactorsResult extends ISolverResult {
    type: 'selectFactors';
    number: number;
    factors: number[];
    selectedChoice: number;
}

function createChoice(text: string): HTMLElement {
    const div = document.createElement('div');
    div.setAttribute('data-test', 'challenge-choice');
    div.innerHTML = `<annotation>${text}</annotation>`;
    return div;
}

function createContainer(number: number, choicesData: string[]): Element {
    const container = document.createElement('div');

    // Header
    const header = document.createElement('div');
    header.setAttribute('data-test', 'challenge-header');
    header.innerHTML = '<annotation>\\textbf{Select the factors}</annotation>';
    container.appendChild(header);

    // Number
    const numberDiv = document.createElement('div');
    numberDiv.innerHTML = `<span class="katex"><annotation>\\mathbf{${number}}</annotation></span>`;
    container.appendChild(numberDiv);

    // Choices
    for (const choiceText of choicesData) {
        const choice = createChoice(choiceText);
        container.appendChild(choice);
    }

    return container;
}

describe('SelectFactorsSolver', () => {
    let solver: SelectFactorsSolver;

    beforeEach(() => {
        solver = new SelectFactorsSolver();
        document.body.innerHTML = '';
    });

    it('should identify Select Factors challenge', () => {
        const container = createContainer(32, [
            '\\mathbf{1, 400, 8, 16}',
            '\\mathbf{1, 4, 8, 16}',
        ]);

        const choices = Array.from(container.querySelectorAll('[data-test="challenge-choice"]'));

        const context: IChallengeContext = {
            container,
            headerText: 'Select the factors',
            choices,
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should calculate factors correctly', () => {
        const container = createContainer(32, [
            '\\mathbf{1, 400, 8, 16}',
            '\\mathbf{2, 5, 9, 17}',
            '\\mathbf{1, 4, 8, 16}',
        ]);

        const choices = Array.from(container.querySelectorAll('[data-test="challenge-choice"]'));

        const context: IChallengeContext = {
            container,
            headerText: 'Select the factors',
            choices,
        };

        const clickHandler = vi.fn();
        choices[2]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();
        expect(result?.success).toBe(true);

        const factorsResult = result as ISelectFactorsResult;
        expect(factorsResult.number).toBe(32);
        expect(factorsResult.factors).toEqual([1, 2, 4, 8, 16, 32]);
        expect(factorsResult.selectedChoice).toBe(3); // Third choice: 1, 4, 8, 16
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should reject incorrect choices', () => {
        const container = createContainer(32, [
            '\\mathbf{1, 400, 8, 16}',
            '\\mathbf{2, 5, 9, 17}',
            '\\mathbf{1, 4, 8, 16}',
        ]);

        const choices = Array.from(container.querySelectorAll('[data-test="challenge-choice"]'));

        const context: IChallengeContext = {
            container,
            headerText: 'Select the factors',
            choices,
        };

        const result = solver.solve(context);

        expect(result).not.toBeNull();
        // Should NOT select choice 1 (contains 400 which is not a factor)
        // Should NOT select choice 2 (contains 5, 9, 17 which are not factors)
        const factorsResult = result as ISelectFactorsResult;
        expect(factorsResult.selectedChoice).toBe(3);
    });

    it('should not solve non-factors challenge', () => {
        const container = document.createElement('div');

        const context: IChallengeContext = {
            container,
            headerText: 'Select the answer',
            choices: [],
        };

        expect(solver.canSolve(context)).toBe(false);
    });

    it('should calculate factors for 12', () => {
        const container = createContainer(12, [
            '\\mathbf{1, 2, 3, 4}',
            '\\mathbf{1, 5, 7, 11}',
        ]);

        const choices = Array.from(container.querySelectorAll('[data-test="challenge-choice"]'));

        const context: IChallengeContext = {
            container,
            headerText: 'Select the factors',
            choices,
        };

        const clickHandler = vi.fn();
        choices[0]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();

        const factorsResult = result as ISelectFactorsResult;
        expect(factorsResult.number).toBe(12);
        expect(factorsResult.factors).toEqual([1, 2, 3, 4, 6, 12]);
        expect(factorsResult.selectedChoice).toBe(1); // First choice: 1, 2, 3, 4
        expect(clickHandler).toHaveBeenCalled();
    });
});
