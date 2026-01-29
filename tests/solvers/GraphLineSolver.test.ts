import { describe, it, expect, beforeEach } from 'vitest';
import { GraphLineSolver } from '../../src/solvers/GraphLineSolver';
import type { IChallengeContext } from '../../src/types';

describe('GraphLineSolver', () => {
    let solver: GraphLineSolver;

    beforeEach(() => {
        solver = new GraphLineSolver();
        document.body.innerHTML = '';
    });

    it('should identify MathDiagram with draggable points', () => {
        const container = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('srcdoc', 'new MathDiagram({}).addDraggablePoint()');
        container.appendChild(iframe);

        const context: IChallengeContext = {
            container,
            headerText: 'Graph the line',
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify non-graph iframe', () => {
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
