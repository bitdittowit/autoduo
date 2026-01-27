import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectEquivalentFractionSolver } from '../../src/solvers/SelectEquivalentFractionSolver';
import type { IChallengeContext } from '../../src/types';

describe('SelectEquivalentFractionSolver', () => {
    let solver: SelectEquivalentFractionSolver;

    beforeEach(() => {
        solver = new SelectEquivalentFractionSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should return true for equivalent fraction challenges', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Select the equivalent fraction',
                equationContainer: document.createElement('div'),
                choices: [document.createElement('div')],
            };
            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return true for "equal" in header', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Which fraction is equal?',
                equationContainer: document.createElement('div'),
                choices: [document.createElement('div')],
            };
            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return false without choices', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Select the equivalent fraction',
                equationContainer: document.createElement('div'),
            };
            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve', () => {
        it('should find equivalent fraction 1/2 = 2/4', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{2}{4}</annotation>';

            const choices = [
                createChoice('\\frac{1}{3}'),
                createChoice('\\frac{1}{2}'),
                createChoice('\\frac{2}{3}'),
            ];

            const clickHandler = vi.fn();
            choices[1]?.addEventListener('click', clickHandler);

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Select the equivalent fraction',
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.selectedChoice).toBe(1);
            expect(clickHandler).toHaveBeenCalled();
        });

        it('should find equivalent fraction 3/6 = 1/2', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{3}{6}</annotation>';

            const choices = [
                createChoice('\\frac{1}{2}'),
                createChoice('\\frac{2}{3}'),
            ];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Select the equivalent fraction',
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.selectedChoice).toBe(0);
        });

        it('should return failure when no equivalent found', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{2}</annotation>';

            const choices = [
                createChoice('\\frac{1}{3}'),
                createChoice('\\frac{2}{3}'),
            ];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Select the equivalent fraction',
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(false);
        });
    });
});

function createChoice(latex: string): Element {
    const choice = document.createElement('div');
    choice.innerHTML = `<annotation>${latex}</annotation>`;
    return choice;
}
