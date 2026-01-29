import { describe, it, expect, beforeEach } from 'vitest';
import { PieChartSelectFractionSolver } from '../../src/solvers/PieChartSelectFractionSolver';
import type { IChallengeContext } from '../../src/types';

describe('PieChartSelectFractionSolver', () => {
    let solver: PieChartSelectFractionSolver;

    beforeEach(() => {
        solver = new PieChartSelectFractionSolver();
        document.body.innerHTML = '';
    });

    it('should identify pie chart select fraction challenge', () => {
        const container = document.createElement('div');
        container.setAttribute('data-test', 'challenge challenge-mathChallengeBlob');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'Math Web Element');
        iframe.setAttribute('srcdoc', '<svg><circle></circle></svg>');
        container.appendChild(iframe);

        const choice1 = document.createElement('div');
        choice1.setAttribute('data-test', 'challenge-choice');
        const annotation = document.createElement('annotation');
        annotation.textContent = '\\frac{1}{2}';
        choice1.appendChild(annotation);
        container.appendChild(choice1);

        const context: IChallengeContext = {
            container,
            headerText: 'Select the fraction',
            choices: [choice1],
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify without choices', () => {
        const container = document.createElement('div');
        const context: IChallengeContext = {
            container,
            headerText: 'Select the fraction',
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
