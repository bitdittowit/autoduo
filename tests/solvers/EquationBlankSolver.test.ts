import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EquationBlankSolver } from '../../src/solvers/EquationBlankSolver';
import type { IChallengeContext } from '../../src/types';

describe('EquationBlankSolver', () => {
    let solver: EquationBlankSolver;

    beforeEach(() => {
        solver = new EquationBlankSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should return true for equation with blank and choices', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\duoblank{} + 4 = 7</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices: [document.createElement('div')],
            };

            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return false without blank', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>3 + 4 = 7</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices: [document.createElement('div')],
            };

            expect(solver.canSolve(context)).toBe(false);
        });

        it('should return false without equals sign', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\duoblank{} + 4</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices: [document.createElement('div')],
            };

            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve', () => {
        it('should solve X + 4 = 7 and click choice 3', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\duoblank{} + 4 = 7</annotation>';

            const choices = [
                createKatexChoice('1'),
                createKatexChoice('2'),
                createKatexChoice('3'),
            ];

            const clickHandler = vi.fn();
            choices[2]?.addEventListener('click', clickHandler);

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.selectedChoice).toBe(2);
            expect(clickHandler).toHaveBeenCalled();
        });

        it('should solve 5 - X = 2 and click choice 3', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>5 - \\duoblank{} = 2</annotation>';

            const choices = [
                createKatexChoice('1'),
                createKatexChoice('3'),
                createKatexChoice('5'),
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

        it('should solve X * 3 = 15 and click choice 5', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\duoblank{} \\cdot 3 = 15</annotation>';

            const choices = [
                createKatexChoice('3'),
                createKatexChoice('5'),
                createKatexChoice('45'),
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

function createKatexChoice(value: string): Element {
    const choice = document.createElement('div');
    choice.innerHTML = `
        <span class="katex">
            <annotation>${value}</annotation>
            <span class="katex-html">${value}</span>
        </span>
    `;
    return choice;
}
