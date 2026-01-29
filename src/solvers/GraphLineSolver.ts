/**
 * Солвер для построения графика линии по уравнению
 * Работает с MathDiagram и DraggablePoint компонентами в iframe
 * Пример: построить график для уравнения y = x или y = 2x + 3
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { findAllIframes } from '../dom/selectors';
import { cleanLatexWrappers, convertLatexOperators } from '../parsers/latex';

interface IGraphLineResult extends ISolverResult {
    type: 'graphLine';
    equation: string;
    pointsMoved: number;
}

// Declare iframe window interface
interface IIframeWindow extends Window {
    INPUT_VARIABLES?: {
        m: number;
        b: number;
    };
    OUTPUT_VARIABLES?: {
        point1?: { x: number; y: number };
        point2?: { x: number; y: number };
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
}

/**
 * Парсит линейное уравнение вида y = mx или y = mx + b
 * @param equation - уравнение в формате LaTeX или текста
 * @returns объект с коэффициентом m и константой b, или null
 */
function parseLinearEquation(equation: string): { m: number; b: number } | null {
    // Clean LaTeX
    let cleaned = cleanLatexWrappers(equation);
    cleaned = convertLatexOperators(cleaned);
    cleaned = cleaned.replace(/\s+/g, '');

    // Pattern: y = mx or y = mx + b or y = mx - b
    // Match: y = (number)x or y = (number)x + (number) or y = (number)x - (number)
    const patterns = [
        /^y=(-?\d+\.?\d*)x$/, // y = 2x or y = -3x
        /^y=(-?\d+\.?\d*)x\+(-?\d+\.?\d*)$/, // y = 2x + 3
        /^y=(-?\d+\.?\d*)x-(-?\d+\.?\d*)$/, // y = 2x - 3
    ];

    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match && match[1] !== undefined) {
            const m = parseFloat(match[1]);
            const b =
                match[2] !== undefined
                    ? pattern === patterns[1]
                        ? parseFloat(match[2])
                        : -parseFloat(match[2])
                    : 0;
            if (!Number.isNaN(m)) {
                return { m, b };
            }
        }
    }

    return null;
}

export class GraphLineSolver extends BaseSolver {
    readonly name = 'GraphLineSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check for iframe with MathDiagram and draggable points
        const allIframes = findAllIframes(context.container);
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        for (const iframe of combinedIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            // Check for MathDiagram and addDraggablePoint
            if (
                (srcdoc.includes('new MathDiagram') || srcdoc.includes('MathDiagram({')) &&
                srcdoc.includes('addDraggablePoint')
            ) {
                this.log('found MathDiagram with draggable points in iframe');
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
                (srcdoc.includes('new MathDiagram') || srcdoc.includes('MathDiagram({')) &&
                srcdoc.includes('addDraggablePoint')
            ) {
                diagramIframe = iframe;
                break;
            }
        }

        if (!diagramIframe) {
            return this.failure('graphLine', 'No diagram iframe found');
        }

        // Access iframe window
        const iframeWindow = diagramIframe.contentWindow as IIframeWindow | null;
        if (!iframeWindow) {
            return this.failure('graphLine', 'Could not access iframe window');
        }

        // Try to wait a bit for diagram to initialize (synchronous check)
        // Check if diagram exists, if not log a warning but proceed
        if (!iframeWindow.diagram) {
            this.logDebug('diagram not immediately available, will try alternative access methods');
        }

        // Try to get equation from INPUT_VARIABLES first
        const srcdoc = diagramIframe.getAttribute('srcdoc') || '';
        let m: number | null = null;
        let b: number | null = null;
        let equation: string | null = null;

