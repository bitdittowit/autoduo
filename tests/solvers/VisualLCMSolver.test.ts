import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisualLCMSolver } from '../../src/solvers/VisualLCMSolver';
import type { IChallengeContext, ISolverResult } from '../../src/types';

interface IVisualLCMResult extends ISolverResult {
    type: 'visualLCM';
    numbers: number[];
    lcm: number;
    selectedChoice: number;
    choiceBlockCounts: number[];
}

function createTable(pairs: [string, string | null][]): Element {
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
        if (result === null) {
            resultCell.innerHTML = '<annotation>?</annotation>';
        } else {
            // Create iframe with block diagram (SVG with rectangles)
            const blockCount = parseInt(result, 10);
            const svgPaths = Array(blockCount).fill('<rect fill="#1CB0F6"/>').join('\n');
            const srcdoc = `<svg>${svgPaths}</svg>`;
            resultCell.innerHTML = `<iframe srcdoc="${srcdoc.replace(/"/g, '&quot;')}"></iframe>`;
        }
        table.appendChild(resultCell);
    }

    return table;
}

function createVisualChoice(blockCount: number): HTMLElement {
    const div = document.createElement('div');
    div.setAttribute('data-test', 'challenge-choice');

    // Create SVG with the specified number of blocks
    const svgPaths = Array(blockCount).fill('<rect fill="#1CB0F6"/>').join('\n');
    const srcdoc = `<svg>${svgPaths}</svg>`;

    div.innerHTML = `<iframe srcdoc="${srcdoc.replace(/"/g, '&quot;')}"></iframe>`;
    return div;
}

describe('VisualLCMSolver', () => {
    let solver: VisualLCMSolver;

    beforeEach(() => {
        solver = new VisualLCMSolver();
        document.body.innerHTML = '';
    });

    it('should identify visual LCM challenge', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['7,7', '7'],
            ['7,14', '14'],
            ['7,21', null],
        ]);
        container.appendChild(table);

        const choices = [createVisualChoice(19), createVisualChoice(21)];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Select the least common multiple',
            choices,
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should calculate LCM(7, 21) = 21 and select visual choice', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['7,7', '7'],
            ['7,14', '14'],
            ['7,21', null],
        ]);
        container.appendChild(table);

        const choices = [createVisualChoice(19), createVisualChoice(21)];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Select the least common multiple',
            choices,
        };

        const clickHandler = vi.fn();
        choices[1]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();
        expect(result?.success).toBe(true);

        const lcmResult = result as IVisualLCMResult;
        expect(lcmResult.numbers).toEqual([7, 21]);
        expect(lcmResult.lcm).toBe(21);
        expect(lcmResult.selectedChoice).toBe(2);
        expect(lcmResult.choiceBlockCounts).toEqual([19, 21]);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should calculate LCM(6, 8) = 24 with visual blocks', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['2,4', '4'],
            ['3,4', '12'],
            ['6,8', null],
        ]);
        container.appendChild(table);

        const choices = [createVisualChoice(24), createVisualChoice(48)];
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

        const lcmResult = result as IVisualLCMResult;
        expect(lcmResult.numbers).toEqual([6, 8]);
        expect(lcmResult.lcm).toBe(24);
        expect(lcmResult.selectedChoice).toBe(1);
        expect(lcmResult.choiceBlockCounts).toEqual([24, 48]);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should not solve non-visual LCM challenge', () => {
        const container = document.createElement('div');

        const context: IChallengeContext = {
            container,
            headerText: 'Select the least common multiple',
            choices: [],
        };

        expect(solver.canSolve(context)).toBe(false);
    });

    it('should not solve if choices have no iframes', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['7,7', '7'],
            ['7,21', null],
        ]);
        container.appendChild(table);

        // Text choices instead of visual
        const choice1 = document.createElement('div');
        choice1.setAttribute('data-test', 'challenge-choice');
        choice1.innerHTML = '<annotation>21</annotation>';

        const choices = [choice1];

        const context: IChallengeContext = {
            container,
            headerText: 'Select the least common multiple',
            choices,
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
