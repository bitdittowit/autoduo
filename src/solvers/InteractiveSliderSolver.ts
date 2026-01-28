/**
 * Солвер для интерактивного слайдера
 * Работает с NumberLine в iframe
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { extractPieChartFraction } from '../parsers/PieChartParser';
import { extractBlockDiagramValue, isBlockDiagram } from '../parsers/BlockDiagramParser';
import { evaluateMathExpression } from '../math/expressions';
import { solveEquationWithBlank } from '../math/equations';
import { roundToNearest } from '../math/rounding';
import { findAllIframes, findIframeByContent } from '../dom/selectors';

interface ISliderResult extends ISolverResult {
    type: 'interactiveSlider';
    answer: number;
}

// Declare iframe window interface
interface IIframeWindow extends Window {
    getOutputVariables?: () => { value?: number };
    OUTPUT_VARS?: { value?: number };
    postOutputVariables?: () => void;
    duo?: { onFirstInteraction?: () => void };
    duoDynamic?: { onInteraction?: () => void };
    mathDiagram?: {
        sliderInstance?: { setValue?: (v: number) => void };
        slider?: {
            setValue?: (v: number) => void;
            valueToCallBack?: Record<string, (v: number) => void>;
        };
        setValue?: (v: number) => void;
        setSliderValue?: (v: number) => void;
    };
}

export class InteractiveSliderSolver extends BaseSolver {
    readonly name = 'InteractiveSliderSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check for iframe with NumberLine
        // Try both the standard method and a broader search
        const allIframes = findAllIframes(context.container);

        // Also check all iframes in the container as fallback
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        let hasNumberLine = false;
        let hasVisualElement = false;
        let hasNumberLineInExpressionBuild = false;
        const headerText = this.getHeaderText(context);
        const isShowAnotherWay = headerText.includes('show') && headerText.includes('another');

        this.log(
            'checking',
            combinedIframes.length,
            'iframes (standard:',
            allIframes.length,
            'fallback:',
            allIframesFallback.length,
            ')',
        );

        for (const iframe of combinedIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) {
                // Check if iframe has src that might contain NumberLine
                const src = iframe.getAttribute('src');
                if (src?.includes('NumberLine')) {
                    this.log('found NumberLine in src attribute');
                    hasNumberLine = true;
                }
                continue;
            }

            // CRITICAL: Skip Factor Tree challenges
            // Factor Tree may have NumberLine in iframe, but it's not a slider challenge
            // Check for BOTH FactorTree class AND originalTokens (unique to Factor Tree)
            if (
                (srcdoc.includes('FactorTree') || srcdoc.includes('new FactorTree')) &&
                srcdoc.includes('originalTokens')
            ) {
                this.log('skipping Factor Tree iframe (not a slider challenge)');
                continue;
            }

            // CRITICAL: Skip ExpressionBuild challenges
            // ExpressionBuild has tokens and entries, NOT a slider
            // Check for "new ExpressionBuild" AND "entries:" (unique to ExpressionBuild)
            if (
                srcdoc.includes('new ExpressionBuild') &&
                (srcdoc.includes('entries:') || srcdoc.includes('entries ='))
            ) {
                this.log('skipping ExpressionBuild iframe (not a slider challenge)');
                continue;
            }

            // Check for NumberLine
            if (srcdoc.includes('NumberLine')) {
                // Check if this is a real NumberLine slider vs embedded in ExpressionBuild
                // Real NumberLine sliders have these indicators:
                // - disableSnapping: true (for continuous sliders like "Get as close as you can")
                // - fillToValue: true (for discrete fill sliders)
                // - density: "TWO_PRIMARY" or similar (slider configuration)
                const hasSliderConfig =
                    srcdoc.includes('disableSnapping') ||
                    srcdoc.includes('fillToValue') ||
                    srcdoc.includes('TWO_PRIMARY') ||
                    srcdoc.includes('SEVEN_PRIMARY');

                const isExpressionBuild =
                    srcdoc.includes('exprBuild') || srcdoc.includes('ExpressionBuild');

                // If it has slider config, it's a real NumberLine regardless of ExpressionBuild text
                if (hasSliderConfig) {
                    hasNumberLine = true;
                    this.log('found NumberLine iframe (has slider config)');
                } else if (isExpressionBuild) {
                    // For "Show this another way" challenges with block diagram,
                    // NumberLine can be in ExpressionBuild iframe, but it's still a slider challenge
                    if (isShowAnotherWay) {
                        this.log(
                            'found NumberLine in ExpressionBuild iframe, but header suggests slider challenge',
                        );
                        hasNumberLineInExpressionBuild = true;
                    } else {
                        this.log('skipping ExpressionBuild NumberLine (no slider config, not show another way)');
                        continue;
                    }
                } else {
                    hasNumberLine = true;
                    this.log('found NumberLine iframe');
                }
            }

            // Check for visual element (block diagram or pie chart)
            if (srcdoc.includes('<svg')) {
                if (isBlockDiagram(srcdoc)) {
                    hasVisualElement = true;
                    this.log('found block diagram iframe');
                } else if (srcdoc.includes('circle') || srcdoc.includes('path')) {
                    // Could be a pie chart
                    hasVisualElement = true;
                    this.log('found potential pie chart iframe');
                }
            }
        }

        this.log(
            'hasNumberLine:',
            hasNumberLine,
            'hasVisualElement:',
            hasVisualElement,
            'hasNumberLineInExpressionBuild:',
            hasNumberLineInExpressionBuild,
            'header:',
            headerText,
        );

        // Special case: "Show this another way" with block diagram + NumberLine slider
        // Even if NumberLine is in ExpressionBuild iframe, it's still a slider challenge
        if (isShowAnotherWay && hasVisualElement && (hasNumberLine || hasNumberLineInExpressionBuild)) {
            this.log('can solve: Show another way with visual element and NumberLine');
            return true;
        }

        // If we have NumberLine (not in ExpressionBuild), we can solve it
        if (hasNumberLine) {
            this.log('can solve: NumberLine found');
            return true;
        }

        this.log('cannot solve: no NumberLine found');
        return false;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        const allIframes = findAllIframes(context.container);
        // Also check all iframes as fallback
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        let targetValue: number | null = null;
        let equation: string | null = null;
        let sliderIframe: HTMLIFrameElement | null = null;
        const headerText = this.getHeaderText(context);
        const isShowAnotherWay = headerText.includes('show') && headerText.includes('another');

        // Find visual element (block diagram or pie chart) + slider combination
        if (combinedIframes.length >= 1) {
            const visualIframe = findIframeByContent(combinedIframes, '<svg');
            if (visualIframe) {
                const visualSrcdoc = visualIframe.getAttribute('srcdoc');
                if (visualSrcdoc) {
                    // Try block diagram first (more specific)
                    if (isBlockDiagram(visualSrcdoc)) {
                        const blockValue = extractBlockDiagramValue(visualSrcdoc);
                        if (blockValue !== null) {
                            targetValue = blockValue;
                            equation = `block diagram: ${blockValue}`;
                            this.log('found block diagram value:', blockValue);
                        }
                    }

                    // Fall back to pie chart if not a block diagram
                    if (targetValue === null) {
                        const fraction = extractPieChartFraction(visualSrcdoc);
                        if (fraction && fraction.value !== null) {
                            targetValue = fraction.value;
                            equation = `pie chart: ${fraction.numerator}/${fraction.denominator}`;
                            this.log('found pie chart fraction:', equation);
                        }
                    }
                }

                // Find the slider iframe
                // For "Show this another way" challenges, NumberLine might be in ExpressionBuild iframe
                for (const ifrm of combinedIframes) {
                    if (ifrm === visualIframe) continue;

                    const srcdoc = ifrm.getAttribute('srcdoc');
                    if (!srcdoc) continue;

                    if (srcdoc.includes('NumberLine')) {
                        // For "Show this another way", accept NumberLine even in ExpressionBuild iframe
                        const isExpressionBuild =
                            srcdoc.includes('exprBuild') || srcdoc.includes('ExpressionBuild');
                        if (isShowAnotherWay || !isExpressionBuild) {
                            sliderIframe = ifrm;
                            this.log('found slider iframe (NumberLine)');
                            break;
                        }
                    }
                }
            }
        }

        // Try rounding challenge
        if (targetValue === null) {
            const result = this.tryRoundingChallenge(context);
            if (result) {
                targetValue = result.value;
                equation = result.equation;
            }
        }

        // Try equation with blank
        if (targetValue === null) {
            const result = this.tryEquationChallenge(context);
            if (result) {
                targetValue = result.value;
                equation = result.equation;
            }
        }

        // Try expression in KaTeX
        if (targetValue === null) {
            const result = this.tryKatexExpression(context);
            if (result) {
                targetValue = result.value;
                equation = result.equation;
            }
        }

        if (targetValue === null) {
            this.logError('could not determine target value');
            return this.failure('interactiveSlider', 'Could not determine target value');
        }

        // Find slider iframe if not found yet
        if (!sliderIframe) {
            sliderIframe = findIframeByContent(combinedIframes, 'NumberLine');
            // Also check ExpressionBuild iframes for "Show this another way" challenges
            if (!sliderIframe && isShowAnotherWay) {
                for (const ifrm of combinedIframes) {
                    const srcdoc = ifrm.getAttribute('srcdoc');
                    if (srcdoc?.includes('NumberLine')) {
                        sliderIframe = ifrm;
                        this.log('found slider iframe in ExpressionBuild (Show another way)');
                        break;
                    }
                }
            }
        }

        if (!sliderIframe) {
            return this.failure('interactiveSlider', 'No slider iframe found');
        }

        // Set the value
        const success = this.setSliderValue(sliderIframe, targetValue);

        this.log('target value =', targetValue, ', success =', success);

        const result: ISliderResult = {
            type: 'interactiveSlider',
            success: true,
            answer: targetValue,
        };
        if (equation) {
            result.equation = equation;
        }
        return result;
    }

    private tryRoundingChallenge(
        context: IChallengeContext,
    ): { value: number; equation: string } | null {
        const headerText = this.getHeaderText(context);

        if (!headerText.includes('round') || !headerText.includes('nearest')) {
            return null;
        }

        const baseMatch = headerText.match(/nearest\s*(\d+)/);
        if (!baseMatch?.[1]) return null;

        const roundingBase = parseInt(baseMatch[1], 10);
        const annotations = context.container.querySelectorAll('annotation');

        for (const annotation of annotations) {
            let text = annotation.textContent?.trim() ?? '';
            text = text.replace(/\\mathbf\{([^}]+)\}/g, '$1');
            text = text.replace(/\\textbf\{([^}]+)\}/g, '$1');
            text = text.replace(/\\htmlClass\{[^}]*\}\{([^}]+)\}/g, '$1');

            const numberToRound = parseInt(text, 10);
            if (!isNaN(numberToRound) && numberToRound > 0) {
                const rounded = roundToNearest(numberToRound, roundingBase);
                return {
                    value: rounded,
                    equation: `round(${numberToRound}) to nearest ${roundingBase}`,
                };
            }
        }

        return null;
    }

    private tryEquationChallenge(
        context: IChallengeContext,
    ): { value: number; equation: string } | null {
        const annotations = context.container.querySelectorAll('annotation');

        for (const annotation of annotations) {
            const text = annotation.textContent;
            if (!text) continue;

            // Equation with blank (duoblank)
            if (text.includes('\\duoblank')) {
                const result = solveEquationWithBlank(text);
                if (result !== null) {
                    return { value: result, equation: text };
                }
            }

            // Simple equation like "2+4=?"
            if (text.includes('=') && text.includes('?')) {
                const match = text.match(/(.+)=\s*\?/);
                if (match?.[1]) {
                    const leftSide = match[1]
                        .replace(/\\mathbf\{([^}]+)\}/g, '$1')
                        .replace(/\s+/g, '');
                    const result = evaluateMathExpression(leftSide);
                    if (result !== null) {
                        return { value: result, equation: text };
                    }
                }
            }
        }

        return null;
    }

    private tryKatexExpression(
        context: IChallengeContext,
    ): { value: number; equation: string } | null {
        const katexElements = context.container.querySelectorAll('.katex');

        for (const katex of katexElements) {
            const value = extractKatexValue(katex);
            if (!value) continue;

            const cleanValue = value.replace(/\s/g, '');
            if (
                /^[\d+\-*/×÷().]+$/.test(cleanValue) &&
                (value.includes('+') ||
                    value.includes('-') ||
                    value.includes('*') ||
                    value.includes('/'))
            ) {
                const result = evaluateMathExpression(value);
                if (result !== null) {
                    return { value: result, equation: value };
                }
            }
        }

        return null;
    }

    private setSliderValue(iframe: HTMLIFrameElement, value: number): boolean {
        let success = false;

        try {
            const iframeWindow = iframe.contentWindow as IIframeWindow | null;

            if (!iframeWindow) return false;

            // Method 1: getOutputVariables
            if (typeof iframeWindow.getOutputVariables === 'function') {
                const vars = iframeWindow.getOutputVariables();
                if (vars && typeof vars === 'object') {
                    vars.value = value;
                    success = true;
                    this.log('set value via getOutputVariables');
                }
            }

            // Method 2: OUTPUT_VARS
            if (!success && iframeWindow.OUTPUT_VARS) {
                iframeWindow.OUTPUT_VARS.value = value;
                success = true;
                this.log('set value via OUTPUT_VARS');
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

            // Method 3: mathDiagram
            const diagram = iframeWindow.mathDiagram;
            if (diagram) {
                if (diagram.sliderInstance?.setValue) {
                    diagram.sliderInstance.setValue(value);
                    success = true;
                } else if (diagram.slider?.setValue) {
                    diagram.slider.setValue(value);
                    success = true;
                } else if (diagram.setValue) {
                    diagram.setValue(value);
                    success = true;
                }
            }

            // Method 4: postMessage fallback
            iframeWindow.postMessage(
                { type: 'outputVariables', payload: { value } },
                '*',
            );
        } catch (e) {
            this.logError('error setting slider value:', e);
        }

        return success;
    }
}