        // Extract INPUT_VARIABLES from srcdoc
        // Format: const INPUT_VARIABLES = {"m": 1, "b": 0};
        const inputVarsMatch = srcdoc.match(/INPUT_VARIABLES\s*=\s*(\{[^;]+\})/);
        if (inputVarsMatch && inputVarsMatch[1] !== undefined) {
            try {
                const jsonStr = inputVarsMatch[1];
                if (!jsonStr) {
                    throw new Error('Empty JSON string');
                }
                const parsedVars = JSON.parse(jsonStr);
                if (typeof parsedVars.m === 'number' && typeof parsedVars.b === 'number') {
                    m = parsedVars.m;
                    b = parsedVars.b;
                    // TypeScript: b is guaranteed to be number here due to the type check above
                    const bValue = b!;
                    equation = `y = ${m === 1 ? '' : m === -1 ? '-' : m}x${bValue !== 0 ? (bValue > 0 ? ` + ${bValue}` : ` - ${Math.abs(bValue)}`) : ''}`;
                    this.log('extracted equation from srcdoc:', equation);
                }
            } catch {
                this.logDebug('could not parse INPUT_VARIABLES from srcdoc, trying iframe window');
            }
        }

        // Fallback: try to get from iframe window
        if (m === null || b === null) {
            const inputVars = iframeWindow.INPUT_VARIABLES;
            if (inputVars && typeof inputVars.m === 'number' && typeof inputVars.b === 'number') {
                m = inputVars.m;
                b = inputVars.b;
                // TypeScript: b is guaranteed to be number here due to the type check above
                const bValue = b!;
                equation = `y = ${m === 1 ? '' : m === -1 ? '-' : m}x${bValue !== 0 ? (bValue > 0 ? ` + ${bValue}` : ` - ${Math.abs(bValue)}`) : ''}`;
                this.log('extracted equation from iframe window:', equation);
            }
        }

        // Fallback: try to extract equation from KaTeX on the page
        if (m === null || b === null) {
            equation = this.extractEquation(context);
            if (equation) {
                const parsed = parseLinearEquation(equation);
                if (parsed) {
                    m = parsed.m;
                    b = parsed.b;
                    this.log('extracted equation from KaTeX:', equation);
                }
            }
        }

        if (m === null || b === null || equation === null) {
            return this.failure('graphLine', 'Could not extract equation');
        }

        this.log('parsed equation: y =', m, 'x +', b);

        // Calculate two points on the line
        // Use x = 1 and x = 3 as default (same as in the transcript)
        const point1X = 1;
        const point1Y = m * point1X + b;
        const point2X = 3;
        const point2Y = m * point2X + b;

        this.log(`target points: (${point1X}, ${point1Y}) and (${point2X}, ${point2Y})`);

        // Try to access draggable points
        // According to transcript, points are created with diagram.addDraggablePoint()
        // and stored in diagram.components or accessible via OUTPUT_VARIABLES
        let pointsMoved = 0;

        // Method 1: Try to access via diagram.components
        const diagram = iframeWindow.diagram;
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

