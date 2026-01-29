import { describe, it, expect, beforeEach } from 'vitest';
import { InteractiveSliderSolver } from '../../src/solvers/InteractiveSliderSolver';
import type { IChallengeContext } from '../../src/types';

describe('InteractiveSliderSolver', () => {
    let solver: InteractiveSliderSolver;

    beforeEach(() => {
        solver = new InteractiveSliderSolver();
        document.body.innerHTML = '';
    });

    it('should identify NumberLine iframe', () => {
        const container = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('srcdoc', 'new NumberLine({ disableSnapping: true })');
        container.appendChild(iframe);

        const context: IChallengeContext = {
            container,
            headerText: 'Answer on the line',
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify ExpressionBuild iframe', () => {
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
