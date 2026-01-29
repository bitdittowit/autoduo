/**
 * Солвер для таблиц с паттернами
 * Вычисляет ответ для выражения в таблице и выбирает правильный вариант
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { evaluateMathExpression } from '../math/expressions';
import { SELECTORS } from '../dom/selectors';
import { extractGridFraction, isGridDiagram } from '../parsers/GridParser';
import { extractBlockDiagramValue, isBlockDiagram } from '../parsers/BlockDiagramParser';

interface IPatternTableResult extends ISolverResult {
    type: 'patternTable';
    expression: string;
    answer: number;
    choiceIndex: number;
}

export class PatternTableSolver extends BaseSolver {
    readonly name = 'PatternTableSolver';

    canSolve(context: IChallengeContext): boolean {
        // Look for pattern table element
        const patternTable = context.container.querySelector('.ihM27');
        if (!patternTable) return false;

        // Should have at least some cells
        const cells = context.container.querySelectorAll('.ihM27');
        return cells.length >= 4;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        // Find all table cells
        const cells = context.container.querySelectorAll('.ihM27');
        this.log('found', cells.length, 'cells');

        // Parse cells into rows (2 cells per row: expression, result)
        const questionExpression = this.findQuestionExpression(cells);

        if (!questionExpression) {
            return this.failure('patternTable', 'Could not find question expression');
        }

        this.log('question expression:', questionExpression);

        // Calculate the answer
        const answer = evaluateMathExpression(questionExpression);
        this.log('calculated answer:', answer);

        if (answer === null) {
            return this.failure('patternTable', 'Could not evaluate expression');
        }

        // Find and click the correct choice
        const choices = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE);
        const choiceIndex = this.findMatchingChoice(choices, answer);

        if (choiceIndex === -1) {
            return this.failure(
                'patternTable',
                `Could not find matching choice for answer ${answer}`,
            );
        }

        // Click the choice
        const choice = choices[choiceIndex];
        if (choice) {
            this.log('clicking choice', choiceIndex);
            this.click(choice);
        }

        return {
            type: 'patternTable',
            success: true,
            expression: questionExpression,
            answer,
            choiceIndex,
        } as IPatternTableResult;
    }

    private findQuestionExpression(cells: NodeListOf<Element>): string | null {
        // Cells alternate: expression (class _15lZ-), result (class pCN63)
        // Find the row where result is "?"
        for (let i = 0; i < cells.length; i += 2) {
            const exprCell = cells[i];
            const resultCell = cells[i + 1];

            if (!exprCell || !resultCell) continue;

            const exprValue = extractKatexValue(exprCell);
            const resultValue = extractKatexValue(resultCell);

            this.logDebug('row', i / 2, '- expression:', exprValue, '- result:', resultValue);

            // Check if this is the question row
            if (resultValue === '?') {
                return exprValue;
            }
        }

        return null;
    }

    private findMatchingChoice(choices: NodeListOf<Element>, answer: number): number {
        this.log('found', choices.length, 'choices');

        for (let i = 0; i < choices.length; i++) {
            const choice = choices[i];
            if (!choice) continue;

            // First, try to extract KaTeX value
            const choiceValue = extractKatexValue(choice);
            this.logDebug('choice', i, '- KaTeX value:', choiceValue);

            if (choiceValue !== null) {
                // Extract number from choice value
                // Handles formats like: "9", "X=9", "X = 9", "9.5", "-5", etc.
                const numberMatch = choiceValue.match(/(-?\d+\.?\d*)/);
                if (numberMatch && numberMatch[1]) {
                    const choiceNum = parseFloat(numberMatch[1]);
                    if (!isNaN(choiceNum) && choiceNum === answer) {
                        this.log('found matching choice at index', i);
                        return i;
                    }
                }

                // Fallback: try parsing the whole string as a number
                const choiceNum = parseFloat(choiceValue);
                if (!isNaN(choiceNum) && choiceNum === answer) {
                    this.log('found matching choice at index', i);
                    return i;
                }
            }

            // If no KaTeX, try to extract value from grid/block diagram in iframe
            const iframe = choice.querySelector('iframe');
            if (iframe) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc) {
                    let diagramValue: number | null = null;

                    // Check for grid diagram
                    if (isGridDiagram(srcdoc)) {
                        const gridFraction = extractGridFraction(srcdoc);
                        if (gridFraction) {
                            diagramValue = gridFraction.numerator / gridFraction.denominator;
                            this.logDebug(
                                'choice',
                                i,
                                '- grid diagram:',
                                `${gridFraction.numerator}/${gridFraction.denominator}`,
                                '=',
                                diagramValue,
                            );
                        }
                    }
                    // Check for block diagram
                    else if (isBlockDiagram(srcdoc)) {
                        const blockValue = extractBlockDiagramValue(srcdoc);
                        // Block diagrams represent counts (e.g., 4 blocks = 0.04)
                        // So divide by 100 to get decimal fraction
                        diagramValue = blockValue !== null ? blockValue / 100 : null;
                        this.logDebug('choice', i, '- block diagram value:', diagramValue);
                    }

                    if (diagramValue !== null) {
                        // Compare with tolerance for floating point
                        const diff = Math.abs(diagramValue - answer);
                        if (diff < 0.0001) {
                            this.log('found matching choice at index', i, 'diagram value:', diagramValue);
                            return i;
                        }
                    }
                }
            }
        }

        return -1;
    }
}
