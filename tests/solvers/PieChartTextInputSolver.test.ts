import { describe, it, expect, beforeEach } from 'vitest';
import { PieChartTextInputSolver } from '../../src/solvers/PieChartTextInputSolver';
import type { IChallengeContext } from '../../src/types';

describe('PieChartTextInputSolver', () => {
    let solver: PieChartTextInputSolver;

    beforeEach(() => {
        solver = new PieChartTextInputSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should return true when iframe and textInput exist', () => {
            const iframe = createPieChartIframe(3, 4);
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                iframe,
                textInput,
            };

            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return false without iframe', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
                textInput: document.createElement('input'),
            };

            expect(solver.canSolve(context)).toBe(false);
        });

        it('should return false without textInput', () => {
            const iframe = createPieChartIframe(2, 4);

            const context: IChallengeContext = {
                container: document.createElement('div'),
                iframe,
            };

            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve', () => {
        it('should type 3/4 for pie chart with 3 of 4 sectors colored', () => {
            const iframe = createPieChartIframe(3, 4);
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                iframe,
                textInput,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(textInput.value).toBe('3/4');
        });

        it('should type 1/2 for pie chart with 2 of 4 sectors colored', () => {
            const iframe = createPieChartIframe(2, 4);
            const textInput = document.createElement('input');

            const context: IChallengeContext = {
                container: document.createElement('div'),
                iframe,
                textInput,
            };

            const result = solver.solve(context);

            expect(result?.success).toBe(true);
            expect(textInput.value).toBe('2/4');
        });
    });
});

function createPieChartIframe(colored: number, total: number): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Math Web Element');

    let svg = '<span class="dark-img">';
    for (let i = 0; i < colored; i++) {
        svg += '<path fill="#49C0F8" stroke="black" d="..." />';
    }
    for (let i = 0; i < total - colored; i++) {
        svg += '<path fill="#131F24" stroke="black" d="..." />';
    }
    svg += '</span>';

    iframe.setAttribute('srcdoc', svg);
    return iframe;
}