            if (draggablePoints.length >= 2) {
                try {
                    // Move first point
                    const point1 = draggablePoints[0];
                    if (point1?.updatePosition) {
                        this.log(`attempting to move point 1 from (${point1.x}, ${point1.y}) to (${point1X}, ${point1Y})`);
                        point1.updatePosition(point1X, point1Y);
                        pointsMoved++;
                        this.log(`moved point 1 to (${point1X}, ${point1Y})`);
                    } else {
                        this.logError('point 1 does not have updatePosition method');
                    }

                    // Move second point
                    const point2 = draggablePoints[1];
                    if (point2?.updatePosition) {
                        this.log(`attempting to move point 2 from (${point2.x}, ${point2.y}) to (${point2X}, ${point2Y})`);
                        point2.updatePosition(point2X, point2Y);
                        pointsMoved++;
                        this.log(`moved point 2 to (${point2X}, ${point2Y})`);
                    } else {
                        this.logError('point 2 does not have updatePosition method');
                    }
                } catch (e) {
                    this.logError('error moving points via components:', e);
                }
            } else {
                this.log(`not enough draggable points found: ${draggablePoints.length} (need 2)`);
            }
        } else {
            this.log('diagram.components not found');
        }

        // Method 2: Try to access via window.diagram directly (might be stored differently)
        if (pointsMoved === 0) {
            try {
                const windowWithDiagram = iframeWindow as unknown as {
                    diagram?: {
                        components?: {
                            updatePosition?: (x: number, y: number) => void;
                            componentType?: string;
                        }[] | {
                            getAll?: () => {
                                updatePosition?: (x: number, y: number) => void;
                                componentType?: string;
                            }[];
                        };
                    };
                };

                const components = windowWithDiagram.diagram?.components;
                if (components) {
                    let componentsArray: {
                        updatePosition?: (x: number, y: number) => void;
                        componentType?: string;
                    }[] = [];

                    if (Array.isArray(components)) {
                        componentsArray = components;
                    } else if (typeof (components as { getAll?: () => unknown[] }).getAll === 'function') {
                        componentsArray = (components as { getAll: () => typeof componentsArray }).getAll();
                    }

                    const draggablePoints = componentsArray.filter((comp) => {
                        if (comp.componentType === 'DraggablePoint') {
                            return true;
                        }
                        return comp.updatePosition && typeof comp.updatePosition === 'function';
                    });

                    if (draggablePoints.length >= 2) {
                        const point1 = draggablePoints[0];
                        if (point1?.updatePosition) {
                            point1.updatePosition(point1X, point1Y);
                            pointsMoved++;
                            this.log(`moved point 1 to (${point1X}, ${point1Y}) via window.diagram`);
                        }

                        const point2 = draggablePoints[1];
                        if (point2?.updatePosition) {
                            point2.updatePosition(point2X, point2Y);
                            pointsMoved++;
                            this.log(`moved point 2 to (${point2X}, ${point2Y}) via window.diagram`);
                        }
                    }
                }
            } catch (e) {
                this.logError('error moving points via window.diagram:', e);
            }
        }

        // Method 3: Try to access diagram via global MathDiagram instance or window properties
        if (pointsMoved === 0) {
            try {
                const windowAny = iframeWindow as unknown as {
                    MathDiagram?: {
                        instance?: {
                            components?: {
                                updatePosition?: (x: number, y: number) => void;
                                componentType?: string;
                            }[] | {
                                getAll?: () => {
                                    updatePosition?: (x: number, y: number) => void;
                                    componentType?: string;
                                }[];
                            };
                        };
                    };
                    diagramInstance?: typeof diagram;
                    [key: string]: unknown;
                };

                // Try MathDiagram.instance
                if (windowAny.MathDiagram?.instance?.components) {
                    const components = windowAny.MathDiagram.instance.components;
                    let componentsArray: {
                        updatePosition?: (x: number, y: number) => void;
                        componentType?: string;
                    }[] = [];

                    if (Array.isArray(components)) {
                        componentsArray = components;
                    } else if (typeof (components as { getAll?: () => unknown[] }).getAll === 'function') {
                        componentsArray = (components as { getAll: () => typeof componentsArray }).getAll();
                    }

                    const draggablePoints = componentsArray.filter((comp) => {
                        if (comp.componentType === 'DraggablePoint') {
                            return true;
                        }
                        return comp.updatePosition && typeof comp.updatePosition === 'function';
                    });

                    if (draggablePoints.length >= 2) {
                        const point1 = draggablePoints[0];
                        if (point1?.updatePosition) {
                            point1.updatePosition(point1X, point1Y);
                            pointsMoved++;
                            this.log(`moved point 1 to (${point1X}, ${point1Y}) via MathDiagram.instance`);
                        }

                        const point2 = draggablePoints[1];
                        if (point2?.updatePosition) {
                            point2.updatePosition(point2X, point2Y);
                            pointsMoved++;
                            this.log(`moved point 2 to (${point2X}, ${point2Y}) via MathDiagram.instance`);
                        }
                    }
                }

                // Try to find diagram via window properties (search for common names)
                if (pointsMoved === 0) {
                    const possibleNames = ['diagram', 'mathDiagram', 'graphDiagram', 'lineDiagram'];
                    for (const name of possibleNames) {
                        const possibleDiagram = windowAny[name] as typeof diagram | undefined;
                        if (possibleDiagram?.components) {
                            this.log(`found diagram via window.${name}`);
                            // Use same logic as Method 1
                            let componentsArray: {
                                updatePosition?: (x: number, y: number) => void;
                                componentType?: string;
                            }[] = [];

                            if (Array.isArray(possibleDiagram.components)) {
                                componentsArray = possibleDiagram.components;
                            } else if (
                                typeof (possibleDiagram.components as { getAll?: () => unknown[] }).getAll === 'function'
                            ) {
                                componentsArray = (
                                    possibleDiagram.components as { getAll: () => typeof componentsArray }
                                ).getAll();
                            }

                            const draggablePoints = componentsArray.filter((comp) => {
                                if (comp.componentType === 'DraggablePoint') {
                                    return true;
                                }
                                return comp.updatePosition && typeof comp.updatePosition === 'function';
                            });

                            if (draggablePoints.length >= 2) {
                                const point1 = draggablePoints[0];
                                if (point1?.updatePosition) {
                                    point1.updatePosition(point1X, point1Y);
                                    pointsMoved++;
                                    this.log(`moved point 1 to (${point1X}, ${point1Y}) via window.${name}`);
                                }

                                const point2 = draggablePoints[1];
                                if (point2?.updatePosition) {
                                    point2.updatePosition(point2X, point2Y);
                                    pointsMoved++;
                                    this.log(`moved point 2 to (${point2X}, ${point2Y}) via window.${name}`);
                                }
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                this.logError('error accessing diagram via global properties:', e);
            }
        }

        // Method 4: Try to find draggable points by searching the iframe document
        if (pointsMoved === 0) {
            try {
                const iframeDoc = iframeWindow.document;
                if (iframeDoc) {
                    // Look for SVG elements that might be draggable points
                    const svgElements = iframeDoc.querySelectorAll('svg');
                    for (const svg of svgElements) {
                        // Try to find circles or points that might be draggable
                        const circles = svg.querySelectorAll('circle');
                        if (circles.length >= 2) {
                            // Try to trigger updatePosition via events or direct access
                            // This is a fallback - might need adjustment based on actual structure
                            this.logDebug('found SVG circles, but updatePosition method not accessible');
                        }
                    }
                }
            } catch (e) {
                this.logError('error searching iframe document:', e);
            }
        }

        // Method 5: Try to update OUTPUT_VARIABLES directly and trigger callbacks
        if (pointsMoved === 0) {
            try {
                const outputVars = iframeWindow.OUTPUT_VARIABLES;
                if (outputVars) {
                    outputVars.point1 = { x: point1X, y: point1Y };
                    outputVars.point2 = { x: point2X, y: point2Y };
                    this.log('updated OUTPUT_VARIABLES directly');

                    // Try to trigger update callbacks
                    const event = new Event('input', { bubbles: true });
                    iframeWindow.document.dispatchEvent(event);

                    // Also try custom events
                    iframeWindow.dispatchEvent(new CustomEvent('pointUpdate'));
                    iframeWindow.dispatchEvent(new CustomEvent('diagramUpdate'));

                    pointsMoved = 2; // Assume success if OUTPUT_VARIABLES were updated
                }
            } catch (e) {
                this.logError('error updating OUTPUT_VARIABLES:', e);
            }
        }

        if (pointsMoved === 0) {
            return this.failure('graphLine', 'Could not move draggable points');
        }

        return {
            type: 'graphLine',
            success: true,
            equation,
            pointsMoved,
        } as IGraphLineResult;
    }

    private extractEquation(context: IChallengeContext): string | null {
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

        return null;
    }
}
