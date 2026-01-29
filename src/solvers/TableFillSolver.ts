/**
 * Солвер для заполнения таблиц по уравнению
 * Работает с Table компонентом в iframe
 * Пример: заполнить таблицу для уравнения y = 2x
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { findAllIframes } from '../dom/selectors';
import { cleanLatexWrappers, convertLatexOperators } from '../parsers/latex';

interface ITableFillResult extends ISolverResult {
    type: 'tableFill';
    equation: string;
    filledCells: number;
}

// Declare iframe window interface
interface IIframeWindow extends Window {
    INPUT_VARIABLES?: {
        data: (number | null)[][];
        tokens: number[];
    };
    diagram?: {
        table?: {
            setCellValue?: (
                rowIndex: number,
                colIndex: number,
                value: string,
                tokenElement?: HTMLElement,
            ) => void;
        };
        variables?: {
            data?: (number | null)[][];
            tokens?: number[];
        };
    };
    renderNumber?: (value: number) => string;
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

export class TableFillSolver extends BaseSolver {
    readonly name = 'TableFillSolver';

    canSolve(context: IChallengeContext): boolean {
        // Check for iframe with Table component
        const allIframes = findAllIframes(context.container);
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        for (const iframe of combinedIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            // Check for Table component
            if (srcdoc.includes('new Table') || srcdoc.includes('Table({')) {
                this.log('found Table component in iframe');
                return true;
            }
        }

        return false;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        // Find the table iframe
        const allIframes = findAllIframes(context.container);
        const allIframesFallback = context.container.querySelectorAll<HTMLIFrameElement>('iframe');
        const combinedIframes = Array.from(new Set([...allIframes, ...allIframesFallback]));

        let tableIframe: HTMLIFrameElement | null = null;
        for (const iframe of combinedIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (!srcdoc) continue;

            if (srcdoc.includes('new Table') || srcdoc.includes('Table({')) {
                tableIframe = iframe;
                break;
            }
        }

        if (!tableIframe) {
            return this.failure('tableFill', 'No table iframe found');
        }

        // Extract equation from KaTeX annotations
        const equation = this.extractEquation(context);
        if (!equation) {
            return this.failure('tableFill', 'Could not extract equation');
        }

        this.log('extracted equation:', equation);

        // Parse the equation
        const parsed = parseLinearEquation(equation);
        if (!parsed) {
            return this.failure('tableFill', `Could not parse equation: ${equation}`);
        }

        this.log('parsed equation: y =', parsed.m, 'x +', parsed.b);

        // Access iframe window
        const iframeWindow = tableIframe.contentWindow as IIframeWindow | null;
        if (!iframeWindow) {
            return this.failure('tableFill', 'Could not access iframe window');
        }

        // Try to access INPUT_VARIABLES from srcdoc first (more reliable)
        const srcdoc = tableIframe.getAttribute('srcdoc') || '';
        let data: (number | null)[][] | null = null;
        let tokens: number[] | null = null;

        // Extract INPUT_VARIABLES from srcdoc
        // Format: const INPUT_VARIABLES = {"data": [[-4, null], ...], "tokens": [-8, -4, ...]};
        const inputVarsMatch = srcdoc.match(/INPUT_VARIABLES\s*=\s*(\{[^;]+\})/);
        if (inputVarsMatch && inputVarsMatch[1] !== undefined) {
            try {
                const jsonStr = inputVarsMatch[1];
                if (!jsonStr) {
                    throw new Error('Empty JSON string');
                }
                const parsedVars = JSON.parse(jsonStr);
                if (parsedVars.data && parsedVars.tokens) {
                    data = parsedVars.data;
                    tokens = parsedVars.tokens;
                    this.log('extracted data from srcdoc:', data, tokens);
                }
            } catch {
                this.logDebug('could not parse INPUT_VARIABLES from srcdoc, trying iframe window');
            }
        }

        // Fallback: try to get from iframe window
        if (!data || !tokens) {
            const inputVars = iframeWindow.INPUT_VARIABLES;
            const diagram = iframeWindow.diagram;

            data = inputVars?.data || diagram?.variables?.data || null;
            tokens = inputVars?.tokens || diagram?.variables?.tokens || null;
        }

        if (!data || !tokens) {
            return this.failure('tableFill', 'Could not access table data or tokens');
        }

        // Try to get table from diagram.table or window.diagram.table
        // According to transcript, table is stored at window.diagram.table
        let table = iframeWindow.diagram?.table;
        if (!table) {
            // Fallback: try accessing via window property directly
            const windowWithDiagram = iframeWindow as unknown as { diagram?: { table?: typeof table } };
            table = windowWithDiagram.diagram?.table;
        }

        if (!table || !table.setCellValue) {
            return this.failure('tableFill', 'Could not access table.setCellValue. Table may not be initialized yet.');
        }

        this.log('table data:', data);
        this.log('available tokens:', tokens);

        // Calculate missing values and fill the table
        let filledCells = 0;
        const renderNumber = iframeWindow.renderNumber || ((v: number): string => String(v));

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            if (!row || row.length < 2) continue;

            const x = row[0];
            const y = row[1];

            // If y is null, calculate it
            if (x !== null && x !== undefined && y === null) {
                const calculatedY = parsed.m * x + parsed.b;
                this.log(`row ${rowIndex}: x = ${x}, calculated y = ${calculatedY}`);

                // Find the token element that matches calculatedY
                const tokenValue = tokens.find((t) => Math.abs(t - calculatedY) < 0.001);
                if (tokenValue === undefined) {
                    this.logError(`could not find token for value ${calculatedY}`);
                    continue;
                }

                // Set the cell value (column 1 is y)
                const renderedValue = renderNumber(tokenValue);
                try {
                    // Try to find token element (might be required for drag-and-drop)
                    const tokenElement = this.findTokenElement(iframeWindow, tokenValue);

                    // Try with token element first, then without
                    if (tokenElement) {
                        table.setCellValue(rowIndex, 1, renderedValue, tokenElement);
                    } else {
                        // Try without token element (might work for direct value setting)
                        table.setCellValue(rowIndex, 1, renderedValue);
                    }
                    filledCells++;
                    this.log(`filled cell [${rowIndex}, 1] with value ${renderedValue}`);
                } catch (e) {
                    this.logError('error setting cell value:', e);
                }
            }
        }

        if (filledCells === 0) {
            return this.failure('tableFill', 'No cells were filled');
        }

        // Trigger update callbacks
        this.triggerUpdateCallbacks(iframeWindow);

        return {
            type: 'tableFill',
            success: true,
            equation,
            filledCells,
        } as ITableFillResult;
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

    private findTokenElement(iframeWindow: IIframeWindow, value: number): HTMLElement | null {
        try {
            const iframeDoc = iframeWindow.document;
            if (!iframeDoc) return null;

            // Tokens are typically in a container, look for elements with the rendered value
            const renderNumber = iframeWindow.renderNumber || ((v: number): string => String(v));
            const renderedValue = renderNumber(value);

            // Try to find token by text content
            const allElements = iframeDoc.querySelectorAll('*');
            for (const el of allElements) {
                if (el.textContent?.trim() === renderedValue || el.textContent?.includes(renderedValue)) {
                    // Check if it's draggable or looks like a token
                    if (
                        el.getAttribute('draggable') === 'true' ||
                        el.classList.contains('token') ||
                        el.getAttribute('role') === 'button'
                    ) {
                        return el as HTMLElement;
                    }
                }
            }

            // Fallback: look for elements with data attributes or specific classes
            const tokenContainers = iframeDoc.querySelectorAll('[class*="token"], [data-token]');
            for (const container of tokenContainers) {
                if (container.textContent?.includes(renderedValue)) {
                    return container as HTMLElement;
                }
            }
        } catch (e) {
            this.logError('error finding token element:', e);
        }

        return null;
    }

    private triggerUpdateCallbacks(iframeWindow: IIframeWindow): void {
        try {
            // Trigger any update callbacks that might be needed
            if (iframeWindow.diagram?.table) {
                // The table's addUpdateSubscriber should handle updates automatically
                // but we can trigger a manual update if needed
                const event = new Event('input', { bubbles: true });
                iframeWindow.document.dispatchEvent(event);
            }
        } catch (e) {
            this.logError('error triggering update callbacks:', e);
        }
    }
}
