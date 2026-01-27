import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseSolver } from '../../src/solvers/BaseSolver';
import type { IChallengeContext, ISolverResult } from '../../src/types';

// Concrete implementation for testing
class TestSolver extends BaseSolver {
    readonly name = 'TestSolver';

    canSolve(context: IChallengeContext): boolean {
        return context.headerText === 'test';
    }

    solve(_context: IChallengeContext): ISolverResult | null {
        return this.success({ type: 'test', answer: 42 });
    }

    // Expose protected methods for testing
    public testClick(element: Element): void {
        this.click(element);
    }

    public testTypeInput(input: HTMLInputElement, value: string): void {
        this.typeInput(input, value);
    }

    public testHeaderContains(context: IChallengeContext, ...words: string[]): boolean {
        return this.headerContains(context, ...words);
    }

    public testSuccess<T extends ISolverResult>(result: Omit<T, 'success'>): T {
        return this.success<T>(result);
    }

    public testFailure(type: string, error: string): ISolverResult {
        return this.failure(type, error);
    }
}

describe('BaseSolver', () => {
    let solver: TestSolver;

    beforeEach(() => {
        solver = new TestSolver();
        document.body.innerHTML = '';
    });

    describe('click', () => {
        it('should dispatch click event on element', () => {
            const element = document.createElement('button');
            const clickHandler = vi.fn();
            element.addEventListener('click', clickHandler);

            solver.testClick(element);

            expect(clickHandler).toHaveBeenCalled();
        });

        it('should dispatch event with correct properties', () => {
            const element = document.createElement('button');
            let receivedEvent: MouseEvent | undefined;
            element.addEventListener('click', (e) => {
                receivedEvent = e as MouseEvent;
            });

            solver.testClick(element);

            expect(receivedEvent).toBeDefined();
            expect(receivedEvent!.bubbles).toBe(true);
            expect(receivedEvent!.cancelable).toBe(true);
        });
    });

    describe('typeInput', () => {
        it('should set input value', () => {
            const input = document.createElement('input');

            solver.testTypeInput(input, 'test value');

            expect(input.value).toBe('test value');
        });

        it('should dispatch input event', () => {
            const input = document.createElement('input');
            const inputHandler = vi.fn();
            input.addEventListener('input', inputHandler);

            solver.testTypeInput(input, 'test');

            expect(inputHandler).toHaveBeenCalled();
        });
    });

    describe('headerContains', () => {
        it('should return true when all words are present', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'round to the nearest 10',
            };

            expect(solver.testHeaderContains(context, 'round', 'nearest')).toBe(true);
        });

        it('should return false when any word is missing', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'select the answer',
            };

            expect(solver.testHeaderContains(context, 'round', 'nearest')).toBe(false);
        });

        it('should be case-insensitive', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                headerText: 'ROUND TO THE NEAREST',
            };

            expect(solver.testHeaderContains(context, 'round', 'nearest')).toBe(true);
        });

        it('should use header element when headerText is not provided', () => {
            const header = document.createElement('h1');
            header.textContent = 'Round to the nearest 10';

            const context: IChallengeContext = {
                container: document.createElement('div'),
                header,
            };

            expect(solver.testHeaderContains(context, 'round', 'nearest')).toBe(true);
        });
    });

    describe('success', () => {
        it('should create result with success: true', () => {
            const result = solver.testSuccess({ type: 'test', answer: 42 });

            expect(result.success).toBe(true);
            expect(result.type).toBe('test');
            expect(result.answer).toBe(42);
        });
    });

    describe('failure', () => {
        it('should create result with success: false and error', () => {
            const result = solver.testFailure('test', 'something went wrong');

            expect(result.success).toBe(false);
            expect(result.type).toBe('test');
            expect(result.error).toBe('something went wrong');
        });
    });
});
