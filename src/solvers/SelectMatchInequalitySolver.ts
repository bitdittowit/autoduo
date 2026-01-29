/**
 * Солвер для заданий "Select the match" с неравенствами на числовой прямой
 * Извлекает неравенство из диаграммы NumberLine и выбирает правильный вариант
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { findAllIframes } from '../dom/selectors';
import { extractKatexValue } from '../parsers/KatexParser';
import { cleanLatexWrappers, convertLatexOperators } from '../parsers/latex';

interface ISelectMatchInequalityResult extends ISolverResult {
    type: 'selectMatchInequality';
    extractedInequality: string;
    selectedChoice: number;
}

interface IInequalityInfo {
    variable: string;
    operator: '<' | '>' | '≤' | '≥';
    value: number;
}

// Declare iframe window interface
interface IIframeWindow extends Window {
    getOutputVariables?: () => {
        endpoint_position?: number;
        is_inclusive?: boolean;
        ray?: unknown;
    };
    INPUT_VARIABLES?: {
        endpoint_position?: number;
        is_inclusive?: boolean;
    };
}

/**
 * Извлекает информацию о неравенстве из диаграммы NumberLine
 */
function extractInequalityFromDiagram(iframeWindow: Window): IInequalityInfo | null {
    try {
        const iframeWindowTyped = iframeWindow as IIframeWindow;

        // Method 1: getOutputVariables
        let endpointPosition: number | undefined;
        let isInclusive: boolean | undefined;

        if (typeof iframeWindowTyped.getOutputVariables === 'function') {
            const vars = iframeWindowTyped.getOutputVariables();
            if (vars) {
                endpointPosition = vars.endpoint_position;
                isInclusive = vars.is_inclusive;
            }
        }

        // Method 2: INPUT_VARIABLES
        if (endpointPosition === undefined && iframeWindowTyped.INPUT_VARIABLES) {
            endpointPosition = iframeWindowTyped.INPUT_VARIABLES.endpoint_position;
            isInclusive = iframeWindowTyped.INPUT_VARIABLES.is_inclusive;
        }

        // Method 3: Parse from srcdoc if available
        if (endpointPosition === undefined || isInclusive === undefined) {
            const iframeDoc = iframeWindow.document;
            if (iframeDoc) {
                // Try to find the script tag with INPUT_VARIABLES
                const scripts = iframeDoc.querySelectorAll('script');
                for (const script of Array.from(scripts)) {
                    const scriptText = script.textContent || '';
                    const endpointMatch = scriptText.match(/endpoint_position["\s]*:\s*(\d+)/);
                    const inclusiveMatch = scriptText.match(/is_inclusive["\s]*:\s*(true|false)/);

                    if (endpointMatch && endpointMatch[1]) {
                        endpointPosition = parseInt(endpointMatch[1], 10);
                    }
                    if (inclusiveMatch) {
                        isInclusive = inclusiveMatch[1] === 'true';
                    }
                }

                // Method 4: Check SVG for open/closed circle if isInclusive is still undefined
                if (isInclusive === undefined && iframeDoc) {
                    // Look for point elements with class "open" (open circle) or without (closed circle)
                    const pointElements = iframeDoc.querySelectorAll('g.point');
                    for (const pointEl of Array.from(pointElements)) {
                        if (pointEl.classList.contains('open')) {
                            isInclusive = false;
                            break;
                        } else if (pointEl.querySelector('circle') && !pointEl.classList.contains('open')) {
                            // Check if circle has stroke-width > 0 (closed circle)
                            const circle = pointEl.querySelector('circle');
                            if (circle) {
                                const strokeWidth = parseFloat(circle.getAttribute('stroke-width') || '0');
                                if (strokeWidth > 0) {
                                    isInclusive = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (endpointPosition === undefined) {
            return null;
        }

        // Default isInclusive to false if still undefined (open circle is more common)
        if (isInclusive === undefined) {
            isInclusive = false;
        }

        // Determine direction by checking the ray/line direction
        // If ray points left (from endpoint to smaller x), it's x < endpoint or x ≤ endpoint
        // If ray points right (from endpoint to larger x), it's x > endpoint or x ≥ endpoint
        let direction: 'left' | 'right' = 'left'; // Default to left

        try {
            const iframeDoc = iframeWindow.document;
            if (iframeDoc) {
                // Method 1: Check line coordinates in SVG
                const lines = iframeDoc.querySelectorAll('line');
                for (const line of Array.from(lines)) {
                    const x1 = parseFloat(line.getAttribute('x1') || '0');
                    const x2 = parseFloat(line.getAttribute('x2') || '0');
                    if (!Number.isNaN(x1) && !Number.isNaN(x2)) {
                        // If x2 < x1, ray points left; if x2 > x1, ray points right
                        if (x2 < x1) {
                            direction = 'left';
                            break;
                        } else if (x2 > x1) {
                            direction = 'right';
                            break;
                        }
                    }
                }

                // Method 2: Parse from script if line coordinates don't help
                if (direction === 'left') {
                    const scriptText = iframeDoc.documentElement.innerHTML;
                    const xAxisMinMatch = scriptText.match(/xAxisMin["\s]*:\s*(-?\d+)/);
                    if (xAxisMinMatch && xAxisMinMatch[1]) {
                        const xAxisMin = parseInt(xAxisMinMatch[1], 10);
                        // If xAxisMin < endpoint_position, ray points left
                        // If xAxisMin > endpoint_position, ray points right
                        if (xAxisMin < endpointPosition) {
                            direction = 'left';
                        } else if (xAxisMin > endpointPosition) {
                            direction = 'right';
                        }
                    }
                }
            }
        } catch {
            // Default to left if we can't determine
            direction = 'left';
        }

        // Build inequality
        const operator = direction === 'left'
            ? (isInclusive ? '≤' : '<')
            : (isInclusive ? '≥' : '>');

        return {
            variable: 'x',
            operator,
            value: endpointPosition,
        };
    } catch (e) {
        console.error('Error extracting inequality from diagram:', e);
        return null;
    }
}

/**
 * Парсит неравенство из текста (например, "x ≥ 9" или "x ≤ 9")
 */
function parseInequality(text: string): IInequalityInfo | null {
    // Clean LaTeX
    let cleaned = cleanLatexWrappers(text);
    cleaned = convertLatexOperators(cleaned);
    cleaned = cleaned.replace(/\s+/g, '');

    // Pattern 1: x ≥ 9, x ≤ 9, x > 9, x < 9
    const match = cleaned.match(/^([xyz])([<>≤≥])(-?\d+\.?\d*)$/i);
    if (match && match[1] && match[2] && match[3]) {
        const variable = match[1].toLowerCase();
        const operator = match[2] as '<' | '>' | '≤' | '≥';
        const value = parseFloat(match[3]);

        if (!Number.isNaN(value)) {
            return { variable, operator, value };
        }
    }

    // Pattern 2: 9 ≤ x, 9 ≥ x, 9 < x, 9 > x (reversed)
    const reversedMatch = cleaned.match(/^(-?\d+\.?\d*)([<>≤≥])([xyz])$/i);
    if (reversedMatch && reversedMatch[1] && reversedMatch[2] && reversedMatch[3]) {
        const value = parseFloat(reversedMatch[1]);
        const operatorRaw = reversedMatch[2];
        const variable = reversedMatch[3].toLowerCase();

        if (!Number.isNaN(value)) {
            // Reverse the operator
            let operator: '<' | '>' | '≤' | '≥';
            if (operatorRaw === '<') operator = '>';
            else if (operatorRaw === '>') operator = '<';
            else if (operatorRaw === '≤') operator = '≥';
            else if (operatorRaw === '≥') operator = '≤';
            else return null;

            return { variable, operator, value };
        }
    }

    return null;
}

/**
 * Сравнивает два неравенства на равенство
 */
function inequalitiesMatch(ineq1: IInequalityInfo, ineq2: IInequalityInfo): boolean {
    if (ineq1.variable !== ineq2.variable) return false;
    if (Math.abs(ineq1.value - ineq2.value) > 0.0001) return false;
    if (ineq1.operator !== ineq2.operator) return false;
    return true;
}

export class SelectMatchInequalitySolver extends BaseSolver {
    readonly name = 'SelectMatchInequalitySolver';

    canSolve(context: IChallengeContext): boolean {
        // Check header for "select the match"
        const headerMatches = this.headerContains(context, 'select', 'match');
        if (!headerMatches) {
            return false;
        }

        // Check for choices
        if (!context.choices?.length) {
            return false;
        }

        // Check if there's a NumberLine iframe
        const allIframes = findAllIframes(context.container);
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        for (const iframe of combinedIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            // Check for NumberLine
            if (srcdoc.includes('NumberLine') || srcdoc.includes('new NumberLine')) {
                // Check if choices contain inequalities
                const hasInequalityChoices = context.choices.some(choice => {
                    const katexValue = extractKatexValue(choice);
                    if (!katexValue) return false;
                    const parsed = parseInequality(katexValue);
                    return parsed !== null;
                });

                if (hasInequalityChoices) {
                    return true;
                }
            }
        }

        return false;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        if (!context.choices?.length) {
            return this.failure('selectMatchInequality', 'no choices found');
        }

        // Find the NumberLine iframe
        const allIframes = findAllIframes(context.container);
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        let diagramIframe: HTMLIFrameElement | null = null;
        for (const iframe of combinedIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            if (srcdoc.includes('NumberLine') || srcdoc.includes('new NumberLine')) {
                diagramIframe = iframe;
                break;
            }
        }

        if (!diagramIframe) {
            return this.failure('selectMatchInequality', 'no NumberLine iframe found');
        }

        // Access iframe window
        const iframeWindow = diagramIframe.contentWindow;
        if (!iframeWindow) {
            return this.failure('selectMatchInequality', 'could not access iframe window');
        }

        // Extract inequality from diagram
        // Try multiple times in case diagram is still initializing
        let extractedInequality: IInequalityInfo | null = null;
        const maxAttempts = 5;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            extractedInequality = extractInequalityFromDiagram(iframeWindow);
            if (extractedInequality) {
                if (attempt > 1) {
                    this.log(`extracted inequality on attempt ${attempt}`);
                }
                break;
            }
        }

        if (!extractedInequality) {
            return this.failure('selectMatchInequality', 'could not extract inequality from diagram');
        }

        const inequalityStr = `${extractedInequality.variable} ${extractedInequality.operator} ${extractedInequality.value}`;
        this.log(`extracted inequality: ${inequalityStr}`);

        // Parse all choice inequalities and find match
        let matchedIndex = -1;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const katexValue = extractKatexValue(choice);
            if (!katexValue) {
                this.log(`choice ${i}: could not extract KaTeX value`);
                continue;
            }

            const parsed = parseInequality(katexValue);
            if (!parsed) {
                this.log(`choice ${i}: could not parse inequality: ${katexValue}`);
                continue;
            }

            const choiceStr = `${parsed.variable} ${parsed.operator} ${parsed.value}`;
            this.log(`choice ${i}: ${katexValue} -> ${choiceStr}`);

            if (inequalitiesMatch(extractedInequality, parsed)) {
                matchedIndex = i;
                this.log(`matched choice ${i}: ${choiceStr}`);
                break;
            }
        }

        if (matchedIndex === -1) {
            return this.failure('selectMatchInequality', `no matching inequality found for: ${inequalityStr}`);
        }

        // Click the matched choice
        const choiceButtons = context.container.querySelectorAll('[data-test="challenge-choice"]');
        const choiceButton = choiceButtons[matchedIndex];

        if (!choiceButton) {
            return this.failure('selectMatchInequality', `choice button ${matchedIndex} not found`);
        }

        try {
            (choiceButton as HTMLElement).click();
            this.log(`clicked choice ${matchedIndex}`);
        } catch (e) {
            return this.failure('selectMatchInequality', `error clicking choice: ${e}`);
        }

        return {
            type: 'selectMatchInequality',
            success: true,
            extractedInequality: inequalityStr,
            selectedChoice: matchedIndex,
        } as ISelectMatchInequalityResult;
    }
}
