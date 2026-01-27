import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComparisonChoiceSolver } from '../../src/solvers/ComparisonChoiceSolver';
import type { IChallengeContext } from '../../src/types';

describe('ComparisonChoiceSolver', () => {
    let solver: ComparisonChoiceSolver;

    beforeEach(() => {
        solver = new ComparisonChoiceSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should return true for comparison with blank', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{4} > \\duoblank{}</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices: [document.createElement('div')],
            };
            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return false without comparison operator', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{4} = \\duoblank{}</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices: [document.createElement('div')],
            };
            expect(solver.canSolve(context)).toBe(false);
        });

        it('should return false without blank', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{4} > \\frac{1}{5}</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices: [document.createElement('div')],
            };
            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve', () => {
        it('should find choice that satisfies 1/4 > ?', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{4} > \\duoblank{}</annotation>';

            const choices = [
                createChoice('\\frac{1}{5}'),  // 0.2 - makes 0.25 > 0.2 TRUE
                createChoice('\\frac{1}{2}'),  // 0.5 - makes 0.25 > 0.5 FALSE
            ];

            const clickHandler = vi.fn();
            choices[0]?.addEventListener('click', clickHandler);

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.selectedChoice).toBe(0);
            expect(clickHandler).toHaveBeenCalled();
        });

        it('should find choice that satisfies 1/2 < ?', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{2} < \\duoblank{}</annotation>';

            const choices = [
                createChoice('\\frac{1}{4}'),  // 0.25 - makes 0.5 < 0.25 FALSE
                createChoice('\\frac{3}{4}'),  // 0.75 - makes 0.5 < 0.75 TRUE
            ];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.selectedChoice).toBe(1);
        });
    });
});

function createChoice(latex: string): Element {
    const choice = document.createElement('div');
    choice.innerHTML = `<annotation>${latex}</annotation>`;
    return choice;
}
