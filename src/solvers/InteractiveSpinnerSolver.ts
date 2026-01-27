/**
 * Солвер для интерактивного спиннера (выбор сегментов)
 * Работает с Spinner в iframe
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { evaluateMathExpression } from '../math/expressions';
import { extractLatexContent, convertLatexFractions } from '../parsers/latex';
import { findAllIframes, findIframeByContent } from '../dom/selectors';

interface ISpinnerResult extends ISolverResult {
    type: 'interactiveSpinner';
    numerator: number;
    denominator: number;
}

// Declare iframe window interface
interface IIframeWindow extends Window {
    getOutputVariables?: () => { selected?: number[] };
    OUTPUT_VARIABLES?: { selected?: number[] };
    postOutputVariables?: () => void;
    duo?: { onFirstInteraction?: () => void };
    duoDynamic?: { onInteraction?: () => void };
}

export class InteractiveSpinnerSolver extends BaseSolver {
    readonly name = 'InteractiveSpinnerSolver';

    canSolve(context: IChallengeContext): boolean {
        const allIframes = findAllIframes(context.container);

        for (const iframe of allIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (srcdoc?.includes('segments:')) {
                return true;
            }
        }

        return false;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        const allIframes = findAllIframes(context.container);
        const spinnerIframe = findIframeByContent(allIframes, 'segments:');

        if (!spinnerIframe) {
            return this.failure('interactiveSpinner', 'No spinner iframe found');
        }

        const srcdoc = spinnerIframe.getAttribute('srcdoc') ?? '';

        // Get spinner segment count
        const segmentsMatch = srcdoc.match(/segments:\s*(\d+)/);
        const spinnerSegments = segmentsMatch?.[1]
            ? parseInt(segmentsMatch[1], 10)
            : null;

        if (!spinnerSegments) {
            return this.failure('interactiveSpinner', 'Could not determine spinner segments');
        }

        this.logDebug('spinner has', spinnerSegments, 'segments');

        // Try different methods to find the target fraction
        let numerator: number | null = null;
        let denominator: number | null = null;
        let equation: string | null = null;

        // Method 1: Inequality with blank
        const inequalityResult = this.tryInequalityWithBlank(context, spinnerSegments);
        if (inequalityResult) {
            numerator = inequalityResult.numerator;
            denominator = inequalityResult.denominator;
            equation = inequalityResult.equation;
        }

        // Method 2: Equation with fractions
        if (numerator === null) {
            const equationResult = this.tryEquationWithFractions(
                context,
                spinnerSegments,
            );
            if (equationResult) {
                numerator = equationResult.numerator;
                denominator = equationResult.denominator;
                equation = equationResult.equation;
            }
        }

        // Method 3: Simple fraction
        if (numerator === null) {
            const fractionResult = this.trySimpleFraction(context);
            if (fractionResult) {
                numerator = fractionResult.numerator;
                denominator = fractionResult.denominator;
                equation = fractionResult.equation;
            }
        }

        // Method 4: KaTeX expression
        if (numerator === null) {
            const katexResult = this.tryKatexExpression(context, spinnerSegments);
            if (katexResult) {
                numerator = katexResult.numerator;
                denominator = katexResult.denominator;
                equation = katexResult.equation;
            }
        }

        if (numerator === null || denominator === null) {
            this.logError('could not extract fraction from challenge');
            return this.failure('interactiveSpinner', 'Could not extract fraction');
        }

        // Adjust numerator if spinner segments don't match denominator
        if (spinnerSegments !== denominator) {
            const fractionValue = numerator / denominator;
            numerator = Math.round(fractionValue * spinnerSegments);
            denominator = spinnerSegments;
            this.log('adjusted to', numerator, '/', denominator);
        }

        // Validate
        if (numerator < 0 || numerator > spinnerSegments) {
            this.logError('invalid numerator', numerator);
            return this.failure('interactiveSpinner', 'Invalid numerator');
        }

        // Set the spinner value
        const success = this.setSpinnerValue(spinnerIframe, numerator);

        this.log('select', numerator, 'segments, success =', success);

        const result: ISpinnerResult = {
            type: 'interactiveSpinner',
            success: true,
            numerator,
            denominator,
        };
        if (equation) {
            result.equation = equation;
        }
        return result;
    }

    private tryInequalityWithBlank(
        context: IChallengeContext,
        spinnerSegments: number,
    ): { numerator: number; denominator: number; equation: string } | null {
        const annotations = context.container.querySelectorAll('annotation');

        for (const annotation of annotations) {
            const text = annotation.textContent ?? '';

            const hasInequality =
                text.includes('>') ||
                text.includes('<') ||
                text.includes('\\gt') ||
                text.includes('\\lt');
            const hasBlank = text.includes('\\duoblank');

            if (!hasInequality || !hasBlank) continue;

            // Clean LaTeX wrappers
            let cleaned = text;
            while (cleaned.includes('\\mathbf{')) {
                cleaned = extractLatexContent(cleaned, '\\mathbf');
            }

            // Detect operator
            let operator: string | null = null;
            let operatorStr = '';

            if (cleaned.includes('>=') || cleaned.includes('\\ge')) {
                operator = '>=';
                operatorStr = cleaned.includes('>=') ? '>=' : '\\ge';
            } else if (cleaned.includes('<=') || cleaned.includes('\\le')) {
                operator = '<=';
                operatorStr = cleaned.includes('<=') ? '<=' : '\\le';
            } else if (cleaned.includes('>') || cleaned.includes('\\gt')) {
                operator = '>';
                operatorStr = cleaned.includes('>') ? '>' : '\\gt';
            } else if (cleaned.includes('<') || cleaned.includes('\\lt')) {
                operator = '<';
                operatorStr = cleaned.includes('<') ? '<' : '\\lt';
            }

            if (!operator) continue;

            const parts = cleaned.split(operatorStr);
            if (parts.length !== 2) continue;

            const leftPart = parts[0]?.trim() ?? '';
            const rightPart = parts[1]?.trim() ?? '';
            const leftHasBlank = leftPart.includes('\\duoblank');
            const knownPart = leftHasBlank ? rightPart : leftPart;

            // Parse known fraction
            let knownValue: number | null = null;
            const fracMatch = knownPart.match(/\\frac\{(\d+)\}\{(\d+)\}/);
            if (fracMatch?.[1] && fracMatch[2]) {
                knownValue =
                    parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10);
            } else {
                const numMatch = knownPart.match(/(\d+)/);
                if (numMatch?.[1]) {
                    knownValue = parseFloat(numMatch[1]);
                }
            }

            if (knownValue === null) continue;

            // Find valid numerator based on inequality
            let targetNumerator: number | null = null;

            if (leftHasBlank) {
                // Blank on LEFT
                if (operator === '>' || operator === '>=') {
                    for (let n = 0; n <= spinnerSegments; n++) {
                        const testValue = n / spinnerSegments;
                        if (
                            operator === '>='
                                ? testValue >= knownValue
                                : testValue > knownValue
                        ) {
                            targetNumerator = n;
                            break;
                        }
                    }
                } else {
                    for (let n = spinnerSegments; n >= 0; n--) {
                        const testValue = n / spinnerSegments;
                        if (
                            operator === '<='
                                ? testValue <= knownValue
                                : testValue < knownValue
                        ) {
                            targetNumerator = n;
                            break;
                        }
                    }
                }
            } else {
                // Blank on RIGHT
                if (operator === '>' || operator === '>=') {
                    for (let n = spinnerSegments; n >= 0; n--) {
                        const testValue = n / spinnerSegments;
                        if (
                            operator === '>='
                                ? testValue <= knownValue
                                : testValue < knownValue
                        ) {
                            targetNumerator = n;
                            break;
                        }
                    }
                } else {
                    for (let n = 0; n <= spinnerSegments; n++) {
                        const testValue = n / spinnerSegments;
                        if (
                            operator === '<='
                                ? testValue >= knownValue
                                : testValue > knownValue
                        ) {
                            targetNumerator = n;
                            break;
                        }
                    }
                }
            }

            if (targetNumerator !== null) {
                return {
                    numerator: targetNumerator,
                    denominator: spinnerSegments,
                    equation: text,
                };
            }
        }

        return null;
    }

    private tryEquationWithFractions(
        context: IChallengeContext,
        spinnerSegments: number,
    ): { numerator: number; denominator: number; equation: string } | null {
        const annotations = context.container.querySelectorAll('annotation');

        for (const annotation of annotations) {
            const text = annotation.textContent ?? '';

            if (!text.includes('=') || !text.includes('\\frac')) continue;

            let cleanText = text;
            while (cleanText.includes('\\mathbf{')) {
                cleanText = extractLatexContent(cleanText, '\\mathbf');
            }

            // Extract left side
            const leftSide = cleanText.split(/=(?:\\duoblank\{[^}]*\})?/)[0] ?? '';

            // Convert fractions and evaluate
            const converted = convertLatexFractions(leftSide);
            const result = evaluateMathExpression(converted.replace(/\s+/g, ''));

            if (result !== null) {
                const calculatedNumerator = Math.round(result * spinnerSegments);

                if (calculatedNumerator >= 0 && calculatedNumerator <= spinnerSegments) {
                    return {
                        numerator: calculatedNumerator,
                        denominator: spinnerSegments,
                        equation: text,
                    };
                }
            }
        }

        return null;
    }

    private trySimpleFraction(
        context: IChallengeContext,
    ): { numerator: number; denominator: number; equation: string } | null {
        const annotations = context.container.querySelectorAll('annotation');

        for (const annotation of annotations) {
            let text = annotation.textContent ?? '';

            // Clean wrappers
            while (text.includes('\\mathbf{')) {
                text = extractLatexContent(text, '\\mathbf');
            }

            // Try \frac{a}{b}
            const fracMatch = text.match(/\\frac\{(\d+)\}\{(\d+)\}/);
            if (fracMatch?.[1] && fracMatch[2]) {
                return {
                    numerator: parseInt(fracMatch[1], 10),
                    denominator: parseInt(fracMatch[2], 10),
                    equation: annotation.textContent ?? '',
                };
            }

            // Try a/b
            const simpleFracMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
            if (simpleFracMatch?.[1] && simpleFracMatch[2]) {
                return {
                    numerator: parseInt(simpleFracMatch[1], 10),
                    denominator: parseInt(simpleFracMatch[2], 10),
                    equation: annotation.textContent ?? '',
                };
            }
        }

        return null;
    }

    private tryKatexExpression(
        context: IChallengeContext,
        spinnerSegments: number,
    ): { numerator: number; denominator: number; equation: string } | null {
        const katexElements = context.container.querySelectorAll('.katex');

        for (const katex of katexElements) {
            const value = extractKatexValue(katex);
            if (!value) continue;

            // Check for expression
            if (value.includes('+') && value.includes('/')) {
                const cleanValue = value.replace(/=.*$/, '');
                const result = evaluateMathExpression(cleanValue);

                if (result !== null) {
                    const calculatedNumerator = Math.round(result * spinnerSegments);

                    if (
                        calculatedNumerator >= 0 &&
                        calculatedNumerator <= spinnerSegments
                    ) {
                        return {
                            numerator: calculatedNumerator,
                            denominator: spinnerSegments,
                            equation: value,
                        };
                    }
                }
            }

            // Try fraction format
            const fracMatch = value.match(/\((\d+)\/(\d+)\)/);
            if (fracMatch?.[1] && fracMatch[2]) {
                return {
                    numerator: parseInt(fracMatch[1], 10),
                    denominator: parseInt(fracMatch[2], 10),
                    equation: value,
                };
            }
        }

        return null;
    }

    private setSpinnerValue(iframe: HTMLIFrameElement, numerator: number): boolean {
        let success = false;

        try {
            const iframeWindow = iframe.contentWindow as IIframeWindow | null;
            if (!iframeWindow) return false;

            // Create selected indices array [0, 1, 2, ...]
            const selectedIndices: number[] = [];
            for (let i = 0; i < numerator; i++) {
                selectedIndices.push(i);
            }

            // Method 1: getOutputVariables
            if (typeof iframeWindow.getOutputVariables === 'function') {
                const vars = iframeWindow.getOutputVariables();
                if (vars && 'selected' in vars) {
                    vars.selected = selectedIndices;
                    success = true;
                    this.log('set selected via getOutputVariables');
                }
            }

            // Method 2: OUTPUT_VARIABLES
            if (!success && iframeWindow.OUTPUT_VARIABLES) {
                iframeWindow.OUTPUT_VARIABLES.selected = selectedIndices;
                success = true;
                this.log('set selected via OUTPUT_VARIABLES');
            }

            // Trigger callbacks
            if (typeof iframeWindow.postOutputVariables === 'function') {
                iframeWindow.postOutputVariables();
            }

            if (iframeWindow.duo?.onFirstInteraction) {
                iframeWindow.duo.onFirstInteraction();
            }

            if (iframeWindow.duoDynamic?.onInteraction) {
                iframeWindow.duoDynamic.onInteraction();
            }

            // PostMessage fallback
            iframeWindow.postMessage(
                { type: 'outputVariables', payload: { selected: selectedIndices } },
                '*',
            );
        } catch (e) {
            this.logError('error setting spinner value:', e);
        }

        return success;
    }
}
