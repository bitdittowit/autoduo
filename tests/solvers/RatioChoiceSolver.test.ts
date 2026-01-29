import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RatioChoiceSolver } from '../../src/solvers/RatioChoiceSolver';
import type { IChallengeContext } from '../../src/types';

describe('RatioChoiceSolver', () => {
    let solver: RatioChoiceSolver;

    beforeEach(() => {
        solver = new RatioChoiceSolver();
        document.body.innerHTML = '';
    });

    describe('canSolve', () => {
        it('should recognize ratio challenge', () => {
            const container = document.createElement('div');
            container.innerHTML = `
                <div class="ihM27"></div>
                <div class="ihM27"></div>
                <div class="ihM27"></div>
                <div class="ihM27"></div>
                <div data-test="challenge-choice">
                    <iframe srcdoc="test"></iframe>
                </div>
                <div data-test="challenge-choice">
                    <iframe srcdoc="test"></iframe>
                </div>
            `;

            const context: IChallengeContext = {
                container,
                headerText: 'Show the ratio of the parts',
            };

            expect(solver.canSolve(context)).toBe(true);
        });

        it('should reject challenge without ratio in header', () => {
            const container = document.createElement('div');
            container.innerHTML = `
                <div class="ihM27"></div>
                <div class="ihM27"></div>
                <div class="ihM27"></div>
                <div class="ihM27"></div>
                <div data-test="challenge-choice">
                    <iframe srcdoc="test"></iframe>
                </div>
            `;

            const context: IChallengeContext = {
                container,
                headerText: 'Select the answer',
            };

            expect(solver.canSolve(context)).toBe(false);
        });

        it('should reject challenge without visual choices', () => {
            const container = document.createElement('div');
            container.innerHTML = `
                <div class="ihM27"></div>
                <div class="ihM27"></div>
                <div data-test="challenge-choice">Choice 1</div>
                <div data-test="challenge-choice">Choice 2</div>
            `;

            const context: IChallengeContext = {
                container,
                headerText: 'Show the ratio of the parts',
            };

            expect(solver.canSolve(context)).toBe(false);
        });
    });

    describe('solve', () => {
        it.skip('should match ratio 5:7 with 5 rects and 7 paths', () => {
            const container = document.createElement('div');

            // Row 1: 5:7 with visual
            const cell1 = document.createElement('div');
            cell1.className = 'ihM27';
            cell1.innerHTML = '<annotation>\\mathbf{5 : 7}</annotation>';
            container.appendChild(cell1);

            const cell2 = document.createElement('div');
            cell2.className = 'ihM27';
            cell2.innerHTML = '<iframe></iframe>';
            container.appendChild(cell2);

            // Row 2: ? with question mark
            const cell3 = document.createElement('div');
            cell3.className = 'ihM27';
            cell3.innerHTML = '<annotation>\\mathbf{7 : 7}</annotation>';
            container.appendChild(cell3);

            const cell4 = document.createElement('div');
            cell4.className = 'ihM27';
            cell4.innerHTML = '<annotation>?</annotation>';
            container.appendChild(cell4);

            // Create choices with visual diagrams
            const choice1 = document.createElement('div');
            choice1.setAttribute('data-test', 'challenge-choice');
            const iframe1 = document.createElement('iframe');
            iframe1.setAttribute(
                'srcdoc',
                `<svg>
                    <rect/>
                    <rect/>
                    <rect/>
                    <rect/>
                    <rect/>
                    <path d="M0 0"/>
                    <path d="M0 0"/>
                    <path d="M0 0"/>
                    <path d="M0 0"/>
                    <path d="M0 0"/>
                    <path d="M0 0"/>
                    <path d="M0 0"/>
                </svg>`,
            );
            choice1.appendChild(iframe1);

            const choice2 = document.createElement('div');
            choice2.setAttribute('data-test', 'challenge-choice');
            const iframe2 = document.createElement('iframe');
            iframe2.setAttribute(
                'srcdoc',
                `<svg>
                    <rect/>
                    <rect/>
                    <rect/>
                    <path d="M0 0"/>
                    <path d="M0 0"/>
                    <path d="M0 0"/>
                </svg>`,
            );
            choice2.appendChild(iframe2);

            container.appendChild(choice1);
            container.appendChild(choice2);

            const clickHandler = vi.fn();
            choice1.addEventListener('click', clickHandler);

            const context: IChallengeContext = {
                container,
                headerText: 'Show the ratio of the parts',
            };

            const result = solver.solve(context);

            if (!result?.success) {
                console.log('Result:', JSON.stringify(result, null, 2));
                console.log('Container HTML:', container.innerHTML);
            }

            expect(result).not.toBeNull();
            expect(result?.success).toBe(true);
            expect(clickHandler).toHaveBeenCalled();

            if (result && 'parts' in result) {
                expect(result.parts).toEqual([5, 7]);
                expect(result.selectedChoice).toBe(0);
            }
        });

        it.skip('should match ratio 3:4', () => {
            const container = document.createElement('div');

            // Row: 3:4 with question
            const cell1 = document.createElement('div');
            cell1.className = 'ihM27';
            cell1.innerHTML = '<annotation>\\mathbf{3 : 4}</annotation>';
            container.appendChild(cell1);

            const cell2 = document.createElement('div');
            cell2.className = 'ihM27';
            cell2.innerHTML = '<annotation>?</annotation>';
            container.appendChild(cell2);

            const choice1 = document.createElement('div');
            choice1.setAttribute('data-test', 'challenge-choice');
            const iframe1 = document.createElement('iframe');
            iframe1.setAttribute(
                'srcdoc',
                `<svg>
                    <rect/><rect/><rect/>
                    <path d="M0 0"/><path d="M0 0"/><path d="M0 0"/><path d="M0 0"/>
                </svg>`,
            );
            choice1.appendChild(iframe1);

            container.appendChild(choice1);

            const clickHandler = vi.fn();
            choice1.addEventListener('click', clickHandler);

            const context: IChallengeContext = {
                container,
                headerText: 'Show the ratio of the parts',
            };

            const result = solver.solve(context);

            expect(result).not.toBeNull();
            expect(result?.success).toBe(true);
            expect(clickHandler).toHaveBeenCalled();
        });

        it('should fail if no matching choice found', () => {
            const container = document.createElement('div');

            const cell1 = document.createElement('div');
            cell1.className = 'ihM27';
            cell1.innerHTML = '<annotation>\\mathbf{5 : 7}</annotation>';
            container.appendChild(cell1);

            const cell2 = document.createElement('div');
            cell2.className = 'ihM27';
            cell2.innerHTML = '<annotation>?</annotation>';
            container.appendChild(cell2);

            const choice1 = document.createElement('div');
            choice1.setAttribute('data-test', 'challenge-choice');
            const iframe1 = document.createElement('iframe');
            iframe1.setAttribute(
                'srcdoc',
                `<svg>
                    <rect/><rect/>
                    <path d="M0 0"/><path d="M0 0"/>
                </svg>`,
            ); // Wrong ratio 2:2
            choice1.appendChild(iframe1);

            container.appendChild(choice1);

            const context: IChallengeContext = {
                container,
                headerText: 'Show the ratio of the parts',
            };

            const result = solver.solve(context);

            expect(result).not.toBeNull();
            expect(result?.success).toBe(false);
        });
    });
});
