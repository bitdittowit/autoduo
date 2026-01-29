/**
 * Solver for "Show the ratio of the parts" challenges
 *
 * These challenges show examples of ratios with visual representations (block diagrams)
 * and ask to identify the correct visual representation for a given ratio.
 *
 * Example:
 * - 5:7 → image with 5 squares and 7 triangles
 * - 6:7 → image with 6 squares and 7 triangles
 * - 7:7 → ? (find the correct image)
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { SELECTORS } from '../dom/selectors';

interface IRatioChoiceResult extends ISolverResult {
    type: 'ratioChoice';
    ratio: string;
    parts: [number, number];
    selectedChoice: number;
}

export class RatioChoiceSolver extends BaseSolver {
    readonly name = 'RatioChoiceSolver';

    /**
     * Checks if this is a ratio challenge
     */
    canSolve(context: IChallengeContext): boolean {
        // Check header for "ratio"
        const headerText = this.getHeaderText(context);
        if (!headerText.includes('ratio')) {
            return false;
        }

        // Should have pattern table cells
        const cells = context.container.querySelectorAll('.ihM27');
        if (cells.length < 4) {
            return false;
        }

        // Should have choices with iframes (visual diagrams)
        const choices = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE);
        if (choices.length < 2) {
            return false;
        }

        // At least one choice should have an iframe (visual diagram)
        let hasVisualChoice = false;
        for (const choice of choices) {
            const iframe = choice.querySelector('iframe');
            if (iframe) {
                hasVisualChoice = true;
                break;
            }
        }

        return hasVisualChoice;
    }

    /**
     * Solves the challenge
     */
    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        // Find all table cells
        const cells = context.container.querySelectorAll('.ihM27');
        this.log('found', cells.length, 'cells');

        // Find the question cell (contains "?")
        const targetRatio = this.findTargetRatio(cells);
        if (!targetRatio) {
            this.log('failed to find target ratio');
            return this.failure('ratioChoice', 'Could not find target ratio');
        }

        this.log('target ratio:', targetRatio);

        // Parse the ratio (e.g., "7:7" → [7, 7])
        const parts = this.parseRatio(targetRatio);
        if (!parts) {
            this.log('failed to parse ratio:', targetRatio);
            return this.failure('ratioChoice', `Could not parse ratio: ${targetRatio}`);
        }

        this.log('ratio parts:', parts[0], ':', parts[1]);

        // Find and click the matching choice
        const choices = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE);
        this.log('found', choices.length, 'choices');

        const choiceIndex = this.findMatchingChoice(choices, parts);

        if (choiceIndex === -1) {
            return this.failure(
                'ratioChoice',
                `Could not find matching choice for ratio ${parts[0]}:${parts[1]}`,
            );
        }

        // Click the choice
        const choice = choices[choiceIndex];
        if (choice) {
            this.log('clicking choice', choiceIndex);
            this.click(choice);
        }

        return this.success<IRatioChoiceResult>({
            type: 'ratioChoice',
            ratio: targetRatio,
            parts,
            selectedChoice: choiceIndex,
        });
    }

    /**
     * Finds the target ratio from table cells (the one with "?")
     */
    private findTargetRatio(cells: NodeListOf<Element>): string | null {
        // Table structure: pairs of cells (ratio_text, visual_or_question)
        // We need to find the row where the second cell contains "?"

        for (let i = 0; i < cells.length; i += 2) {
            const leftCell = cells[i]; // Should have ratio text
            const rightCell = cells[i + 1]; // Should have visual or "?"

            if (!leftCell || !rightCell) continue;

            // Check if right cell contains "?"
            const hasQuestion = rightCell.textContent?.includes('?');
            if (hasQuestion) {
                // Extract ratio from left cell
                const value = extractKatexValue(leftCell);
                this.logDebug('found question cell, left cell ratio:', value);
                if (value && value.includes(':')) {
                    return value;
                }
            }
        }

        this.logDebug('no target ratio found in cells');
        return null;
    }

    /**
     * Parses a ratio string like "7:7" into [7, 7]
     */
    private parseRatio(ratio: string): [number, number] | null {
        const cleaned = ratio.replace(/\s+/g, '');
        const parts = cleaned.split(':');

        if (parts.length !== 2) {
            return null;
        }

        const first = parseInt(parts[0] || '', 10);
        const second = parseInt(parts[1] || '', 10);

        if (isNaN(first) || isNaN(second)) {
            return null;
        }

        return [first, second];
    }

    /**
     * Finds the choice that matches the target ratio
     */
    private findMatchingChoice(
        choices: NodeListOf<Element>,
        targetParts: [number, number],
    ): number {
        for (let i = 0; i < choices.length; i++) {
            const choice = choices[i];
            if (!choice) continue;

            const iframe = choice.querySelector('iframe');
            if (!iframe) continue;

            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            // Count blocks in the visual diagram
            const counts = this.countBlocksInDiagram(srcdoc);
            if (!counts) continue;

            this.logDebug(
                'choice',
                i,
                'has blocks:',
                counts[0],
                ':',
                counts[1],
                '(target:',
                targetParts[0],
                ':',
                targetParts[1],
                ')',
            );

            // Check if ratio matches
            if (counts[0] === targetParts[0] && counts[1] === targetParts[1]) {
                this.log('found matching choice:', i);
                return i;
            }
        }

        return -1;
    }

    /**
     * Counts blocks of different types in the SVG diagram
     * Returns [count1, count2] for two types of shapes (e.g., squares and triangles)
     */
    private countBlocksInDiagram(srcdoc: string): [number, number] | null {
        try {
            // Count <rect> elements (squares/rectangles)
            const rectMatches = srcdoc.match(/<rect\s[^>]*>/g);
            const rectCount = rectMatches ? rectMatches.length : 0;

            // Count <path> elements (triangles/other shapes)
            const pathMatches = srcdoc.match(/<path\s[^>]*d="[^"]*"/g);
            const pathCount = pathMatches ? pathMatches.length : 0;

            // If we found both types, return the counts
            if (rectCount > 0 || pathCount > 0) {
                return [rectCount, pathCount];
            }

            return null;
        } catch (error) {
            this.logDebug('error counting blocks:', error);
            return null;
        }
    }
}
