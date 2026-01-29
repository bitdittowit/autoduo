import { describe, it, expect, beforeEach } from 'vitest';
import { MatchPairsSolver } from '../../src/solvers/MatchPairsSolver';
import type { IChallengeContext } from '../../src/types';

describe('MatchPairsSolver', () => {
    let solver: MatchPairsSolver;

    beforeEach(() => {
        solver = new MatchPairsSolver();
        document.body.innerHTML = '';
    });

    it('should identify match pairs challenge', () => {
        const container = document.createElement('div');
        const token1 = document.createElement('div');
        token1.setAttribute('data-test', 'challenge-tap-token');
        token1.innerHTML = '<annotation>1/2</annotation>';
        container.appendChild(token1);

        const token2 = document.createElement('div');
        token2.setAttribute('data-test', 'challenge-tap-token');
        token2.innerHTML = '<annotation>0.5</annotation>';
        container.appendChild(token2);

        const context: IChallengeContext = {
            container,
            headerText: 'Match the pairs',
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
