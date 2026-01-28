import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisualGCFSolver } from '../../src/solvers/VisualGCFSolver';
import type { IChallengeContext, ISolverResult } from '../../src/types';

interface IVisualGCFResult extends ISolverResult {
    type: 'visualGCF';
    numbers: number[];
    gcf: number;
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
        const annotation = document.createElement('annotation');
        annotation.textContent = `\\mathbf{${numbers}}`;
        numbersCell.appendChild(annotation);
        table.appendChild(numbersCell);

        // Result cell
        const resultCell = document.createElement('div');
        resultCell.className = 'ihM27';
        if (result === null) {
            const resultAnnotation = document.createElement('annotation');
            resultAnnotation.textContent = '?';
            resultCell.appendChild(resultAnnotation);
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

describe('VisualGCFSolver', () => {
    let solver: VisualGCFSolver;

    beforeEach(() => {
        solver = new VisualGCFSolver();
        document.body.innerHTML = '';
    });

    it('should identify visual GCF challenge', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['14,12', '2'],
            ['15,12', '3'],
            ['16,12', null],
        ]);
        container.appendChild(table);

        const choices = [createVisualChoice(4), createVisualChoice(8)];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Find the greatest common factor',
            choices,
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should calculate GCF(16, 12) = 4 and select visual choice', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['14,12', '2'],
            ['15,12', '3'],
            ['16,12', null],
        ]);
        container.appendChild(table);

        const choices = [createVisualChoice(4), createVisualChoice(8)];
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

        const gcfResult = result as IVisualGCFResult;
        expect(gcfResult.numbers).toEqual([16, 12]);
        expect(gcfResult.gcf).toBe(4);
        expect(gcfResult.selectedChoice).toBe(1);
        expect(gcfResult.choiceBlockCounts).toEqual([4, 8]);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should calculate GCF(18, 24) = 6 with visual blocks', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['12,8', '4'],
            ['15,10', '5'],
            ['18,24', null],
        ]);
        container.appendChild(table);

        const choices = [createVisualChoice(6), createVisualChoice(12)];
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

        const gcfResult = result as IVisualGCFResult;
        expect(gcfResult.numbers).toEqual([18, 24]);
        expect(gcfResult.gcf).toBe(6);
        expect(gcfResult.selectedChoice).toBe(1);
        expect(gcfResult.choiceBlockCounts).toEqual([6, 12]);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should calculate GCF(20, 15) = 5 with visual blocks', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['10,5', '5'],
            ['12,6', '6'],
            ['20,15', null],
        ]);
        container.appendChild(table);

        const choices = [createVisualChoice(10), createVisualChoice(5)];
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

        const gcfResult = result as IVisualGCFResult;
        expect(gcfResult.numbers).toEqual([20, 15]);
        expect(gcfResult.gcf).toBe(5);
        expect(gcfResult.selectedChoice).toBe(2);
        expect(gcfResult.choiceBlockCounts).toEqual([10, 5]);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should not solve non-visual GCF challenge', () => {
        const container = document.createElement('div');

        const context: IChallengeContext = {
            container,
            headerText: 'Find the greatest common factor',
            choices: [],
        };

        expect(solver.canSolve(context)).toBe(false);
    });

    it('should not solve if choices have no iframes', () => {
        const container = document.createElement('div');
        const table = createTable([
            ['14,12', '2'],
            ['16,12', null],
        ]);
        container.appendChild(table);

        // Text choices instead of visual
        const choice1 = document.createElement('div');
        choice1.setAttribute('data-test', 'challenge-choice');
        choice1.innerHTML = '<annotation>4</annotation>';

        const choices = [choice1];

        const context: IChallengeContext = {
            container,
            headerText: 'Find the greatest common factor',
            choices,
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
