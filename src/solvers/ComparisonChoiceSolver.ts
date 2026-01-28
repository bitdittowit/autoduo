/**
 * Солвер для заданий на сравнение с выбором ответа
 *
 * Например: "1/4 > ?" с вариантами "1/5" и "5/4"
 * Нужно найти вариант, который делает сравнение истинным.
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { parseFractionExpression } from '../parsers/FractionParser';
import { cleanLatexWrappers, convertLatexFractions } from '../parsers/latex';
import { evaluateMathExpression } from '../math/expressions';

type ComparisonOperator = '<' | '>' | '<=' | '>=';

interface IComparisonResult extends ISolverResult {
    type: 'comparison';
    leftValue: number;
    operator: ComparisonOperator;
    selectedChoice: number;
}

export class ComparisonChoiceSolver extends BaseSolver {
    readonly name = 'ComparisonChoiceSolver';

    /**
     * Проверяет, является ли задание на сравнение
     */
    canSolve(context: IChallengeContext): boolean {
        if (!context.equationContainer || !context.choices?.length) {
            return false;
        }

        // Check if equation contains comparison operator and blank
        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) return false;

        const text = annotation.textContent;

        // Don't match if equation has = sign (that's for EquationBlankSolver)
        if (text.includes('=') && !text.includes('>=') && !text.includes('<=') &&
            !text.includes('\\ge') && !text.includes('\\le')) {
            return false;
        }

        const hasComparison = text.includes('>') || text.includes('<') ||
            text.includes('\\gt') || text.includes('\\lt') ||
            text.includes('\\ge') || text.includes('\\le');
        const hasBlank = text.includes('\\duoblank');

        return hasComparison && hasBlank;
    }

    /**
     * Решает задание
     */
    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.equationContainer || !context.choices?.length) {
            return this.failure('comparison', 'missing equationContainer or choices');
        }

        this.log('starting');

        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) {
            return this.failure('comparison', 'annotation not found');
        }

        const eqText = annotation.textContent;
        this.log('equation =', eqText);

        // Detect comparison operator
        const operator = this.detectOperator(eqText);
        if (!operator) {
            return this.failure('comparison', 'no comparison operator found');
        }

        this.log('operator =', operator);

        // Extract and evaluate left side value
        const leftValue = this.extractLeftValue(eqText, operator);
        if (leftValue === null) {
            return this.failure('comparison', 'could not evaluate left side');
        }

        this.log('left value =', leftValue);

        // Find choice that makes comparison true
        let matchedIndex = -1;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const choiceAnnotation = choice.querySelector('annotation');
            if (!choiceAnnotation?.textContent) continue;

            const choiceFraction = parseFractionExpression(choiceAnnotation.textContent);
            if (!choiceFraction) continue;

            const choiceValue = choiceFraction.value;
            this.logDebug('choice', i, '=', choiceValue);

            if (this.compareValues(leftValue, operator, choiceValue)) {
                matchedIndex = i;
                this.log('found matching choice', i, ':', leftValue, operator, choiceValue);
                break;
            }
        }

        if (matchedIndex === -1) {
            return this.failure('comparison', 'no choice satisfies comparison');
        }

        const matchedChoice = context.choices[matchedIndex];
        if (matchedChoice) {
            this.click(matchedChoice);
            this.log('clicked choice', matchedIndex);
        }

        return this.success<IComparisonResult>({
            type: 'comparison',
            leftValue,
            operator,
            selectedChoice: matchedIndex,
        });
    }

    /**
     * Определяет оператор сравнения
     */
    private detectOperator(text: string): ComparisonOperator | null {
        if (text.includes('<=') || text.includes('\\le')) return '<=';
        if (text.includes('>=') || text.includes('\\ge')) return '>=';
        if (text.includes('<') || text.includes('\\lt')) return '<';
        if (text.includes('>') || text.includes('\\gt')) return '>';
        return null;
    }

    /**
     * Извлекает значение левой части выражения
     */
    private extractLeftValue(eqText: string, _operator: ComparisonOperator): number | null {
        const cleaned = cleanLatexWrappers(eqText);

        // Split by operator to get left side
        const operators = ['<=', '>=', '\\le', '\\ge', '<', '>', '\\lt', '\\gt'];
        let leftSide = cleaned;

        for (const op of operators) {
            if (leftSide.includes(op)) {
                const splitResult = leftSide.split(op)[0];
                if (splitResult !== undefined) {
                    leftSide = splitResult;
                }
                break;
            }
        }

        // Remove \duoblank{...} before evaluating (replace with empty string)
        leftSide = leftSide.replace(/\\duoblank\{[^}]*\}/g, '');

        // Convert fractions to evaluable format
        leftSide = convertLatexFractions(leftSide);

        return evaluateMathExpression(leftSide);
    }

    /**
     * Сравнивает два значения
     */
    private compareValues(left: number, operator: ComparisonOperator, right: number): boolean {
        switch (operator) {
        case '<': return left < right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '>=': return left >= right;
        }
    }
}
