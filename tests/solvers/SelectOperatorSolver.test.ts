import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectOperatorSolver } from '../../src/solvers/SelectOperatorSolver';
import type { IChallengeContext } from '../../src/types';

describe('SelectOperatorSolver', () => {
    let solver: SelectOperatorSolver;

    beforeEach(() => {
        solver = new SelectOperatorSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should return true for operator selection with blank and operator choices', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{2} \\duoblank{} \\frac{1}{4}</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices: [
                    createTextChoice('<'),
                    createTextChoice('>'),
                    createTextChoice('='),
                ],
            };
            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return false without blank', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{2} > \\frac{1}{4}</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices: [createTextChoice('<')],
            };
            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve', () => {
        it('should select > for 1/2 _ 1/4', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>{\\frac{1}{2}} \\duoblank{} {\\frac{1}{4}}</annotation>';

            const choices = [
                createTextChoice('<'),
                createTextChoice('>'),
                createTextChoice('='),
            ];

            const clickHandler = vi.fn();
            choices[1]?.addEventListener('click', clickHandler);

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.selectedChoice).toBe(1);
            expect(clickHandler).toHaveBeenCalled();
        });

        it('should select < for 1/4 _ 1/2', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>{\\frac{1}{4}} \\duoblank{} {\\frac{1}{2}}</annotation>';

            const choices = [
                createTextChoice('<'),
                createTextChoice('>'),
                createTextChoice('='),
            ];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.selectedChoice).toBe(0);
        });

        it('should select = for 2/4 _ 1/2', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>{\\frac{2}{4}} \\duoblank{} {\\frac{1}{2}}</annotation>';

            const choices = [
                createTextChoice('<'),
                createTextChoice('>'),
                createTextChoice('='),
            ];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.selectedChoice).toBe(2);
        });
    });
});

function createTextChoice(text: string): Element {
    const choice = document.createElement('div');
    choice.textContent = text;
    return choice;
}
