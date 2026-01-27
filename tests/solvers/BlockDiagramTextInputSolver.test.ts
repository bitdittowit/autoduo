import { describe, it, expect, beforeEach } from 'vitest';
import { BlockDiagramTextInputSolver } from '../../src/solvers/BlockDiagramTextInputSolver';
import type { IChallengeContext } from '../../src/types';

describe('BlockDiagramTextInputSolver', () => {
    let solver: BlockDiagramTextInputSolver;
    let mockContainer: HTMLElement;

    beforeEach(() => {
        solver = new BlockDiagramTextInputSolver();
        mockContainer = document.createElement('div');
        document.body.appendChild(mockContainer);
    });

    it('should identify block diagram with text input challenges', () => {
        mockContainer.innerHTML = `
            <iframe title="Math Web Element" srcdoc="<svg><rect fill='#1CB0F6'/></svg>"></iframe>
            <input type="text" data-test="challenge-text-input" />
        `;

        const context: IChallengeContext = {
            container: mockContainer,
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify challenges without text input', () => {
        mockContainer.innerHTML = `
            <iframe title="Math Web Element" srcdoc="<svg><rect fill='#1CB0F6'/></svg>"></iframe>
            <button data-test="challenge-choice">10</button>
        `;

        const context: IChallengeContext = {
            container: mockContainer,
            choices: Array.from(mockContainer.querySelectorAll('[data-test="challenge-choice"]')),
        };

        expect(solver.canSolve(context)).toBe(false);
    });

    it('should not identify challenges without block diagram', () => {
        mockContainer.innerHTML = `
            <iframe title="Math Web Element" srcdoc="<div>Not a block diagram</div>"></iframe>
            <input type="text" data-test="challenge-text-input" />
        `;

        const context: IChallengeContext = {
            container: mockContainer,
        };

        expect(solver.canSolve(context)).toBe(false);
    });

    it('should not identify pie chart challenges', () => {
        mockContainer.innerHTML = `
            <iframe title="Math Web Element"
                    srcdoc="<svg><path d='M 100,100 L 100,0 A 100,100 0 0,1 200,100 Z'/></svg>">
            </iframe>
            <input type="text" data-test="challenge-text-input" />
        `;

        const context: IChallengeContext = {
            container: mockContainer,
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
