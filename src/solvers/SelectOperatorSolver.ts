/**
 * Солвер для заданий на выбор оператора сравнения
 *
 * Например: "1/2 _ 1/4" с вариантами "<", ">", "="
 * Нужно выбрать правильный оператор.
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { cleanLatexWrappers, convertLatexFractions } from '../parsers/latex';
import { evaluateMathExpression } from '../math/expressions';

type Operator = '<' | '>' | '=';

interface ISelectOperatorResult extends ISolverResult {
    type: 'selectOperator';
    leftValue: number;
    rightValue: number;
    operator: Operator;
    selectedChoice: number;
}

export class SelectOperatorSolver extends BaseSolver {
    readonly name = 'SelectOperatorSolver';

    /**
     * Проверяет, является ли задание на выбор оператора
     */
    canSolve(context: IChallengeContext): boolean {
        if (!context.equationContainer || !context.choices?.length) {
            return false;
        }

        // Check if equation contains blank between two values
        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) return false;

        const text = annotation.textContent;
        const hasBlank = text.includes('\\duoblank');

        // Check if choices contain operators
        const hasOperatorChoices = context.choices.some(choice => {
            const choiceText = choice?.textContent?.trim() ?? '';
            return choiceText === '<' || choiceText === '>' || choiceText === '=' ||
                   choiceText.includes('\\lt') || choiceText.includes('\\gt');
        });

        return hasBlank && hasOperatorChoices;
    }

    /**
     * Решает задание
     */
    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.equationContainer || !context.choices?.length) {
            return this.failure('selectOperator', 'missing equationContainer or choices');
        }

        this.log('starting');

        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) {
            return this.failure('selectOperator', 'annotation not found');
        }

        const eqText = annotation.textContent;
        this.log('equation =', eqText);

        // Extract left and right values
        const values = this.extractValues(eqText);
        if (!values) {
            return this.failure('selectOperator', 'could not extract values');
        }

        const { leftValue, rightValue } = values;
        this.log('left =', leftValue, ', right =', rightValue);

        // Determine correct operator
        const correctOperator = this.determineOperator(leftValue, rightValue);
        this.log('correct operator =', correctOperator);

        // Find choice with correct operator
        let matchedIndex = -1;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const choiceOperator = this.parseOperatorFromChoice(choice);
            this.logDebug('choice', i, '=', choiceOperator);

            if (choiceOperator === correctOperator) {
                matchedIndex = i;
                this.log('found matching choice', i);
                break;
            }
        }

        if (matchedIndex === -1) {
            return this.failure('selectOperator', 'no choice matches correct operator');
        }

        const matchedChoice = context.choices[matchedIndex];
        if (matchedChoice) {
            this.click(matchedChoice);
            this.log('clicked choice', matchedIndex);
        }

        return this.success<ISelectOperatorResult>({
            type: 'selectOperator',
            leftValue,
            rightValue,
            operator: correctOperator,
            selectedChoice: matchedIndex,
        });
    }

    /**
     * Извлекает левое и правое значения из уравнения
     */
    private extractValues(eqText: string): { leftValue: number; rightValue: number } | null {
        let cleaned = cleanLatexWrappers(eqText);

        // Replace blank with marker
        cleaned = cleaned.replace(/\\duoblank\{[^}]*\}/g, ' BLANK ');

        // Remove LaTeX spacing
        cleaned = cleaned.replace(/\\[;,]/g, ' ');
        cleaned = cleaned.replace(/\\quad/g, ' ');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // Split by BLANK
        const parts = cleaned.split('BLANK');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            this.logError('could not split by BLANK');
            return null;
        }

        let leftPart = parts[0].trim();
        let rightPart = parts[1].trim();

        // Remove outer braces
        leftPart = this.removeBraces(leftPart);
        rightPart = this.removeBraces(rightPart);

        // Convert fractions
        leftPart = convertLatexFractions(leftPart);
        rightPart = convertLatexFractions(rightPart);

        // Remove remaining braces
        leftPart = leftPart.replace(/[{}]/g, '').trim();
        rightPart = rightPart.replace(/[{}]/g, '').trim();

        // Evaluate
        const leftValue = evaluateMathExpression(leftPart);
        const rightValue = evaluateMathExpression(rightPart);

        if (leftValue === null || rightValue === null) {
            this.logError('could not evaluate values');
            return null;
        }

        return { leftValue, rightValue };
    }

    /**
     * Удаляет внешние скобки
     */
    private removeBraces(str: string): string {
        let result = str.trim();
        if (result.startsWith('{') && result.endsWith('}')) {
            result = result.substring(1, result.length - 1);
        }
        return result;
    }

    /**
     * Определяет правильный оператор
     */
    private determineOperator(left: number, right: number): Operator {
        const epsilon = 0.0001;
        if (Math.abs(left - right) < epsilon) return '=';
        if (left < right) return '<';
        return '>';
    }

    /**
     * Извлекает оператор из варианта ответа
     */
    private parseOperatorFromChoice(choice: Element): Operator | null {
        const text = choice.textContent?.trim() ?? '';

        // Check annotation first (for KaTeX)
        const annotation = choice.querySelector('annotation');
        const annotationText = annotation?.textContent?.trim() ?? '';

        const checkText = annotationText || text;

        if (checkText.includes('\\lt') || checkText === '<') return '<';
        if (checkText.includes('\\gt') || checkText === '>') return '>';
        if (checkText === '=' || checkText.includes('=')) return '=';

        return null;
    }
}
