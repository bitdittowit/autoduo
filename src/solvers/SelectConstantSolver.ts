/**
 * Солвер для заданий "Select the constant of proportionality"
 * Извлекает коэффициент из уравнения вида y = mx и выбирает правильный вариант
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { cleanLatexWrappers, convertLatexOperators, convertLatexFractions } from '../parsers/latex';
import { evaluateMathExpression } from '../math/expressions';

interface ISelectConstantResult extends ISolverResult {
    type: 'selectConstant';
    constant: number;
    selectedChoice: number;
}

/**
 * Извлекает коэффициент пропорциональности из уравнения вида y = mx или y = mx + b
 * Поддерживает дробные коэффициенты
 */
function extractConstantFromEquation(equation: string): number | null {
    // Clean LaTeX
    let cleaned = cleanLatexWrappers(equation);
    cleaned = convertLatexOperators(cleaned);
    cleaned = convertLatexFractions(cleaned);
    cleaned = cleaned.replace(/\s+/g, '');

    // Pattern 1: y = mx (simple number coefficient)
    let match = cleaned.match(/^y=(-?\d+\.?\d*)x$/);
    if (match && match[1] !== undefined) {
        const m = parseFloat(match[1]);
        if (!Number.isNaN(m)) {
            return m;
        }
    }

    // Pattern 2: y = (expression)x where expression can be evaluated (e.g., y=(1/2)x)
    match = cleaned.match(/^y=(.+?)x$/);
    if (match && match[1] !== undefined) {
        const coefficientExpr = match[1];
        const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
        const evaluated = evaluateMathExpression(cleanedCoeff);
        if (evaluated !== null) {
            return evaluated;
        }
    }

    // Pattern 3: y = mx + b or y = mx - b (we still want the coefficient m)
    match = cleaned.match(/^y=(-?\d+\.?\d*)x[+-](-?\d+\.?\d*)$/);
    if (match && match[1] !== undefined) {
        const m = parseFloat(match[1]);
        if (!Number.isNaN(m)) {
            return m; // Return coefficient, ignore b
        }
    }

    // Pattern 4: y = (expression)x + b or y = (expression)x - b
    match = cleaned.match(/^y=(.+?)x[+-](-?\d+\.?\d*)$/);
    if (match && match[1] !== undefined) {
        const coefficientExpr = match[1];
        const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
        const evaluated = evaluateMathExpression(cleanedCoeff);
        if (evaluated !== null) {
            return evaluated; // Return coefficient, ignore b
        }
    }

    return null;
}

export class SelectConstantSolver extends BaseSolver {
    readonly name = 'SelectConstantSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check header for "select the constant of proportionality"
        const headerMatches = this.headerContains(context, 'select', 'constant', 'proportionality');
        if (!headerMatches) {
            return false;
        }

        // Check for choices
        if (!context.choices?.length) {
            return false;
        }

        // Check if there's an equation displayed (y = mx format)
        // The equation might be in the challenge container or in a separate element
        const containerText = context.container.textContent || '';
        const hasEquation = containerText.includes('y') && containerText.includes('=') && containerText.includes('x');

        return hasEquation;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        if (!context.choices?.length) {
            return this.failure('selectConstant', 'no choices found');
        }

        // Extract equation from the challenge
        // The equation might be displayed in KaTeX format
        let equation: string | null = null;

        // Method 1: Look for equation in KaTeX annotations
        const annotations = context.container.querySelectorAll('annotation');
        for (const annotation of annotations) {
            const text = annotation.textContent;
            if (!text) continue;

            // Check if it looks like an equation (y = ...)
            if (text.includes('y') && text.includes('=') && text.includes('x')) {
                const katexValue = extractKatexValue(annotation.parentElement);
                if (katexValue) {
                    equation = katexValue;
                    break;
                }
            }
        }

        // Method 2: Look for equation in the challenge container directly
        if (!equation) {
            // Try to find KaTeX elements that contain equations
            const katexElements = context.container.querySelectorAll('.katex');
            for (const katexEl of Array.from(katexElements)) {
                const katexValue = extractKatexValue(katexEl);
                if (katexValue && katexValue.includes('y') && katexValue.includes('=') && katexValue.includes('x')) {
                    equation = katexValue;
                    break;
                }
            }
        }

        // Method 3: Extract from text content using regex
        if (!equation) {
            const containerText = context.container.textContent || '';
            const equationMatch = containerText.match(/y\s*=\s*([^\s]+)\s*x/);
            if (equationMatch && equationMatch[1]) {
                equation = `y=${equationMatch[1]}x`;
            }
        }

        if (!equation) {
            return this.failure('selectConstant', 'could not extract equation from challenge');
        }

        this.log('extracted equation:', equation);

        // Extract constant of proportionality
        const constant = extractConstantFromEquation(equation);
        if (constant === null) {
            return this.failure('selectConstant', `could not extract constant from equation: ${equation}`);
        }

        this.log('extracted constant:', constant);

        // Find matching choice
        let matchedIndex = -1;
        const tolerance = 0.0001;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            // Extract value from choice (could be KaTeX or plain text)
            const katexValue = extractKatexValue(choice);
            let choiceValue: number | null = null;

            if (katexValue) {
                // Try to evaluate as math expression
                choiceValue = evaluateMathExpression(katexValue);
            }

            // Fallback: try to parse as number from text content
            if (choiceValue === null) {
                const choiceText = choice.textContent || '';
                const numberMatch = choiceText.match(/(-?\d+\.?\d*)/);
                if (numberMatch && numberMatch[1]) {
                    choiceValue = parseFloat(numberMatch[1]);
                }
            }

            if (choiceValue === null || Number.isNaN(choiceValue)) {
                this.log(`choice ${i}: could not extract value`);
                continue;
            }

            this.log(`choice ${i}: ${katexValue || choice.textContent} -> ${choiceValue}`);

            // Compare with tolerance for floating-point comparison
            if (Math.abs(choiceValue - constant) < tolerance) {
                matchedIndex = i;
                this.log(`matched choice ${i}: ${choiceValue}`);
                break;
            }
        }

        if (matchedIndex === -1) {
            return this.failure('selectConstant', `no matching choice found for constant: ${constant}`);
        }

        // Click the matched choice
        const choiceButtons = context.container.querySelectorAll('[data-test="challenge-choice"]');
        const choiceButton = choiceButtons[matchedIndex];

        if (!choiceButton) {
            return this.failure('selectConstant', `choice button ${matchedIndex} not found`);
        }

        try {
            (choiceButton as HTMLElement).click();
            this.log(`clicked choice ${matchedIndex}`);
        } catch (e) {
            return this.failure('selectConstant', `error clicking choice: ${e}`);
        }

        return {
            type: 'selectConstant',
            success: true,
            constant,
            selectedChoice: matchedIndex,
        } as ISelectConstantResult;
    }
}
