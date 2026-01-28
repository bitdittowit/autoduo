import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeastCommonMultipleSolver } from '../../src/solvers/LeastCommonMultipleSolver';
import type { IChallengeContext, ISolverResult } from '../../src/types';

interface ILCMResult extends ISolverResult {
    type: 'leastCommonMultiple';
    numbers: number[];
    lcm: number;
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

describe('LeastCommonMultipleSolver', () => {
    let solver: LeastCommonMultipleSolver;

    beforeEach(() => {
        solver = new LeastCommonMultipleSolver();
        document.body.innerHTML = '';
    });

    it('should identify LCM challenge', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['2,5', '10'],
            ['3,5', '15'],
            ['4,5', '?'],
        ]);
        container.appendChild(table);

        const choices = [createChoice('20'), createChoice('19')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Select the least common multiple',
            choices,
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should calculate LCM(4, 5) = 20', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['2,5', '10'],
            ['3,5', '15'],
            ['4,5', '?'],
        ]);
        container.appendChild(table);

        const choices = [createChoice('20'), createChoice('19')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Select the least common multiple',
            choices,
        };

        const clickHandler = vi.fn();
        choices[0]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();
        expect(result?.success).toBe(true);

        const lcmResult = result as ILCMResult;
        expect(lcmResult.numbers).toEqual([4, 5]);
        expect(lcmResult.lcm).toBe(20);
        expect(lcmResult.selectedChoice).toBe(1);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should calculate LCM(6, 8) = 24', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['2,4', '4'],
            ['3,4', '12'],
            ['6,8', '?'],
        ]);
        container.appendChild(table);

        const choices = [createChoice('24'), createChoice('48')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Select the least common multiple',
            choices,
        };

        const clickHandler = vi.fn();
        choices[0]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();

        const lcmResult = result as ILCMResult;
        expect(lcmResult.numbers).toEqual([6, 8]);
        expect(lcmResult.lcm).toBe(24);
        expect(lcmResult.selectedChoice).toBe(1);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should calculate LCM(12, 18) = 36', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['4,6', '12'],
            ['6,9', '18'],
            ['12,18', '?'],
        ]);
        container.appendChild(table);

        const choices = [createChoice('36'), createChoice('216')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Select the least common multiple',
            choices,
        };

        const clickHandler = vi.fn();
        choices[0]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();

        const lcmResult = result as ILCMResult;
        expect(lcmResult.numbers).toEqual([12, 18]);
        expect(lcmResult.lcm).toBe(36);
        expect(lcmResult.selectedChoice).toBe(1);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should not solve non-LCM challenge', () => {
        const container = document.createElement('div');

        const context: IChallengeContext = {
            container,
            headerText: 'Select the answer',
            choices: [],
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
