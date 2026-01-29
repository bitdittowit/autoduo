/**
 * Солвер для построения точек на графике
 * Работает с Grid2D и DraggablePoint компонентами в iframe
 * Примеры:
 * - Plot the points (2, 2) and (4, 4) - явные координаты
 * - Plot the points on y = 7x - уравнение
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { findAllIframes } from '../dom/selectors';
import { extractKatexValue } from '../parsers/KatexParser';
import { cleanLatexWrappers, convertLatexOperators, convertLatexFractions } from '../parsers/latex';
import { evaluateMathExpression } from '../math/expressions';

interface IPlotPointsResult extends ISolverResult {
    type: 'plotPoints';
    pointsPlotted: number;
    targetPoints: { x: number; y: number }[];
}

interface IPoint {
    x: number;
    y: number;
}

// Declare iframe window interface
interface IIframeWindow extends Window {
    INPUT_VARIABLES?: {
        numPoints?: number;
    };
    OUTPUT_VARIABLES?: {
        finalPositions?: { x: number; y: number }[];
    };
    diagram?: {
        components?: {
            updatePosition?: (x: number, y: number) => void;
            x?: number;
            y?: number;
            componentType?: string;
        }[] | {
            getAll?: () => {
                updatePosition?: (x: number, y: number) => void;
                x?: number;
                y?: number;
                componentType?: string;
            }[];
        };
    };
    grid?: {
        components?: {
            updatePosition?: (x: number, y: number) => void;
            x?: number;
            y?: number;
            componentType?: string;
        }[] | {
            getAll?: () => {
                updatePosition?: (x: number, y: number) => void;
                x?: number;
                y?: number;
                componentType?: string;
            }[];
        };
    };
    mathDiagram?: {
        components?: {
            updatePosition?: (x: number, y: number) => void;
            x?: number;
            y?: number;
            componentType?: string;
        }[] | {
            getAll?: () => {
                updatePosition?: (x: number, y: number) => void;
                x?: number;
                y?: number;
                componentType?: string;
            }[];
        };
    };
    duo?: { onFirstInteraction?: () => void };
    duoDynamic?: { onInteraction?: () => void };
    postOutputVariables?: () => void;
    getOutputVariables?: () => unknown;
}

/**
 * Извлекает координаты точек из текста задания
 * Примеры: "Plot the points (2, 2) and (4, 4)" или "Plot the points (1, 3), (2, 6)"
 * Удаляет дубликаты точек с одинаковыми координатами
 */
function extractPointsFromText(text: string): IPoint[] {
    const points: IPoint[] = [];
    const seenPoints = new Set<string>();

    // Pattern для поиска координат: (число, число)
    // Поддерживает различные форматы: (2, 2), (-3, 4), (1.5, 2.5)
    const pointPattern = /\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/g;

    let match;
    while ((match = pointPattern.exec(text)) !== null) {
        if (match[1] !== undefined && match[2] !== undefined) {
            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);
            if (!Number.isNaN(x) && !Number.isNaN(y)) {
                // Create a unique key for this point to detect duplicates
                const pointKey = `${x},${y}`;
                if (!seenPoints.has(pointKey)) {
                    seenPoints.add(pointKey);
                    points.push({ x, y });
                }
            }
        }
    }

    return points;
}

/**
 * Парсит линейное уравнение вида y = mx или y = mx + b
 * Поддерживает дробные коэффициенты: y = (5/3)x, y = \frac{2}{3}x
 * @param equation - уравнение в формате LaTeX или текста
 * @returns объект с коэффициентом m и константой b, или null
 */
