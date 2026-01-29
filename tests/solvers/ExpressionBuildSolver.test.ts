import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionBuildSolver } from '../../src/solvers/ExpressionBuildSolver';
import type { IChallengeContext } from '../../src/types';

describe('ExpressionBuildSolver', () => {
    let solver: ExpressionBuildSolver;

    beforeEach(() => {
        solver = new ExpressionBuildSolver();
        document.body.innerHTML = '';
    });

    it('should identify ExpressionBuild iframe', () => {
        const container = document.createElement('div');
        container.setAttribute('data-test', 'challenge challenge-mathChallengeBlob');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'Math Web Element');
        iframe.setAttribute('srcdoc', 'new ExpressionBuild({ entries: [null, null, null] })');
        container.appendChild(iframe);

        const katex = document.createElement('span');
        katex.className = 'katex';
        katex.innerHTML = '<annotation>0 = \\duoblank{3}</annotation>';
        container.appendChild(katex);

        const context: IChallengeContext = {
            container,
            headerText: 'Complete the equation',
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify without equation', () => {
        const container = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('srcdoc', 'new ExpressionBuild({ entries: [null, null, null] })');
        container.appendChild(iframe);

        const context: IChallengeContext = {
            container,
            headerText: 'Complete the equation',
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
