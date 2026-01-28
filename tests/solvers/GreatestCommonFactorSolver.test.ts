import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GreatestCommonFactorSolver } from '../../src/solvers/GreatestCommonFactorSolver';
import type { IChallengeContext, ISolverResult } from '../../src/types';

interface IGCFResult extends ISolverResult {
    type: 'greatestCommonFactor';
    numbers: number[];
    gcf: number;
    selectedChoice: number;
}

function createTable(pairs: [string, string][]): Element {
    const table = document.createElement('div');
    table.className = 'qjbi-table';

    for (const [numbers, result] of pairs) {
        // Numbers cell
        const numbersCell = document.createElement('div');
        numbersCell.className = 'ihM27';
        numbersCell.innerHTML = `<annotation>\\mathbf{${numbers}}</annotation>`;
        table.appendChild(numbersCell);

        // Result cell
        const resultCell = document.createElement('div');
        resultCell.className = 'ihM27';
        resultCell.innerHTML = `<annotation>\\mathbf{${result}}</annotation>`;
        table.appendChild(resultCell);
    }

    return table;
}

function createChoice(value: string): HTMLElement {
    const div = document.createElement('div');
    div.setAttribute('data-test', 'challenge-choice');
    div.innerHTML = `<annotation>\\mathbf{${value}}</annotation>`;
    return div;
}

describe('GreatestCommonFactorSolver', () => {
    let solver: GreatestCommonFactorSolver;

    beforeEach(() => {
        solver = new GreatestCommonFactorSolver();
        document.body.innerHTML = '';
    });

    it('should identify GCF challenge', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['14,12', '2'],
            ['15,12', '3'],
            ['16,12', '?'],
        ]);
        container.appendChild(table);

        const choices = [createChoice('4'), createChoice('8')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Find the greatest common factor',
            choices,
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should calculate GCF(16, 12) = 4', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['14,12', '2'],
            ['15,12', '3'],
            ['16,12', '?'],
        ]);
        container.appendChild(table);

        const choices = [createChoice('4'), createChoice('8')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Find the greatest common factor',
            choices,
        };

        const clickHandler = vi.fn();
        choices[0]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();
        expect(result?.success).toBe(true);

        const gcfResult = result as IGCFResult;
        expect(gcfResult.numbers).toEqual([16, 12]);
        expect(gcfResult.gcf).toBe(4);
        expect(gcfResult.selectedChoice).toBe(1);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should calculate GCF(18, 24) = 6', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['12,8', '4'],
            ['15,10', '5'],
            ['18,24', '?'],
        ]);
        container.appendChild(table);

        const choices = [createChoice('6'), createChoice('12')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Find the greatest common factor',
            choices,
        };

        const clickHandler = vi.fn();
        choices[0]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();

        const gcfResult = result as IGCFResult;
        expect(gcfResult.numbers).toEqual([18, 24]);
        expect(gcfResult.gcf).toBe(6);
        expect(gcfResult.selectedChoice).toBe(1);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should calculate GCF(20, 15) = 5', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['10,5', '5'],
            ['12,6', '6'],
            ['20,15', '?'],
        ]);
        container.appendChild(table);

        const choices = [createChoice('10'), createChoice('5')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Find the greatest common factor',
            choices,
        };

        const clickHandler = vi.fn();
        choices[1]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();

        const gcfResult = result as IGCFResult;
        expect(gcfResult.numbers).toEqual([20, 15]);
        expect(gcfResult.gcf).toBe(5);
        expect(gcfResult.selectedChoice).toBe(2);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should not solve non-GCF challenge', () => {
        const container = document.createElement('div');

        const context: IChallengeContext = {
            container,
            headerText: 'Select the answer',
            choices: [],
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
