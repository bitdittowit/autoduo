import { describe, it, expect, beforeEach } from 'vitest';
import { SelectMatchInequalitySolver } from '../../src/solvers/SelectMatchInequalitySolver';
import type { IChallengeContext } from '../../src/types';

describe('SelectMatchInequalitySolver', () => {
    let solver: SelectMatchInequalitySolver;

    beforeEach(() => {
        solver = new SelectMatchInequalitySolver();
        document.body.innerHTML = '';
    });

    it('should identify select match with NumberLine', () => {
        const container = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('srcdoc', 'new NumberLine()');
        container.appendChild(iframe);

        const choice1 = document.createElement('div');
        choice1.setAttribute('data-test', 'challenge-choice');
        choice1.innerHTML = '<annotation>x ≥ 9</annotation>';
        container.appendChild(choice1);

        const context: IChallengeContext = {
            container,
            headerText: 'Select the match',
            choices: [choice1],
        };

        expect(solver.canSolve(context)).toBe(true);
    });

    it('should not identify without header', () => {
        const container = document.createElement('div');
        const context: IChallengeContext = {
            container,
            headerText: 'Answer the question',
        };

        expect(solver.canSolve(context)).toBe(false);
    });
});
