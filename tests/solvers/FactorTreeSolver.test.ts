import { describe, it, expect, beforeEach } from 'vitest';
import { FactorTreeSolver } from '../../src/solvers/FactorTreeSolver';
import type { IChallengeContext } from '../../src/types';

describe('FactorTreeSolver', () => {
    let solver: FactorTreeSolver;

    beforeEach(() => {
        solver = new FactorTreeSolver();
        document.body.innerHTML = '';
    });

    it('should identify factor tree iframe', () => {
        const container = document.createElement('div');
        container.setAttribute('data-test', 'challenge challenge-mathChallengeBlob');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'Math Web Element');
        iframe.setAttribute('srcdoc', 'const originalTree = {value: 12}; const originalTokens = [3, 4];');
        container.appendChild(iframe);

        const context: IChallengeContext = {
            container,
            headerText: 'Divide to fill in the blank',
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify non-factor-tree iframe', () => {
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
