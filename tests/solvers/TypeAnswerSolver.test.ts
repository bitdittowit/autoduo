import { describe, it, expect, beforeEach } from 'vitest';
import { TypeAnswerSolver } from '../../src/solvers/TypeAnswerSolver';
import type { IChallengeContext } from '../../src/types';

describe('TypeAnswerSolver', () => {
    let solver: TypeAnswerSolver;

    beforeEach(() => {
        solver = new TypeAnswerSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should return true when textInput and equationContainer exist', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                textInput: document.createElement('input'),
                equationContainer: document.createElement('div'),
            };
            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return false when textInput is missing', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer: document.createElement('div'),
            };
            expect(solver.canSolve(context)).toBe(false);
        });

        it('should return false when equationContainer is missing', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                textInput: document.createElement('input'),
            };
            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve - simplify fraction', () => {
        it('should simplify 2/4 to 1/2', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{2}{4}</annotation>';
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                textInput,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.type).toBe('simplifyFraction');
            expect(textInput.value).toBe('1/2');
        });

        it('should simplify 6/8 to 3/4', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{6}{8}</annotation>';
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                textInput,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(textInput.value).toBe('3/4');
        });
    });

    describe('solve - equation with blank', () => {
        it('should solve X + 4 = 7', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\duoblank{} + 4 = 7</annotation>';
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                textInput,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(result?.type).toBe('typeAnswer');
            expect(textInput.value).toBe('3');
        });

        it('should solve 5 - X = 2', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>5 - \\duoblank{} = 2</annotation>';
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                textInput,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(textInput.value).toBe('3');
        });

        it('should solve X * 3 = 15', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\duoblank{} \\cdot 3 = 15</annotation>';
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                textInput,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(textInput.value).toBe('5');
        });

        it('should solve X = 10', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\duoblank{} = 10</annotation>';
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                textInput,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(textInput.value).toBe('10');
        });
    });

    describe('error handling', () => {
        it('should return failure when annotation is missing', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<div>no annotation</div>';
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                equationContainer,
                textInput,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(false);
            expect(result?.error).toContain('annotation');
        });
    });
});
