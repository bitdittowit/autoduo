import { describe, it, expect, beforeEach } from 'vitest';
import { BlockDiagramChoiceSolver } from '../../src/solvers/BlockDiagramChoiceSolver';
import type { IChallengeContext } from '../../src/types';

describe('BlockDiagramChoiceSolver', () => {
    let solver: BlockDiagramChoiceSolver;
    let mockContainer: HTMLElement;

    beforeEach(() => {
        solver = new BlockDiagramChoiceSolver();
        mockContainer = document.createElement('div');
        document.body.appendChild(mockContainer);
    });

    it('should identify block diagram choice challenges', () => {
        mockContainer.innerHTML = `
            <h1 data-test="challenge-header">
                <div>Show this another way</div>
            </h1>
            <iframe title="Math Web Element" srcdoc="<svg><rect fill='#1CB0F6'/></svg>"></iframe>
            <div>
                <button data-test="challenge-choice">
                    <span class="katex">
                        <span class="katex-mathml">
                            <math><semantics><mrow><mn>10</mn></mrow></semantics></math>
                        </span>
                    </span>
                </button>
                <button data-test="challenge-choice">
                    <span class="katex">
                        <span class="katex-mathml">
                            <math><semantics><mrow><mn>20</mn></mrow></semantics></math>
                        </span>
                    </span>
                </button>
            </div>
        `;

        const header = mockContainer.querySelector('[data-test="challenge-header"]') as HTMLElement;
        const context: IChallengeContext = {
            container: mockContainer,
            header,
            choices: Array.from(mockContainer.querySelectorAll('[data-test="challenge-choice"]')),
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify challenges without block diagram', () => {
        mockContainer.innerHTML = `
            <h1 data-test="challenge-header">
                <span class="katex">Show this another way</span>
            </h1>
            <iframe title="Math Web Element" srcdoc="<div>Not SVG</div>"></iframe>
            <div>
                <button data-test="challenge-choice">10</button>
                <button data-test="challenge-choice">20</button>
            </div>
        `;

        const context: IChallengeContext = {
            container: mockContainer,
            choices: Array.from(mockContainer.querySelectorAll('[data-test="challenge-choice"]')),
        };

        expect(solver.canSolve(context)).toBe(false);
    });

    it('should not identify challenges without choices', () => {
        mockContainer.innerHTML = `
            <h1 data-test="challenge-header">
                <span class="katex">Show this another way</span>
            </h1>
            <iframe title="Math Web Element" srcdoc="<svg><rect fill='#1CB0F6'/></svg>"></iframe>
            <input type="text" />
        `;

        const context: IChallengeContext = {
            container: mockContainer,
            choices: [],
        };

        expect(solver.canSolve(context)).toBe(false);
    });

    it('should not identify challenges without correct header', () => {
        mockContainer.innerHTML = `
            <h1 data-test="challenge-header">
                <span class="katex">Round to nearest 10</span>
            </h1>
            <iframe title="Math Web Element" srcdoc="<svg><rect fill='#1CB0F6'/></svg>"></iframe>
            <button data-test="challenge-choice">10</button>
        `;

        const context: IChallengeContext = {
            container: mockContainer,
            choices: Array.from(mockContainer.querySelectorAll('[data-test="challenge-choice"]')),
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
