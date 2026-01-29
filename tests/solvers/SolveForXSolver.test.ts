import { describe, it, expect, beforeEach } from 'vitest';
import { SolveForXSolver } from '../../src/solvers/SolveForXSolver';
import type { IChallengeContext } from '../../src/types';

describe('SolveForXSolver', () => {
    let solver: SolveForXSolver;

    beforeEach(() => {
        solver = new SolveForXSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should return true for "Solve for X" challenge with choices', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{3+X=19}</annotation>';

            const choice = document.createElement('div');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices: [choice],
            };

            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return true for uppercase X in equation', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{X+5=12}</annotation>';

            const choice = document.createElement('div');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices: [choice],
            };

            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return true for lowercase x in equation', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{2*x=10}</annotation>';

            const choice = document.createElement('div');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices: [choice],
            };

            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return false without equation container', () => {
            const choice = document.createElement('div');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                choices: [choice],
            };

            expect(solver.canSolve(context)).toBe(false);
        });

        it('should return false without choices', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{3+X=19}</annotation>';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices: [],
            };

            expect(solver.canSolve(context)).toBe(false);
        });

        it('should return false without "solve for x" header', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{3+X=19}</annotation>';

            const choice = document.createElement('div');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'select the answer',
                equationContainer,
                choices: [choice],
            };

            expect(solver.canSolve(context)).toBe(false);
        });

        it('should return false if equation has no X', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{3+5=8}</annotation>';

            const choice = document.createElement('div');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices: [choice],
            };

            expect(solver.canSolve(context)).toBe(false);
        });

        it('should return false if equation has no equals sign', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{3+X}</annotation>';

            const choice = document.createElement('div');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices: [choice],
            };

            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve', () => {
        it('should solve 3+X=19', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{3+X=19}</annotation>';

            const choices = [
                createKatexChoice('\\mathbf{22}'),
                createKatexChoice('\\mathbf{16}'),
                createKatexChoice('\\mathbf{15}'),
            ];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result).toBeDefined();
            expect(result?.success).toBe(true);
            expect(result?.type).toBe('solveForX');
            expect(result?.answer).toBe(16);
            expect(result?.selectedChoice).toBe(1); // Index of 16
        });

        it('should solve X-7=3', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{X-7=3}</annotation>';

            const choices = [
                createKatexChoice('\\mathbf{4}'),
                createKatexChoice('\\mathbf{10}'),
            ];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result).toBeDefined();
            expect(result?.success).toBe(true);
            expect(result?.answer).toBe(10);
            expect(result?.selectedChoice).toBe(1);
        });

        it('should solve 2*X=14', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{2*X=14}</annotation>';

            const choices = [
                createKatexChoice('\\mathbf{7}'),
                createKatexChoice('\\mathbf{12}'),
            ];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result).toBeDefined();
            expect(result?.success).toBe(true);
            expect(result?.answer).toBe(7);
            expect(result?.selectedChoice).toBe(0);
        });

        it('should return failure if no annotation found', () => {
            const equationContainer = document.createElement('div');
            const choice = document.createElement('div');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices: [choice],
            };

            const result = solver.solve(context);

            expect(result).toBeDefined();
            expect(result?.success).toBe(false);
            expect(result?.error).toContain('annotation not found');
        });

        it('should return failure if no matching choice found', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\mathbf{3+X=19}</annotation>';

            const choices = [
                createKatexChoice('\\mathbf{10}'), // Wrong answer
            ];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'solve for x',
                equationContainer,
                choices,
            };

            const result = solver.solve(context);

            expect(result).toBeDefined();
            expect(result?.success).toBe(false);
            expect(result?.error).toContain('no matching choice');
        });
    });
});

// Helper function to create choice elements with KaTeX
function createKatexChoice(latex: string): Element {
    const choice = document.createElement('div');
    choice.innerHTML = `
        <span class="katex">
            <annotation>${latex}</annotation>
            <span class="katex-html">${latex}</span>
        </span>
    `;
    return choice;
}
