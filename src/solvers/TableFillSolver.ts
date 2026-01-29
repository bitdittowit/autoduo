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
import { SELECTORS } from '../dom/selectors';

interface ITableFillResult extends ISolverResult {
    type: 'tableFill';
    equation: string;
    filledCells: number;
}

interface ITableMatchResult extends ISolverResult {
    type: 'tableMatch';
    equation: string;
    selectedChoice: number;
}

// Table type definition
interface ITableType {
    setCellValue?: (
        rowIndex: number,
        colIndex: number,
        value: string,
        tokenElement?: HTMLElement,
    ) => void;
}

// Declare iframe window interface
interface IIframeWindow extends Window {
    INPUT_VARIABLES?: {
        data?: (number | null)[][];
        tokens?: number[];
        x_values?: number[];
        y_values?: number[];
    };
    mathDiagram?: ITableType; // Primary location for Table instance (assigned in srcdoc)
    diagram?: {
        table?: ITableType;
        variables?: {
            data?: (number | null)[][];
            tokens?: number[];
            x_values?: number[];
            y_values?: number[];
        };
    };
    renderNumber?: (value: number) => string;
    duo?: { onFirstInteraction?: () => void };
    duoDynamic?: { onInteraction?: () => void };
    postOutputVariables?: () => void;
    getOutputVariables?: () => unknown;
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

/**
 * Вычисляет линейное уравнение y = mx + b из массива точек методом наименьших квадратов
 * @param xValues - массив значений x
 * @param yValues - массив значений y
 * @returns объект с коэффициентом m и константой b, или null
 */
function calculateLinearRegression(xValues: number[], yValues: number[]): { m: number; b: number } | null {
    if (xValues.length !== yValues.length || xValues.length < 2) {
        return null;
    }

    const n = xValues.length;

    // Вычисляем средние значения
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;

    // Вычисляем коэффициенты методом наименьших квадратов
    let numerator = 0; // Σ((x - x̄)(y - ȳ))
    let denominator = 0; // Σ((x - x̄)²)

    for (let i = 0; i < n; i++) {
        const x = xValues[i];
        const y = yValues[i];
        if (x === undefined || y === undefined) continue;
        const xDiff = x - xMean;
        const yDiff = y - yMean;
        numerator += xDiff * yDiff;
        denominator += xDiff * xDiff;
    }

    // Если знаменатель равен нулю, все x одинаковы (вертикальная линия)
    if (Math.abs(denominator) < 1e-10) {
        return null;
    }

    const m = numerator / denominator;
    const b = yMean - m * xMean;

    return { m, b };
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

        // Access iframe window
        const iframeWindow = tableIframe.contentWindow as IIframeWindow | null;
        if (!iframeWindow) {
            return this.failure('tableFill', 'Could not access iframe window');
        }

        // Try to access INPUT_VARIABLES from srcdoc first (more reliable)
        const srcdoc = tableIframe.getAttribute('srcdoc') || '';
        let inputVarsParsed: {
            data?: (number | null)[][];
            tokens?: number[];
            x_values?: number[];
            y_values?: number[];
        } | null = null;

        // Extract INPUT_VARIABLES from srcdoc
        const inputVarsMatch = srcdoc.match(/INPUT_VARIABLES\s*=\s*(\{[^;]+\})/);
        if (inputVarsMatch && inputVarsMatch[1] !== undefined) {
            try {
                const jsonStr = inputVarsMatch[1];
                if (!jsonStr) {
                    throw new Error('Empty JSON string');
                }
                inputVarsParsed = JSON.parse(jsonStr);
                this.log('extracted INPUT_VARIABLES from srcdoc:', inputVarsParsed);
            } catch {
                this.logDebug('could not parse INPUT_VARIABLES from srcdoc, trying iframe window');
            }
        }

        // Fallback: try to get from iframe window
        if (!inputVarsParsed) {
            inputVarsParsed = iframeWindow.INPUT_VARIABLES || iframeWindow.diagram?.variables || null;
        }

        if (!inputVarsParsed) {
            return this.failure('tableFill', 'Could not access INPUT_VARIABLES');
        }

        // Check if this is a "Select the match" challenge (has x_values/y_values and multiple-choice options)
        const hasXValues = !!(inputVarsParsed.x_values && inputVarsParsed.y_values);
        const hasMultipleChoice = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE).length > 0;

