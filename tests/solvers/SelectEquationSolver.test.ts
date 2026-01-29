import { describe, it, expect, beforeEach } from 'vitest';
import { SelectEquationSolver } from '../../src/solvers/SelectEquationSolver';
import type { IChallengeContext } from '../../src/types';

describe('SelectEquationSolver', () => {
    let solver: SelectEquationSolver;

    beforeEach(() => {
        solver = new SelectEquationSolver();
        document.body.innerHTML = '';
    });

    it('should identify select equation challenge', () => {
        const container = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('srcdoc', 'new MathDiagram()');
        container.appendChild(iframe);

        const choice1 = document.createElement('div');
        choice1.setAttribute('data-test', 'challenge-choice');
        choice1.innerHTML = '<annotation>y = 2x</annotation>';
        container.appendChild(choice1);

        const context: IChallengeContext = {
            container,
            headerText: 'Select the equation',
            choices: [choice1],
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify without header', () => {
        const container = document.createElement('div');
        const context: IChallengeContext = {
            container,
            headerText: 'Answer the question',
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
