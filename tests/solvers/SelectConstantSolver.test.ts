import { describe, it, expect, beforeEach } from 'vitest';
import { SelectConstantSolver } from '../../src/solvers/SelectConstantSolver';
import type { IChallengeContext } from '../../src/types';

describe('SelectConstantSolver', () => {
    let solver: SelectConstantSolver;

    beforeEach(() => {
        solver = new SelectConstantSolver();
        document.body.innerHTML = '';
    });

    it('should identify select constant challenge', () => {
        const container = document.createElement('div');
        container.textContent = 'y = 5x';
        const choice1 = document.createElement('div');
        choice1.setAttribute('data-test', 'challenge-choice');
        choice1.textContent = '5';
        container.appendChild(choice1);

        const context: IChallengeContext = {
            container,
            headerText: 'Select the constant of proportionality',
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
