import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FractionToDecimalChoiceSolver } from '../../src/solvers/FractionToDecimalChoiceSolver';
import type { IChallengeContext } from '../../src/types';

function createChoice(latex: string): HTMLElement {
    const choice = document.createElement('div');
    choice.innerHTML = `<annotation>${latex}</annotation>`;
    return choice;
}

describe('FractionToDecimalChoiceSolver', () => {
    let solver: FractionToDecimalChoiceSolver;

    beforeEach(() => {
        solver = new FractionToDecimalChoiceSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should recognize "show another way" challenge', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{\\frac{8}{10}}</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Show this another way',
                equationContainer,
                choices: [createChoice('\\mathbf{0.8}'), createChoice('\\mathbf{0.9}')],
            };

            expect(solver.canSolve(context)).toBe(true);
        });

        it('should reject challenge without fraction', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{5}</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Show this another way',
                equationContainer,
                choices: [createChoice('\\mathbf{5}')],
            };

            expect(solver.canSolve(context)).toBe(false);
        });

        it('should reject challenge without choices', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{\\frac{8}{10}}</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'Show this another way',
                equationContainer,
            };

            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve', () => {
        it('should convert 8/10 to 0.8', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{\\frac{8}{10}}</annotation>';

            const choices = [
                createChoice('\\mathbf{0.8}'),
                createChoice('\\mathbf{0.9}'),
                createChoice('\\mathbf{0.1}'),
            ];

            const clickHandler = vi.fn();
            choices[0]?.addEventListener('click', clickHandler);

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result).not.toBeNull();
            expect(result?.success).toBe(true);
            expect(result?.type).toBe('fractionToDecimal');
            expect(clickHandler).toHaveBeenCalled();

            if (
                result &&
                'fraction' in result &&
                'decimal' in result &&
                typeof result.fraction === 'object' &&
                result.fraction !== null &&
                'numerator' in result.fraction &&
                'denominator' in result.fraction
            ) {
                expect(result.fraction.numerator).toBe(8);
                expect(result.fraction.denominator).toBe(10);
                expect(result.decimal).toBe(0.8);
                expect(result.selectedChoice).toBe(0);
            }
        });

        it('should convert 3/4 to 0.75', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{3}{4}</annotation>';

            const choices = [
                createChoice('0.5'),
                createChoice('0.75'),
                createChoice('0.25'),
            ];

            const clickHandler = vi.fn();
            choices[1]?.addEventListener('click', clickHandler);

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result).not.toBeNull();
            expect(result?.success).toBe(true);
            expect(clickHandler).toHaveBeenCalled();

            if (result && 'decimal' in result) {
                expect(result.decimal).toBe(0.75);
                expect(result.selectedChoice).toBe(1);
            }
        });

        it('should handle 1/2 = 0.5', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{2}</annotation>';

            const choices = [
                createChoice('0.2'),
                createChoice('0.5'),
                createChoice('0.1'),
            ];

            const clickHandler = vi.fn();
            choices[1]?.addEventListener('click', clickHandler);

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result).not.toBeNull();
            expect(clickHandler).toHaveBeenCalled();

            if (result && 'decimal' in result) {
                expect(result.decimal).toBe(0.5);
                expect(result.selectedChoice).toBe(1);
            }
        });

        it('should fail if no matching decimal found', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{3}</annotation>'; // 0.333...

            const choices = [
                createChoice('0.2'),
                createChoice('0.5'),
                createChoice('0.1'),
            ];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result).not.toBeNull();
            expect(result?.success).toBe(false);
        });
    });
});
