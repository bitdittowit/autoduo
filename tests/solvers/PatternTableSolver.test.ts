import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternTableSolver } from '../../src/solvers/PatternTableSolver';
import type { IChallengeContext, ISolverResult } from '../../src/types';

interface IPatternTableResult extends ISolverResult {
    type: 'patternTable';
    expression: string;
    answer: number;
    choiceIndex: number;
}

function createTable(rows: [string, string][]): Element {
    const container = document.createElement('div');

    for (const [expression, result] of rows) {
        // Expression cell
        const exprCell = document.createElement('div');
        exprCell.className = 'ihM27';
        exprCell.innerHTML = `<annotation>\\mathbf{${expression}}</annotation>`;
        container.appendChild(exprCell);

        // Result cell
        const resultCell = document.createElement('div');
        resultCell.className = 'ihM27';
        resultCell.innerHTML = `<annotation>${result}</annotation>`;
        container.appendChild(resultCell);
    }

    return container;
}

function createChoice(text: string): HTMLElement {
    const div = document.createElement('div');
    div.setAttribute('data-test', 'challenge-choice');
    div.innerHTML = `<annotation>\\mathbf{${text}}</annotation>`;
    return div;
}

describe('PatternTableSolver', () => {
    let solver: PatternTableSolver;

    beforeEach(() => {
        solver = new PatternTableSolver();
        document.body.innerHTML = '';
    });

    it('should solve subtraction pattern: 12-3=X with choices X=9 and X=15', () => {
        const container = createTable([
            ['12-1=X', 'X=11'],
            ['12-2=X', 'X=10'],
            ['12-3=X', '?'],
        ]);

        const choices = [createChoice('X=9'), createChoice('X=15')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Follow the pattern',
            choices,
        };

        const clickHandler = vi.fn();
        choices[0]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();
        expect(result?.success).toBe(true);

        const patternResult = result as IPatternTableResult;
        expect(patternResult.expression).toBe('12-3=X');
        expect(patternResult.answer).toBe(9);
        expect(patternResult.choiceIndex).toBe(0);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should extract number from X=9 format', () => {
        const container = createTable([
            ['10-2=X', 'X=8'],
            ['10-3=X', '?'],
        ]);

        const choices = [createChoice('X=7'), createChoice('X=13')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Follow the pattern',
            choices,
        };

        const clickHandler = vi.fn();
        choices[0]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();
        expect(result?.success).toBe(true);

        const patternResult = result as IPatternTableResult;
        expect(patternResult.answer).toBe(7);
        expect(patternResult.choiceIndex).toBe(0);
        expect(clickHandler).toHaveBeenCalled();
    });

    it('should handle simple number choices', () => {
        const container = createTable([
            ['5+3=X', 'X=8'],
            ['5+4=X', '?'],
        ]);

        const choices = [createChoice('9'), createChoice('20')];
        if (choices[0]) container.appendChild(choices[0]);
        if (choices[1]) container.appendChild(choices[1]);

        const context: IChallengeContext = {
            container,
            headerText: 'Follow the pattern',
            choices,
        };

        const clickHandler = vi.fn();
        choices[0]?.addEventListener('click', clickHandler);

        const result = solver.solve(context);

        expect(result).not.toBeNull();
        expect(result?.success).toBe(true);

        const patternResult = result as IPatternTableResult;
        expect(patternResult.answer).toBe(9);
        expect(patternResult.choiceIndex).toBe(0);
        expect(clickHandler).toHaveBeenCalled();
    });
});
