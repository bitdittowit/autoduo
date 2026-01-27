import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectPieChartSolver } from '../../src/solvers/SelectPieChartSolver';
import type { IChallengeContext } from '../../src/types';

describe('SelectPieChartSolver', () => {
    let solver: SelectPieChartSolver;

    beforeEach(() => {
        solver = new SelectPieChartSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should return true when choices contain pie chart iframes', () => {
            const choices = [createPieChartChoice(2, 4)];

            const context: IChallengeContext = {
                container: document.createElement('div'),
                choices,
            };

            expect(solver.canSolve(context)).toBe(true);
        });

        it('should return false without choices', () => {
            const context: IChallengeContext = {
                container: document.createElement('div'),
            };

            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve', () => {
        it('should select pie chart matching 1/2', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{2}</annotation>';

            const choices = [
                createPieChartChoice(1, 4),  // 0.25
                createPieChartChoice(2, 4),  // 0.5
                createPieChartChoice(3, 4),  // 0.75
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

        it('should evaluate expression 1/4 + 1/4 = 1/2', () => {
            const equationContainer = document.createElement('div');
            equationContainer.innerHTML = '<annotation>\\frac{1}{4}+\\frac{1}{4}=</annotation>';

            const choices = [
                createPieChartChoice(1, 4),
                createPieChartChoice(2, 4),  // Matches 0.5
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

function createPieChartChoice(colored: number, total: number): Element {
    const choice = document.createElement('div');
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Math Web Element');

    // Create SVG with colored and uncolored sectors
    let svg = '<span class="dark-img">';
    for (let i = 0; i < colored; i++) {
        svg += '<path fill="#49C0F8" stroke="black" d="..." />';
    }
    for (let i = 0; i < total - colored; i++) {
        svg += '<path fill="#131F24" stroke="black" d="..." />';
    }
    svg += '</span>';

    iframe.setAttribute('srcdoc', svg);
    choice.appendChild(iframe);
    return choice;
}