function parseLinearEquation(equation: string): { m: number; b: number } | null {
    // Clean LaTeX
    let cleaned = cleanLatexWrappers(equation);
    cleaned = convertLatexOperators(cleaned);
    cleaned = convertLatexFractions(cleaned); // Convert \frac{a}{b} to (a/b)
    cleaned = cleaned.replace(/\s+/g, '');

    // Pattern 1: y = mx (simple number coefficient)
    // Pattern: y = (number)x or y = -(number)x
    let match = cleaned.match(/^y=(-?\d+\.?\d*)x$/);
    if (match && match[1] !== undefined) {
        const m = parseFloat(match[1]);
        if (!Number.isNaN(m)) {
            return { m, b: 0 };
        }
    }

    // Pattern 2: y = (expression)x where expression can be evaluated (e.g., y=(5/3)x, y=(2/3)x)
    match = cleaned.match(/^y=(.+?)x$/);
    if (match && match[1] !== undefined) {
        const coefficientExpr = match[1];
        // Remove outer parentheses if present, e.g., (5/3) -> 5/3
        const cleanedCoeff = coefficientExpr.replace(/^\((.+)\)$/, '$1');
        const evaluated = evaluateMathExpression(cleanedCoeff);
        if (evaluated !== null) {
            return { m: evaluated, b: 0 };
        }
    }

    // Pattern 3: y = mx + b or y = mx - b (simple number coefficient)
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

    // Pattern 4: y = (expression)x + b or y = (expression)x - b (fractional coefficient)
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

/**
 * Извлекает уравнение из текста задания
 * Ищет уравнения вида y = mx или y = mx + b в KaTeX элементах
 */
function extractEquationFromText(context: IChallengeContext): string | null {
    // Look for equation in KaTeX annotations
    const annotations = context.container.querySelectorAll('annotation');
    for (const annotation of annotations) {
        const text = annotation.textContent;
        if (!text) continue;

        // Check if it looks like an equation (y = ...)
        if (text.includes('y') && text.includes('=') && text.includes('x')) {
            const katexValue = extractKatexValue(annotation.parentElement);
            if (katexValue) {
                return katexValue;
            }
        }
    }

    // Also check equation container
    if (context.equationContainer) {
        const katexValue = extractKatexValue(context.equationContainer);
        if (katexValue && katexValue.includes('y') && katexValue.includes('=') && katexValue.includes('x')) {
            return katexValue;
        }
    }

    // Fallback: search in all text content
    const containerText = context.container.textContent || '';
    const headerText = context.container.querySelector('[data-test="challenge-header"]')?.textContent || '';
    const fullText = `${headerText} ${containerText}`;

    // Try to find equation pattern in plain text
    const equationPattern = /y\s*=\s*(-?\d+\.?\d*)\s*x\s*([+-]?\s*\d+\.?\d*)?/i;
    const match = fullText.match(equationPattern);
    if (match) {
        let equation = `y=${match[1]}x`;
        if (match[2]) {
            const bValue = match[2].replace(/\s+/g, '');
            equation += bValue;
        }
        return equation;
    }

    return null;
}

/**
 * Вычисляет точки на прямой по уравнению
 * @param m - коэффициент наклона
 * @param b - константа
 * @param numPoints - количество точек для построения
 * @returns массив точек
 */
function calculatePointsFromEquation(m: number, b: number, numPoints = 2): IPoint[] {
    const points: IPoint[] = [];

    // Используем значения x от 1 до numPoints для простоты
    // Можно было бы использовать более умную логику, но для начала это работает
    for (let i = 0; i < numPoints; i++) {
        const x = i + 1;
        const y = m * x + b;
        points.push({ x, y });
    }

    return points;
}

export class PlotPointsSolver extends BaseSolver {
    readonly name = 'PlotPointsSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check for iframe with Grid2D and draggable points
        const allIframes = findAllIframes(context.container);
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        for (const iframe of combinedIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            // Check for Grid2D and addDraggablePoint
            if (
                (srcdoc.includes('new Grid2D') || srcdoc.includes('Grid2D({')) &&
                srcdoc.includes('addDraggablePoint')
            ) {
                this.log('found Grid2D with draggable points in iframe');
                return true;
            }
        }

        return false;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        // Find the diagram iframe
        const allIframes = findAllIframes(context.container);
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        let diagramIframe: HTMLIFrameElement | null = null;
        for (const iframe of combinedIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            if (
                (srcdoc.includes('new Grid2D') || srcdoc.includes('Grid2D({')) &&
                srcdoc.includes('addDraggablePoint')
            ) {
                diagramIframe = iframe;
                break;
            }
        }

        if (!diagramIframe) {
            return this.failure('plotPoints', 'No Grid2D iframe found');
        }

        // Access iframe window
        const iframeWindow = diagramIframe.contentWindow as IIframeWindow | null;
        if (!iframeWindow) {
            return this.failure('plotPoints', 'Could not access iframe window');
        }

        // Extract target points from challenge text
        const headerText = this.getHeaderText(context);
        const containerText = context.container.textContent || '';
        const fullText = `${headerText} ${containerText}`;

        this.log('extracting points from text:', fullText.substring(0, 200));

        // Try to determine number of points from srcdoc or INPUT_VARIABLES
        const srcdoc = diagramIframe.getAttribute('srcdoc') || '';
        let numPoints = iframeWindow.INPUT_VARIABLES?.numPoints;

        // Try to extract numPoints from srcdoc if not in INPUT_VARIABLES
        if (numPoints === undefined) {
            const inputVarsMatch = srcdoc.match(/INPUT_VARIABLES\s*=\s*(\{[^;]+\})/);
            if (inputVarsMatch && inputVarsMatch[1]) {
                try {
                    const parsedVars = JSON.parse(inputVarsMatch[1]);
                    if (typeof parsedVars.numPoints === 'number') {
                        numPoints = parsedVars.numPoints;
                    }
                } catch {
                    // Ignore parse errors
                }
            }
        }

        // Count addDraggablePoint calls in srcdoc as fallback
        if (numPoints === undefined) {
            const draggablePointMatches = srcdoc.match(/addDraggablePoint/g);
            if (draggablePointMatches) {
                numPoints = draggablePointMatches.length;
            }
        }

        // Default to 2 if we still don't know
        if (numPoints === undefined) {
            numPoints = 2;
        }

        this.log(`detected ${numPoints} draggable points`);

        // First, try to extract explicit coordinates
        let targetPoints = extractPointsFromText(fullText);

        // If no explicit coordinates found, try to extract equation
        if (targetPoints.length === 0) {
            this.log('no explicit coordinates found, trying to extract equation');
            const equation = extractEquationFromText(context);

            if (equation) {
                this.log('extracted equation:', equation);
                const parsed = parseLinearEquation(equation);

                if (parsed) {
                    this.log(`parsed equation: y = ${parsed.m}x + ${parsed.b}`);
                    this.log(`calculating ${numPoints} points from equation`);

                    targetPoints = calculatePointsFromEquation(parsed.m, parsed.b, numPoints);
                    this.log(`calculated ${targetPoints.length} points:`, targetPoints);
                } else {
                    this.logError('could not parse equation:', equation);
                }
            } else {
                this.logError('could not extract equation from challenge text');
            }
        }

        if (targetPoints.length === 0) {
            return this.failure('plotPoints', 'Could not extract point coordinates or equation from challenge text');
        }

        // Limit target points to the number of draggable points available
        if (targetPoints.length > numPoints) {
            this.log(`limiting target points from ${targetPoints.length} to ${numPoints} (available draggable points)`);
            targetPoints = targetPoints.slice(0, numPoints);
        }

        this.log(`using ${targetPoints.length} target points:`, targetPoints);

        // Wait for diagram to initialize with retry logic
        // The iframe's JavaScript needs time to set up mathDiagram and populate components
        let diagram: typeof iframeWindow.mathDiagram | null = null;
        const maxRetries = 20;
        let retryCount = 0;

        while (retryCount < maxRetries && !diagram?.components) {
            this.syncDelay(50);
            diagram = iframeWindow.diagram || iframeWindow.grid || iframeWindow.mathDiagram || null;

            // Check if components exist and is accessible
            if (diagram?.components) {
                // Verify components is actually accessible (not just a property that exists)
                try {
                    if (Array.isArray(diagram.components) ||
                        (typeof (diagram.components as { getAll?: () => unknown[] }).getAll === 'function')) {
                        break;
                    }
                } catch {
                    // Components property exists but might not be ready yet
                    diagram = null;
                }
            }

            retryCount++;
        }

        if (retryCount > 0) {
            this.log(`waited ${retryCount * 50}ms for diagram to initialize`);
        }

        // Try to access draggable points
        let pointsMoved = 0;

        // Method 1: Try to access via diagram.components or grid.components
        if (diagram?.components) {
            let componentsArray: {
                updatePosition?: (x: number, y: number) => void;
                x?: number;
                y?: number;
                componentType?: string;
            }[] = [];

            // Check if components is an array or has getAll() method
            if (Array.isArray(diagram.components)) {
                componentsArray = diagram.components;
                this.log(`found ${componentsArray.length} components (array)`);
            } else if (typeof (diagram.components as { getAll?: () => unknown[] }).getAll === 'function') {
                componentsArray = (diagram.components as { getAll: () => typeof componentsArray }).getAll();
                this.log(`found ${componentsArray.length} components (via getAll())`);
            }

            // Filter for draggable points by componentType or by updatePosition method
            const draggablePoints = componentsArray.filter((comp) => {
                // First try componentType (more reliable across iframe boundaries)
                if (comp.componentType === 'DraggablePoint') {
                    return true;
                }
                // Fallback: check for updatePosition method
                return comp.updatePosition && typeof comp.updatePosition === 'function';
            });

            this.log(`found ${draggablePoints.length} draggable points`);

            if (draggablePoints.length >= targetPoints.length) {
                try {
                    // Move each point to its target position
                    for (let i = 0; i < targetPoints.length && i < draggablePoints.length; i++) {
                        const point = draggablePoints[i];
                        const target = targetPoints[i];

                        if (point?.updatePosition && target) {
                            this.log(`attempting to move point ${i + 1} from (${point.x}, ${point.y}) to (${target.x}, ${target.y})`);
                            point.updatePosition(target.x, target.y);
                            pointsMoved++;
                            this.log(`moved point ${i + 1} to (${target.x}, ${target.y})`);
                        } else {
                            this.logError(`point ${i + 1} does not have updatePosition method or target is missing`);
                        }
                    }
                } catch (e) {
                    this.logError('error moving points via components:', e);
                }
            } else {
                this.log(`not enough draggable points found: ${draggablePoints.length} (need ${targetPoints.length})`);
            }
        } else {
            this.log('diagram.components not found');
        }

        // Method 2: Try to access via window properties directly with retry
        if (pointsMoved === 0) {
            try {
                const windowAny = iframeWindow as unknown as {
                    diagram?: typeof diagram;
                    grid?: typeof diagram;
                    mathDiagram?: typeof diagram;
                    [key: string]: unknown;
                };

                const possibleNames = ['diagram', 'grid', 'mathDiagram', 'graphDiagram'];

                // Retry accessing components for each possible diagram name
                for (let retry = 0; retry < 10 && pointsMoved === 0; retry++) {
                    if (retry > 0) {
                        this.syncDelay(50);
                    }

                    for (const name of possibleNames) {
                        const possibleDiagram = windowAny[name] as typeof diagram | undefined;
                        if (possibleDiagram?.components) {
                            this.log(`found diagram via window.${name} (attempt ${retry + 1})`);

                            let componentsArray: {
                                updatePosition?: (x: number, y: number) => void;
                                x?: number;
                                y?: number;
                                componentType?: string;
                            }[] = [];

                            try {
                                if (Array.isArray(possibleDiagram.components)) {
                                    componentsArray = possibleDiagram.components;
                                } else if (
                                    typeof (possibleDiagram.components as { getAll?: () => unknown[] }).getAll === 'function'
                                ) {
                                    componentsArray = (
                                        possibleDiagram.components as { getAll: () => typeof componentsArray }
                                    ).getAll();
                                }
                            } catch (e) {
                                this.logDebug(`error accessing components via ${name}:`, e);
                                continue;
                            }

                            const draggablePoints = componentsArray.filter((comp) => {
                                if (comp.componentType === 'DraggablePoint') {
                                    return true;
                                }
                                return comp.updatePosition && typeof comp.updatePosition === 'function';
                            });

                            this.log(`found ${draggablePoints.length} draggable points via window.${name}`);

                            if (draggablePoints.length >= targetPoints.length) {
                                for (let i = 0; i < targetPoints.length && i < draggablePoints.length; i++) {
                                    const point = draggablePoints[i];
                                    const target = targetPoints[i];

                                    if (point?.updatePosition && target) {
                                        try {
                                            point.updatePosition(target.x, target.y);
                                            pointsMoved++;
                                            this.log(`moved point ${i + 1} to (${target.x}, ${target.y}) via window.${name}`);
                                        } catch (e) {
                                            this.logError(`error moving point ${i + 1}:`, e);
                                        }
                                    }
                                }

                                if (pointsMoved > 0) {
                                    break;
                                }
                            }
                        }
                    }

                    if (pointsMoved > 0) {
                        break;
                    }
                }
            } catch (e) {
                this.logError('error accessing diagram via window properties:', e);
            }
        }

        // Method 3: Try to update OUTPUT_VARIABLES directly and trigger callbacks
        if (pointsMoved === 0) {
            try {
                const outputVars = iframeWindow.OUTPUT_VARIABLES;
                if (outputVars) {
                    outputVars.finalPositions = targetPoints;
                    this.log('updated OUTPUT_VARIABLES.finalPositions directly');

                    // Try to trigger update callbacks
                    const event = new Event('input', { bubbles: true });
                    iframeWindow.document.dispatchEvent(event);

                    // Also try custom events
                    iframeWindow.dispatchEvent(new CustomEvent('pointUpdate'));
                    iframeWindow.dispatchEvent(new CustomEvent('diagramUpdate'));

                    pointsMoved = targetPoints.length; // Assume success if OUTPUT_VARIABLES were updated
                }
            } catch (e) {
                this.logError('error updating OUTPUT_VARIABLES:', e);
            }
        }

        if (pointsMoved === 0) {
            return this.failure('plotPoints', 'Could not move draggable points');
        }

        // Add a small delay to allow component to process changes
        this.syncDelay(100);

        // Trigger update callbacks to notify parent frame
        this.triggerUpdateCallbacks(iframeWindow);

        // Add another delay after triggering callbacks
        this.syncDelay(200);

        return {
            type: 'plotPoints',
            success: true,
            pointsPlotted: pointsMoved,
            targetPoints,
        } as IPlotPointsResult;
    }

    private triggerUpdateCallbacks(iframeWindow: IIframeWindow): void {
        try {
            const iframeDoc = iframeWindow.document;
            if (!iframeDoc) return;

            this.log('triggering update callbacks');

            // Dispatch comprehensive events on document
            const events = ['input', 'change', 'blur', 'focusout'];
            events.forEach((eventType) => {
                const event = new Event(eventType, { bubbles: true });
                iframeDoc.dispatchEvent(event);
            });

            // Dispatch custom events that might be expected
            const customEvents = ['pointUpdate', 'diagramUpdate', 'gridUpdate', 'valueChange'];
            customEvents.forEach((eventType) => {
                const event = new CustomEvent(eventType, { bubbles: true });
                iframeDoc.dispatchEvent(event);
                iframeWindow.dispatchEvent(event);
            });

            // Call Duolingo's internal callbacks to notify parent frame
            // These are critical for enabling the "Continue" button
            if (typeof iframeWindow.postOutputVariables === 'function') {
                try {
                    iframeWindow.postOutputVariables();
                    this.log('called postOutputVariables()');
                } catch (e) {
                    this.logDebug('postOutputVariables() failed:', e);
                }
            }

            if (iframeWindow.duo?.onFirstInteraction) {
                try {
                    iframeWindow.duo.onFirstInteraction();
                    this.log('called duo.onFirstInteraction()');
                } catch (e) {
                    this.logDebug('duo.onFirstInteraction() failed:', e);
                }
            }

            if (iframeWindow.duoDynamic?.onInteraction) {
                try {
                    iframeWindow.duoDynamic.onInteraction();
                    this.log('called duoDynamic.onInteraction()');
                } catch (e) {
                    this.logDebug('duoDynamic.onInteraction() failed:', e);
                }
            }

            this.log('dispatched all update events and called Duolingo callbacks');
        } catch (e) {
            this.logError('error triggering update callbacks:', e);
        }
    }

    /**
     * Synchronous delay using busy-wait (for use in synchronous solve method)
     */
    private syncDelay(ms: number): void {
        const startTime = Date.now();
        while (Date.now() - startTime < ms) {
            // Busy wait
        }
    }
}
