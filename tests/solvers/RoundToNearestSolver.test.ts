import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoundToNearestSolver } from '../../src/solvers/RoundToNearestSolver';
import type { IChallengeContext } from '../../src/types';

describe('RoundToNearestSolver', () => {
    let solver: RoundToNearestSolver;

    beforeEach(() => {
        solver = new RoundToNearestSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should return true for rounding challenges', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Round to the nearest 10',
            };
            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return true regardless of case', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'ROUND TO THE NEAREST 100',
            };
            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return false for non-rounding challenges', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Select the correct answer',
            };
            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve with text input', () => {
        it('should type the rounded value for nearest 10', () => {
            const container = document.createElement('div');
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{47}</annotation>';
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container,
                headerText: 'Round to the nearest 10',
                equationContainer,
                textInput,
            };

            const result = solver.solve(context);

            expect(result).not.toBeNull();
            expect(result?.success).toBe(true);
            expect(result?.type).toBe('roundToNearest');
            expect(textInput.value).toBe('50');
        });

        it('should type the rounded value for nearest 100', () => {
            const container = document.createElement('div');
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{247}</annotation>';
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container,
                headerText: 'Round to the nearest 100',
                equationContainer,
                textInput,
            };

            const result = solver.solve(context);

            expect(result).not.toBeNull();
            expect(result?.success).toBe(true);
            expect(textInput.value).toBe('200');
        });

        it('should round down correctly', () => {
            const container = document.createElement('div');
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>23</annotation>';
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container,
                headerText: 'Round to the nearest 10',
                equationContainer,
                textInput,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(textInput.value).toBe('20');
        });
    });

    describe('solve with choices', () => {
        it('should click the correct choice with KaTeX value', () => {
            const container = document.createElement('div');
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>47</annotation>';

            const choices = [
                createChoice('40'),
                createChoice('50'),
                createChoice('60'),
            ];

            const clickHandler = vi.fn();
            choices[1]?.addEventListener('click', clickHandler);

            const context: IChallengeContext = {
                container,
                headerText: 'Round to the nearest 10',
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.selectedChoice).toBe(1);
            expect(clickHandler).toHaveBeenCalled();
        });

        it('should return failure when no matching choice found', () => {
            const container = document.createElement('div');
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>47</annotation>';

            const choices = [
                createChoice('30'),
                createChoice('40'),
                createChoice('60'),
            ];

            const context: IChallengeContext = {
                container,
                headerText: 'Round to the nearest 10',
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should return failure when rounding base cannot be extracted', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Round the number',
                equationContainer: document.createElement('div'),
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(false);
            expect(result?.error).toContain('rounding base');
        });

        it('should return failure when number cannot be extracted', () => {
            const container = document.createElement('div');
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>not a number</annotation>';

            const context: IChallengeContext = {
                container,
                headerText: 'Round to the nearest 10',
                equationContainer,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(false);
        });
    });
});

function createChoice(value: string): Element {
    const choice = document.createElement('div');
    choice.innerHTML = `<annotation>${value}</annotation>`;
    return choice;
}
