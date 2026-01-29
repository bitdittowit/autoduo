import { describe, it, expect, beforeEach } from 'vitest';
import { SelectAllMatchSolver } from '../../src/solvers/SelectAllMatchSolver';
import type { IChallengeContext } from '../../src/types';

describe('SelectAllMatchSolver', () => {
    let solver: SelectAllMatchSolver;

    beforeEach(() => {
        solver = new SelectAllMatchSolver();
        document.body.innerHTML = '';
    });

    it('should identify select all that match challenge', () => {
        const container = document.createElement('div');
        const equationContainer = document.createElement('div');
        equationContainer.className = '_1KXkZ';
        equationContainer.innerHTML = '<annotation>X = 11 - 4</annotation>';
        container.appendChild(equationContainer);

        const choice1 = document.createElement('div');
        choice1.setAttribute('data-test', 'challenge-choice');
        choice1.setAttribute('role', 'checkbox');
        choice1.innerHTML = '<annotation>10 - 3</annotation>';
        container.appendChild(choice1);

        const context: IChallengeContext = {
            container,
            headerText: 'Select all that match',
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
