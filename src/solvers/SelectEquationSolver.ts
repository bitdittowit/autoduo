/**
 * Солвер для заданий "Select the equation"
 * Определяет уравнение по точкам на графике и выбирает правильный вариант
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { findAllIframes } from '../dom/selectors';
import { extractKatexValue } from '../parsers/KatexParser';
import { cleanLatexWrappers, convertLatexOperators, convertLatexFractions } from '../parsers/latex';
import { evaluateMathExpression } from '../math/expressions';

interface IPoint {
    x: number;
    y: number;
}

interface ISelectEquationResult extends ISolverResult {
    type: 'selectEquation';
    calculatedEquation: { m: number; b: number };
    selectedChoice: number;
}

// Declare iframe window interface
interface IIframeWindow extends Window {
    diagram?: {
        components?: {
            x?: number;
            y?: number;
            componentType?: string;
        }[];
    };
}

/**
 * Извлекает точки из SVG элементов в iframe
 */
function extractPointsFromSVG(iframeWindow: Window): IPoint[] {
    const points: IPoint[] = [];
    const seenPoints = new Set<string>();

    try {
        const iframeDoc = iframeWindow.document;
        if (!iframeDoc) return points;

        // Method 1: Extract from label text (most reliable)
        // Points are in <g class="point static"> with <text class="label"> containing "(x, y)"
        const staticPointGroups = iframeDoc.querySelectorAll('g.point.static');

        for (const group of Array.from(staticPointGroups)) {
            const label = group.querySelector('text.label');
            if (label) {
                const labelText = label.textContent || '';
                // Try to extract (x, y) from label like "(2, 1)"
                const match = labelText.match(/\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/);
                if (match && match[1] && match[2]) {
                    const x = parseFloat(match[1]);
                    const y = parseFloat(match[2]);
                    if (!Number.isNaN(x) && !Number.isNaN(y)) {
                        const pointKey = `${x},${y}`;
                        if (!seenPoints.has(pointKey)) {
                            seenPoints.add(pointKey);
                            points.push({ x, y });
                        }
                    }
                }
            }
        }

        // Method 2: Extract from SVG coordinates by reading axis labels
        // This is a fallback if labels don't have coordinates
        if (points.length < 2) {
            // Try to extract grid scale from axis labels
            const xAxisLabels = iframeDoc.querySelectorAll('text.x-axis-label');
            const yAxisLabels = iframeDoc.querySelectorAll('text.y-axis-label');

            if (xAxisLabels.length > 0 && yAxisLabels.length > 0) {
                // Get the first and last x-axis labels to determine scale
                const firstXLabel = xAxisLabels[0];
                const lastXLabel = xAxisLabels[xAxisLabels.length - 1];
                const firstYLabel = yAxisLabels[0];
                const lastYLabel = yAxisLabels[yAxisLabels.length - 1];

                if (firstXLabel && lastXLabel && firstYLabel && lastYLabel) {
                    const x0 = parseFloat(firstXLabel.textContent || '0');
                    const x1 = parseFloat(lastXLabel.textContent || '0');
                    const y0 = parseFloat(firstYLabel.textContent || '0');
                    const y1 = parseFloat(lastYLabel.textContent || '0');

                    const x0Pos = parseFloat(firstXLabel.getAttribute('x') || '0');
                    const x1Pos = parseFloat(lastXLabel.getAttribute('x') || '0');
                    const y0Pos = parseFloat(firstYLabel.getAttribute('y') || '0');
                    const y1Pos = parseFloat(lastYLabel.getAttribute('y') || '0');

                    if (!Number.isNaN(x0) && !Number.isNaN(x1) && !Number.isNaN(y0) && !Number.isNaN(y1) &&
                        !Number.isNaN(x0Pos) && !Number.isNaN(x1Pos) && !Number.isNaN(y0Pos) && !Number.isNaN(y1Pos)) {

                        const xScale = (x1 - x0) / (x1Pos - x0Pos);
                        const yScale = (y1 - y0) / (y1Pos - y0Pos);

                        // Now extract points from circles
                        const circles = iframeDoc.querySelectorAll('g.point.static circle');
                        for (const circle of Array.from(circles)) {
                            const cx = parseFloat(circle.getAttribute('cx') || '0');
                            const cy = parseFloat(circle.getAttribute('cy') || '0');

                            if (!Number.isNaN(cx) && !Number.isNaN(cy)) {
                                const x = x0 + (cx - x0Pos) * xScale;
                                const y = y0 + (cy - y0Pos) * yScale;

                                const pointKey = `${x},${y}`;
                                if (!seenPoints.has(pointKey)) {
                                    seenPoints.add(pointKey);
                                    points.push({ x, y });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Method 3: Try to get points from diagram.components if available
        const iframeWindowTyped = iframeWindow as IIframeWindow;
        if (points.length < 2 && iframeWindowTyped.diagram?.components) {
            const components = Array.isArray(iframeWindowTyped.diagram.components)
                ? iframeWindowTyped.diagram.components
                : typeof (iframeWindowTyped.diagram.components as { getAll?: () => unknown[] }).getAll === 'function'
                    ? (iframeWindowTyped.diagram.components as { getAll: () => { x?: number; y?: number; componentType?: string }[] }).getAll()
                    : [];

            for (const comp of components) {
                if (('componentType' in comp && (comp.componentType === 'Point' || comp.componentType === 'StaticPoint')) ||
                    (!('componentType' in comp) && comp.x !== undefined && comp.y !== undefined)) {
                    if (comp.x !== undefined && comp.y !== undefined) {
                        const pointKey = `${comp.x},${comp.y}`;
                        if (!seenPoints.has(pointKey)) {
                            seenPoints.add(pointKey);
                            points.push({ x: comp.x, y: comp.y });
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error extracting points from SVG:', e);
    }

    return points;
}

/**
 * Вычисляет уравнение прямой по точкам (линейная регрессия)
 */
function calculateLinearEquation(points: IPoint[]): { m: number; b: number } | null {
    if (points.length < 2) return null;

    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (const point of points) {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
    }

    // Calculate slope: m = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX)
    const denominator = n * sumXX - sumX * sumX;
    if (Math.abs(denominator) < 0.0001) {
        // Vertical line or all points have same x
        return null;
    }

    const m = (n * sumXY - sumX * sumY) / denominator;

    // Calculate intercept: b = (sumY - m*sumX) / n
    const b = (sumY - m * sumX) / n;

    return { m, b };
}

/**
 * Парсит линейное уравнение вида y = mx или y = mx + b
 * Поддерживает дробные коэффициенты
 */
function parseLinearEquation(equation: string): { m: number; b: number } | null {
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
            return { m, b: 0 };
        }
    }

    // Pattern 2: y = (expression)x where expression can be evaluated (e.g., y=(1/2)x)
    match = cleaned.match(/^y=(.+?)x$/);
    if (match && match[1] !== undefined) {
        const coefficientExpr = match[1];
        const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
        const evaluated = evaluateMathExpression(cleanedCoeff);
        if (evaluated !== null) {
            return { m: evaluated, b: 0 };
        }
    }

    // Pattern 3: y = mx + b or y = mx - b
    match = cleaned.match(/^y=(-?\d+\.?\d*)x\+(-?\d+\.?\d*)$/);
    if (match && match[1] !== undefined && match[2] !== undefined) {
        const m = parseFloat(match[1]);
        const b = parseFloat(match[2]);
        if (!Number.isNaN(m) && !Number.isNaN(b)) {
            return { m, b };
        }
    }

    match = cleaned.match(/^y=(-?\d+\.?\d*)x-(-?\d+\.?\d*)$/);
    if (match && match[1] !== undefined && match[2] !== undefined) {
        const m = parseFloat(match[1]);
        const b = -parseFloat(match[2]);
        if (!Number.isNaN(m) && !Number.isNaN(b)) {
            return { m, b };
        }
    }

    // Pattern 4: y = (expression)x + b or y = (expression)x - b
    match = cleaned.match(/^y=(.+?)x\+(-?\d+\.?\d*)$/);
    if (match && match[1] !== undefined && match[2] !== undefined) {
        const coefficientExpr = match[1];
        const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
        const evaluated = evaluateMathExpression(cleanedCoeff);
        const b = parseFloat(match[2]);
        if (evaluated !== null && !Number.isNaN(b)) {
            return { m: evaluated, b };
        }
    }

    match = cleaned.match(/^y=(.+?)x-(-?\d+\.?\d*)$/);
    if (match && match[1] !== undefined && match[2] !== undefined) {
        const coefficientExpr = match[1];
        const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
        const evaluated = evaluateMathExpression(cleanedCoeff);
        const b = -parseFloat(match[2]);
        if (evaluated !== null && !Number.isNaN(b)) {
            return { m: evaluated, b };
        }
    }

    return null;
}

export class SelectEquationSolver extends BaseSolver {
    readonly name = 'SelectEquationSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check header for "select the equation"
        const headerMatches = this.headerContains(context, 'select', 'equation');
        if (!headerMatches) {
            return false;
        }

        // Check for choices with equations
        if (!context.choices?.length) {
            return false;
        }

        // Check if there's a graph iframe with points
        const allIframes = findAllIframes(context.container);
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        for (const iframe of combinedIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            // Check for MathDiagram or Grid2D with static points
            if (
                (srcdoc.includes('new MathDiagram') || srcdoc.includes('MathDiagram({')) ||
                (srcdoc.includes('new Grid2D') || srcdoc.includes('Grid2D({'))
            ) {
                // Check if choices contain equations
                const hasEquationChoices = context.choices.some(choice => {
                    const katexValue = extractKatexValue(choice);
                    if (!katexValue) return false;
                    return katexValue.includes('y') && katexValue.includes('=') && katexValue.includes('x');
                });

                if (hasEquationChoices) {
                    return true;
                }
            }
        }

        return false;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        if (!context.choices?.length) {
            return this.failure('selectEquation', 'no choices found');
        }

        // Find the diagram iframe
        const allIframes = findAllIframes(context.container);
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        let diagramIframe: HTMLIFrameElement | null = null;
        for (const iframe of combinedIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            if (
                (srcdoc.includes('new MathDiagram') || srcdoc.includes('MathDiagram({')) ||
                (srcdoc.includes('new Grid2D') || srcdoc.includes('Grid2D({'))
            ) {
                diagramIframe = iframe;
                break;
            }
        }

        if (!diagramIframe) {
            return this.failure('selectEquation', 'no diagram iframe found');
        }

        // Access iframe window
        const iframeWindow = diagramIframe.contentWindow;
        if (!iframeWindow) {
            return this.failure('selectEquation', 'could not access iframe window');
        }

        // Extract points from the graph
        const points = extractPointsFromSVG(iframeWindow);
        this.log(`extracted ${points.length} points:`, points);

        if (points.length < 2) {
            return this.failure('selectEquation', `not enough points: ${points.length} (need at least 2)`);
        }

        // Calculate equation from points
        const calculatedEquation = calculateLinearEquation(points);
        if (!calculatedEquation) {
            return this.failure('selectEquation', 'could not calculate equation from points');
        }

        this.log(`calculated equation: y = ${calculatedEquation.m}x + ${calculatedEquation.b}`);

        // Parse all choice equations and find match
        let matchedIndex = -1;
        const tolerance = 0.0001;

        for (let i = 0; i < context.choices.length; i++) {
            const choice = context.choices[i];
            if (!choice) continue;

            const katexValue = extractKatexValue(choice);
            if (!katexValue) continue;

            const parsed = parseLinearEquation(katexValue);
            if (!parsed) {
                this.log(`choice ${i}: could not parse equation: ${katexValue}`);
                continue;
            }

            this.log(`choice ${i}: ${katexValue} -> y = ${parsed.m}x + ${parsed.b}`);

            // Compare coefficients with tolerance
            if (
                Math.abs(parsed.m - calculatedEquation.m) < tolerance &&
                Math.abs(parsed.b - calculatedEquation.b) < tolerance
            ) {
                matchedIndex = i;
                this.log(`matched choice ${i}: ${katexValue}`);
                break;
            }
        }

        if (matchedIndex === -1) {
            return this.failure('selectEquation', 'no matching equation found in choices');
        }

        // Click the matched choice
        const choiceButtons = context.container.querySelectorAll('[data-test="challenge-choice"]');
        const choiceButton = choiceButtons[matchedIndex];

        if (!choiceButton) {
            return this.failure('selectEquation', `choice button ${matchedIndex} not found`);
        }

        try {
            (choiceButton as HTMLElement).click();
            this.log(`clicked choice ${matchedIndex}`);
        } catch (e) {
            return this.failure('selectEquation', `error clicking choice: ${e}`);
        }

        return {
            type: 'selectEquation',
            success: true,
            calculatedEquation,
            selectedChoice: matchedIndex,
        } as ISelectEquationResult;
    }
}
