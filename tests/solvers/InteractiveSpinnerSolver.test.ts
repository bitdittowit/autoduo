import { describe, it, expect, beforeEach } from 'vitest';
import { InteractiveSpinnerSolver } from '../../src/solvers/InteractiveSpinnerSolver';
import type { IChallengeContext } from '../../src/types';

describe('InteractiveSpinnerSolver', () => {
    let solver: InteractiveSpinnerSolver;

    beforeEach(() => {
        solver = new InteractiveSpinnerSolver();
        document.body.innerHTML = '';
    });

    it('should identify spinner iframe', () => {
        const container = document.createElement('div');
        container.setAttribute('data-test', 'challenge challenge-mathChallengeBlob');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'Math Web Element');
        iframe.setAttribute('srcdoc', 'segments: 8');
        container.appendChild(iframe);

        const context: IChallengeContext = {
            container,
            headerText: 'Select segments',
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify NumberLine iframe', () => {
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
