import { describe, it, expect, beforeEach } from 'vitest';
import { PlotPointsSolver } from '../../src/solvers/PlotPointsSolver';
import type { IChallengeContext } from '../../src/types';

describe('PlotPointsSolver', () => {
    let solver: PlotPointsSolver;

    beforeEach(() => {
        solver = new PlotPointsSolver();
        document.body.innerHTML = '';
    });

    it('should identify Grid2D with draggable points', () => {
        const container = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('srcdoc', 'new Grid2D({}).addDraggablePoint()');
        container.appendChild(iframe);

        const context: IChallengeContext = {
            container,
            headerText: 'Plot the points',
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify non-grid iframe', () => {
        const container = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('srcdoc', 'new NumberLine()');
        container.appendChild(iframe);

        const context: IChallengeContext = {
            container,
            headerText: 'Answer on the line',
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
