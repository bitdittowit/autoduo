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

        // Should have choices (text or visual)
        const choices = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE);
        if (choices.length < 2) {
            return false;
        }

        return true;
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
                this.log('found question cell, left cell ratio:', value);
                if (value && value.includes(':')) {
                    return value;
                }
            }
        }

        this.log('no target ratio found in cells');
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

            let choiceParts: [number, number] | null = null;

            // Try to parse visual diagram from iframe
            const iframe = choice.querySelector('iframe');
            if (iframe) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc) {
                    choiceParts = this.countBlocksInDiagram(srcdoc);
                }
            }

            // If no iframe or failed to parse, try text ratio
            if (!choiceParts) {
                const ratioText = extractKatexValue(choice);
                if (ratioText && ratioText.includes(':')) {
                    choiceParts = this.parseRatio(ratioText);
                }
            }

            if (!choiceParts) {
                this.log('choice', i, 'failed to parse ratio');
                continue;
            }

            this.log(
                'choice',
                i,
                'has ratio:',
                choiceParts[0],
                ':',
                choiceParts[1],
                '(target:',
                targetParts[0],
                ':',
                targetParts[1],
                ')',
            );

            // Check if ratio matches
            if (choiceParts[0] === targetParts[0] && choiceParts[1] === targetParts[1]) {
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
            // Extract only the first SVG (to avoid counting twice for light/dark themes)
            // Look for the first <g id="id0:id0"> section (rectangles) and <g id="id1:id1"> (paths)
            const id0Match = srcdoc.match(/<g id="id0:id0"[^>]*>([\s\S]*?)<\/g>/);
            const id1Match = srcdoc.match(/<g id="id1:id1"[^>]*>([\s\S]*?)<\/g>/);

            if (!id0Match || !id1Match) {
                this.log('could not find id0:id0 or id1:id1 groups');
                return null;
            }

            const rectSection = id0Match[1] || '';
            const pathSection = id1Match[1] || '';

            // Count <rect> elements in id0:id0 group
            const rectMatches = rectSection.match(/<rect\s[^>]*\/?>/g);
            const rectCount = rectMatches ? rectMatches.length : 0;

            // Count <path> elements in id1:id1 group
            const pathMatches = pathSection.match(/<path\s[^>]*\/?>/g);
            const pathCount = pathMatches ? pathMatches.length : 0;

            this.log('counted shapes:', rectCount, 'rects,', pathCount, 'paths');

            // If we found both types, return the counts
            if (rectCount > 0 || pathCount > 0) {
                return [rectCount, pathCount];
            }

            return null;
        } catch (error) {
            this.log('error counting blocks:', error);
            return null;
        }
    }
}
