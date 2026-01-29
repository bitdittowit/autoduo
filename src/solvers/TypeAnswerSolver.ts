/**
 * Солвер для заданий с вводом ответа (Type the answer)
 *
 * Поддерживает:
 * - Уравнения с пропуском (X + 4 = 7)
 * - Упрощение дробей (2/4 -> 1/2)
 * - Неравенства с пропуском (5/5 > ?)
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, IEquationResult, IFractionResult, ISolverResult } from '../types';
import { simplifyFraction } from '../math/fractions';
import { parseFractionExpression } from '../parsers/FractionParser';
import {
    solveEquationWithBlank,
    solveInequalityWithBlank,
} from '../math/equations';

export class TypeAnswerSolver extends BaseSolver {
    readonly name = 'TypeAnswerSolver';

    /**
     * Проверяет, является ли задание заданием с вводом ответа
     * Это catch-all солвер для заданий с текстовым полем
     */
    canSolve(context: IChallengeContext): boolean {
        // Must have text input and equation container
        return context.textInput != null && context.equationContainer != null;
    }

    /**
     * Решает задание с вводом ответа
     */
    solve(context: IChallengeContext): ISolverResult | null {
        if (!context.textInput || !context.equationContainer) {
            return this.failure('typeAnswer', 'missing textInput or equationContainer');
        }

        this.log('starting');

        // Extract equation from annotation
        const annotation = context.equationContainer.querySelector('annotation');
        if (!annotation?.textContent) {
            return this.failure('typeAnswer', 'annotation not found');
        }

        const equation = annotation.textContent;
        this.log('equation =', equation);

        // Try different solving strategies
        const result = this.trySolveSimplifyFraction(context.textInput, equation)
            ?? this.trySolveInequality(context.textInput, equation)
            ?? this.trySolveEquationWithBlank(context.textInput, equation);

        return result;
    }

    /**
     * Пробует решить как задание на упрощение дроби
     */
    private trySolveSimplifyFraction(
        textInput: HTMLInputElement,
        equation: string,
    ): IFractionResult | null {
        // Check if it's a simplify fraction type (no =, no \duoblank)
        if (equation.includes('=') || equation.includes('\\duoblank')) {
            return null;
        }

        this.log('detected SIMPLIFY FRACTION type');

        const fractionResult = parseFractionExpression(equation);
        if (!fractionResult) {
            this.logDebug('could not parse fraction from expression');
            return null;
        }

        this.log('parsed fraction:', `${fractionResult.numerator}/${fractionResult.denominator}`);

        // Simplify the fraction
        const simplified = simplifyFraction(fractionResult.numerator, fractionResult.denominator);
        this.log('simplified to:', `${simplified.numerator}/${simplified.denominator}`);

        // Format and type the answer
        const answer = `${simplified.numerator}/${simplified.denominator}`;
        this.typeInput(textInput, answer);
        this.log('typed answer:', answer);

        return this.success<IFractionResult>({
            type: 'simplifyFraction',
            original: fractionResult,
            simplified,
            answer,
        });
    }

    /**
     * Пробует решить как неравенство с пропуском
     */
    private trySolveInequality(
        textInput: HTMLInputElement,
        equation: string,
    ): IEquationResult | null {
        const hasBlank = equation.includes('\\duoblank');
        if (!hasBlank) {
            return null;
        }

        // Check for explicit inequality operators first (before checking for =)
        const hasExplicitInequality =
            equation.includes('>=') || equation.includes('<=') ||
            equation.includes('\\ge') || equation.includes('\\le') ||
            equation.includes('\\gt') || equation.includes('\\lt');

        // If equation has = sign, it's an equation, not an inequality (unless it has explicit inequality operators)
        if (equation.includes('=')) {
            // If there's an = sign but no explicit inequality operators, it's an equation
            if (!hasExplicitInequality) {
                return null; // This is an equation, not an inequality
            }
        }

        // Check for inequality operators (only if no = sign, or if = sign with explicit inequality operators)
        // Must check for >= and <= BEFORE checking for standalone > or <
        const hasInequality =
            hasExplicitInequality ||
            // Check for standalone > or < that are not part of \left or \right commands
            // AND not part of >= or <=
            (equation.includes('>') && !equation.includes('\\left') && !equation.includes('\\right') && !equation.includes('>=')) ||
            (equation.includes('<') && !equation.includes('\\left') && !equation.includes('\\right') && !equation.includes('<='));

        if (!hasInequality) {
            return null;
        }

        this.log('detected INEQUALITY with blank type');

        const answer = solveInequalityWithBlank(equation);
        if (answer === null) {
            this.logDebug('could not solve inequality');
            return null;
        }

        this.typeInput(textInput, answer);
        this.log('typed answer:', answer);

        return this.success<IEquationResult>({
            type: 'typeAnswer',
            equation,
            answer,
        });
    }

    /**
     * Пробует решить как уравнение с пропуском
     */
    private trySolveEquationWithBlank(
        textInput: HTMLInputElement,
        equation: string,
    ): IEquationResult | null {
        this.log('solving as equation with blank');

        const answer = solveEquationWithBlank(equation);
        if (answer === null) {
            return this.failure('typeAnswer', 'could not solve equation') as IEquationResult | null;
        }

        this.typeInput(textInput, answer.toString());
        this.log('typed answer:', answer);

        return this.success<IEquationResult>({
            type: 'typeAnswer',
            equation,
            answer,
        });
    }
}