        if (hasXValues && hasMultipleChoice) {
            // New type: "Select the match" - calculate equation from points and select multiple-choice option
            return this.solveTableMatch(context, tableIframe, iframeWindow, inputVarsParsed);
        } else if (inputVarsParsed.data && inputVarsParsed.tokens) {
            // Old type: Fill table cells with tokens
            return this.solveTableFill(context, tableIframe, iframeWindow, inputVarsParsed);
        } else {
            return this.failure('tableFill', 'Could not access table data or tokens (neither x_values/y_values nor data/tokens found)');
        }
    }

    /**
     * Решает задание типа "Select the match": вычисляет уравнение из точек и выбирает правильный вариант
     */
    private solveTableMatch(
        context: IChallengeContext,
        tableIframe: HTMLIFrameElement,
        iframeWindow: IIframeWindow,
        inputVars: { x_values?: number[]; y_values?: number[] },
    ): ISolverResult | null {
        this.log('solving "Select the match" challenge');

        const xValues = inputVars.x_values;
        const yValues = inputVars.y_values;

        if (!xValues || !yValues || xValues.length !== yValues.length || xValues.length < 2) {
            return this.failure('tableMatch', 'Invalid x_values or y_values');
        }

        this.log('x_values:', xValues);
        this.log('y_values:', yValues);

        // Calculate linear equation from points
        const regression = calculateLinearRegression(xValues, yValues);
        if (!regression) {
            return this.failure('tableMatch', 'Could not calculate linear regression');
        }

        // Round to reasonable precision (avoid floating point errors)
        const m = Math.round(regression.m * 1000) / 1000;
        const b = Math.round(regression.b * 1000) / 1000;

        this.log(`calculated equation: y = ${m}x + ${b}`);

        // Find multiple-choice options
        const choices = context.container.querySelectorAll(SELECTORS.CHALLENGE_CHOICE);
        if (choices.length === 0) {
            return this.failure('tableMatch', 'No multiple-choice options found');
        }

        this.log(`found ${choices.length} choices`);

        // Find the matching choice
        let selectedIndex = -1;
        for (let i = 0; i < choices.length; i++) {
            const choice = choices[i];
            if (!choice) continue;

            // Extract equation from choice (KaTeX)
            const choiceEquation = extractKatexValue(choice);
            if (!choiceEquation) {
                this.logDebug(`choice ${i}: could not extract equation`);
                continue;
            }

            this.log(`choice ${i}: ${choiceEquation}`);

            // Parse the equation
            const parsed = parseLinearEquation(choiceEquation);
            if (!parsed) {
                this.logDebug(`choice ${i}: could not parse equation`);
                continue;
            }

            // Round to same precision
            const choiceM = Math.round(parsed.m * 1000) / 1000;
            const choiceB = Math.round(parsed.b * 1000) / 1000;

            this.log(`choice ${i}: parsed as y = ${choiceM}x + ${choiceB}`);

            // Check if it matches (with tolerance for floating point errors)
            if (Math.abs(choiceM - m) < 0.001 && Math.abs(choiceB - b) < 0.001) {
                this.log(`found matching choice: ${i}`);
                selectedIndex = i;
                break;
            }
        }

        if (selectedIndex === -1) {
            return this.failure('tableMatch', `Could not find matching choice for equation y = ${m}x + ${b}`);
        }

        // Click the matching choice
        const choice = choices[selectedIndex];
        if (choice) {
            this.log(`clicking choice ${selectedIndex}`);
            this.click(choice);
        }

        // Format equation string
        let equation: string;
        if (Math.abs(b) < 0.001) {
            // b is effectively 0
            equation = `y = ${m}x`;
        } else {
            equation = `y = ${m}x${b >= 0 ? ' + ' : ' - '}${Math.abs(b)}`;
        }

        return this.success<ITableMatchResult>({
            type: 'tableMatch',
            equation,
            selectedChoice: selectedIndex,
        });
    }

    /**
     * Решает задание типа "Fill the table": заполняет ячейки таблицы значениями из токенов
     */
    private solveTableFill(
        context: IChallengeContext,
        tableIframe: HTMLIFrameElement,
        iframeWindow: IIframeWindow,
        inputVars: { data?: (number | null)[][]; tokens?: number[] },
    ): ISolverResult | null {
        this.log('solving "Fill the table" challenge');

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

        const data = inputVars.data;
        const tokens = inputVars.tokens;

        if (!data || !tokens) {
            return this.failure('tableFill', 'Could not access table data or tokens');
        }

        // Wait for table to be initialized (it's created in DOMContentLoaded)
        const table = this.waitForTable(iframeWindow);
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

            // If y is null, calculate it from x
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
            // If x is null, calculate it from y
            else if (y !== null && y !== undefined && x === null) {
                // Solve for x: y = mx + b => x = (y - b) / m
                if (Math.abs(parsed.m) < 0.001) {
                    this.logError(`row ${rowIndex}: cannot solve for x when m is 0 (y = ${y})`);
                    continue;
                }

                const calculatedX = (y - parsed.b) / parsed.m;
                this.log(`row ${rowIndex}: y = ${y}, calculated x = ${calculatedX}`);

                // Find the token element that matches calculatedX
                const tokenValue = tokens.find((t) => Math.abs(t - calculatedX) < 0.001);
                if (tokenValue === undefined) {
                    this.logError(`could not find token for value ${calculatedX}`);
                    continue;
                }

                // Set the cell value (column 0 is x)
                const renderedValue = renderNumber(tokenValue);
                try {
                    // Try to find token element (might be required for drag-and-drop)
                    const tokenElement = this.findTokenElement(iframeWindow, tokenValue);

                    // Try with token element first, then without
                    if (tokenElement) {
                        table.setCellValue(rowIndex, 0, renderedValue, tokenElement);
                    } else {
                        // Try without token element (might work for direct value setting)
                        table.setCellValue(rowIndex, 0, renderedValue);
                    }
                    filledCells++;
                    this.log(`filled cell [${rowIndex}, 0] with value ${renderedValue}`);
                } catch (e) {
                    this.logError('error setting cell value:', e);
                }
            }
        }

        if (filledCells === 0) {
            return this.failure('tableFill', 'No cells were filled');
        }

        // Add a small delay to allow table component to process changes
        this.syncDelay(100);

        // Trigger update callbacks with comprehensive event dispatching
        this.triggerUpdateCallbacks(iframeWindow);

        // Add another delay after triggering callbacks to give Duolingo time to validate
        this.syncDelay(200);

        return this.success<ITableFillResult>({
            type: 'tableFill',
            equation,
            filledCells,
        });
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

    /**
     * Ожидает инициализации таблицы в iframe
     * Использует синхронный опрос с ограничением по времени
     * ВАЖНО: Использует busy-wait, который блокирует поток, но ограничен коротким временем
     */
    private waitForTable(iframeWindow: IIframeWindow): ITableType | null {
        const maxAttempts = 100; // Увеличено количество попыток
        const delayMs = 20; // Увеличена задержка между попытками (максимум 2 секунды)

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                // First, check if iframe document is ready
                const iframeDoc = iframeWindow.document;
                if (!iframeDoc || iframeDoc.readyState === 'loading') {
                    // Document not ready yet, continue waiting
                    if (attempt % 10 === 0) {
                        this.logDebug(`attempt ${attempt + 1}: iframe document not ready`);
                    }
                } else {
                    let table: ITableType | null = null;

                    // Path 1 (PRIMARY): window.mathDiagram - Table instance is assigned here in srcdoc
                    if (iframeWindow.mathDiagram && typeof iframeWindow.mathDiagram.setCellValue === 'function') {
                        table = iframeWindow.mathDiagram;
                        this.log('found table at window.mathDiagram');
                        if (attempt > 0) {
                            this.log(`table initialized after ${attempt} attempts (${attempt * delayMs}ms)`);
                        }
                        return table;
                    }

                    // Path 2 (SECONDARY): diagram.table
                    table = iframeWindow.diagram?.table || null;
                    if (table && typeof table.setCellValue === 'function') {
                        this.log('found table at diagram.table');
                        if (attempt > 0) {
                            this.log(`table initialized after ${attempt} attempts (${attempt * delayMs}ms)`);
                        }
                        return table;
                    }

                    // Path 3 (TERTIARY): Try accessing via window property directly (fallback)
                    if (!table) {
                        const windowWithDiagram = iframeWindow as unknown as {
                            diagram?: {
                                table?: ITableType;
                            };
                        };
                        table = windowWithDiagram.diagram?.table || null;
                        if (table && typeof table.setCellValue === 'function') {
                            this.log('found table at diagram.table (via fallback)');
                            if (attempt > 0) {
                                this.log(`table initialized after ${attempt} attempts (${attempt * delayMs}ms)`);
                            }
                            return table;
                        }
                    }

                    // Path 4 (GENERIC FALLBACK): Try to find table instance from diagram properties
                    if (!table && iframeWindow.diagram) {
                        const diagramAny = iframeWindow.diagram as unknown as Record<string, unknown>;
                        for (const key in diagramAny) {
                            const value = diagramAny[key];
                            if (
                                value &&
                                typeof value === 'object' &&
                                'setCellValue' in value &&
                                typeof (value as { setCellValue?: unknown }).setCellValue === 'function'
                            ) {
                                table = value as ITableType;
                                this.log(`found table at diagram.${key}`);
                                if (attempt > 0) {
                                    this.log(`table initialized after ${attempt} attempts (${attempt * delayMs}ms)`);
                                }
                                return table;
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore errors during polling (cross-origin restrictions, etc.)
                if (attempt % 10 === 0) {
                    // Log every 10th attempt to avoid spam
                    this.logDebug(`attempt ${attempt + 1}: table not ready yet (${e})`);
                }
            }

            // Synchronous delay using Date.now() (блокирует поток, но только на короткое время)
            // Это необходимо, так как solve() синхронный и мы не можем использовать async/await
            const startTime = Date.now();
            while (Date.now() - startTime < delayMs) {
                // Busy wait - ограничен временем (максимум 2 секунды всего)
            }
        }

        this.logError(`table not initialized after ${maxAttempts} attempts (${maxAttempts * delayMs}ms)`);
        return null;
    }

    private triggerUpdateCallbacks(iframeWindow: IIframeWindow): void {
        try {
            const iframeDoc = iframeWindow.document;
            if (!iframeDoc) return;

            // Check both mathDiagram (primary) and diagram.table (fallback)
            const table = iframeWindow.mathDiagram || iframeWindow.diagram?.table;
            if (!table) return;

            this.log('triggering update callbacks');

            // Try to call table's validation/update methods if they exist
            const tableAny = table as unknown as Record<string, unknown>;
            if (typeof tableAny.validate === 'function') {
                try {
                    (tableAny.validate as () => void)();
                    this.log('called table.validate()');
                } catch (e) {
                    this.logDebug('table.validate() not available or failed:', e);
                }
            }
            if (typeof tableAny.notifyUpdate === 'function') {
                try {
                    (tableAny.notifyUpdate as () => void)();
                    this.log('called table.notifyUpdate()');
                } catch (e) {
                    this.logDebug('table.notifyUpdate() not available or failed:', e);
                }
            }
            if (typeof tableAny.notifyUpdateSubscribers === 'function') {
                try {
                    (tableAny.notifyUpdateSubscribers as () => void)();
                    this.log('called table.notifyUpdateSubscribers()');
                } catch (e) {
                    this.logDebug('table.notifyUpdateSubscribers() not available or failed:', e);
                }
            }

            // Find table cells in the DOM and dispatch events on them
            const tableCells = iframeDoc.querySelectorAll('td, [role="gridcell"], [class*="cell"]');
            if (tableCells.length > 0) {
                this.log(`found ${tableCells.length} table cells, dispatching events`);
                tableCells.forEach((cell) => {
                    // Dispatch input event
                    cell.dispatchEvent(new Event('input', { bubbles: true }));
                    // Dispatch change event
                    cell.dispatchEvent(new Event('change', { bubbles: true }));
                    // Dispatch blur event (simulates user finishing input)
                    cell.dispatchEvent(new Event('blur', { bubbles: true }));
                });
            }

            // Dispatch comprehensive events on document
            const events = ['input', 'change', 'blur', 'focusout'];
            events.forEach((eventType) => {
                const event = new Event(eventType, { bubbles: true });
                iframeDoc.dispatchEvent(event);
            });

            // Dispatch custom events that might be expected
            const customEvents = ['tableUpdate', 'diagramUpdate', 'cellUpdate', 'valueChange'];
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
