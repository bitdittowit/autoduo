import { describe, it, expect, beforeEach } from 'vitest';
import { TableFillSolver } from '../../src/solvers/TableFillSolver';
import type { IChallengeContext } from '../../src/types';

describe('TableFillSolver', () => {
    let solver: TableFillSolver;

    beforeEach(() => {
        solver = new TableFillSolver();
        document.body.innerHTML = '';
    });

    it('should identify table iframe', () => {
        const container = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('srcdoc', 'new Table({ data: [[1, null]] })');
        container.appendChild(iframe);

        const context: IChallengeContext = {
            container,
            headerText: 'Complete the table',
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify non-table iframe', () => {
        const container = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('srcdoc', 'new NumberLine()');
        container.appendChild(iframe);

        const context: IChallengeContext = {
            container,
            headerText: 'Answer on the line',
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
