/**
 * Солвер для построения выражений
 * Drag-and-drop токенов для составления выражения равного целевому значению
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { evaluateMathExpression } from '../math/expressions';
import { findAllIframes, findIframeByContent } from '../dom/selectors';
import { cleanLatexWrappers } from '../parsers/latex';

interface IExpressionBuildResult extends ISolverResult {
    type: 'expressionBuild';
    targetValue: number;
    solution: number[];
}

interface ITokenInfo {
    value: number | string;
    index: number;
}

// Declare iframe window interface
interface IIframeWindow extends Window {
    getOutputVariables?: () => { filled_entry_indices?: number[] };
    OUTPUT_VARS?: { filled_entry_indices?: number[] };
    postOutputVariables?: () => void;
    duo?: { onFirstInteraction?: () => void };
    duoDynamic?: { onInteraction?: () => void };
    exprBuild?: {
        entries?: unknown[];
        notifyUpdateSubscribers?: () => void;
    };
    tokens?: (number | string)[];
}

export class ExpressionBuildSolver extends BaseSolver {
    readonly name = 'ExpressionBuildSolver';

    canSolve(context: IChallengeContext): boolean {
        const allIframes = findAllIframes(context.container);

        // Check for ExpressionBuild iframe
        let expressionBuildIframe: HTMLIFrameElement | null = null;
        for (const iframe of allIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (srcdoc?.includes('exprBuild') || srcdoc?.includes('ExpressionBuild')) {
                // CRITICAL: Check if this is a REAL ExpressionBuild component
                // Real ExpressionBuild has: "new ExpressionBuild" AND "entries:"
                const hasExpressionBuildComponent =
                    srcdoc.includes('new ExpressionBuild') &&
                    (srcdoc.includes('entries:') || srcdoc.includes('entries ='));

                if (hasExpressionBuildComponent) {
                    // This is a real ExpressionBuild, regardless of NumberLine code in library
                    expressionBuildIframe = iframe;
                    break;
                }

                // IMPORTANT: Exclude NumberLine sliders
                // NumberLine sliders have fillToValue, StandaloneSlider, or slider configuration
                if (
                    srcdoc.includes('NumberLine') &&
                    (srcdoc.includes('fillToValue') || srcdoc.includes('StandaloneSlider'))
                ) {
                    this.log('skipping NumberLine iframe (not ExpressionBuild)');
                    continue;
                }

                // Fallback: if it has exprBuild/ExpressionBuild text but no clear indicator
                expressionBuildIframe = iframe;
                break;
            }
        }

        if (!expressionBuildIframe) {
            return false;
        }

        // Additional check: ExpressionBuild tasks have equations with \duoblank
        // This distinguishes them from pure NumberLine tasks that might have
        // 'exprBuild' or 'ExpressionBuild' in comments/variable names
        const targetValue = this.extractTargetValue(context);
        return targetValue !== null;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        // Get target value from equation
        const targetValue = this.extractTargetValue(context);
        if (targetValue === null) {
            return this.failure('expressionBuild', 'Could not determine target value');
        }

        this.log('target value =', targetValue);

        // Find expression build iframe
        const allIframes = findAllIframes(context.container);
        const iframe =
            findIframeByContent(allIframes, 'exprBuild') ??
            findIframeByContent(allIframes, 'ExpressionBuild');

        if (!iframe) {
            return this.failure('expressionBuild', 'No expression build iframe found');
        }

        // Get tokens and entries from iframe
        const { tokens, numEntries } = this.extractTokensAndEntries(iframe);

        if (tokens.length === 0) {
            return this.failure('expressionBuild', 'Could not find tokens');
        }

        this.log('tokens =', JSON.stringify(tokens), ', numEntries =', numEntries);
        this.logDebug('full token array:', tokens.map((t, i) => `[${i}]=${JSON.stringify(t)}`));

        // Find solution
        const solution = this.findExpressionSolution(tokens, numEntries, targetValue);

        if (!solution) {
            this.logError('could not find solution for target', targetValue);
            return this.failure('expressionBuild', 'No solution found');
        }

        this.log('found solution - indices:', solution);

        // Set solution in iframe
        this.setSolution(iframe, solution);

        return {
            type: 'expressionBuild',
            success: true,
            targetValue,
            solution,
        } as IExpressionBuildResult;
    }

    private extractTargetValue(context: IChallengeContext): number | null {
        const annotations = context.container.querySelectorAll('annotation');

        for (const annotation of annotations) {
            let text = annotation.textContent ?? '';

            if (text.includes('\\duoblank')) {
                // Clean LaTeX wrappers (e.g., \mathbf{-7=\duoblank{3}} -> -7=\duoblank{3})
                text = cleanLatexWrappers(text);
                this.logDebug('Raw annotation text:', annotation.textContent);
                this.logDebug('Cleaned annotation text:', text);

                // Format: "-7 = \duoblank{3}" or "12 = \duoblank{3}"
                // Match optional negative sign, digits, optional decimal part, whitespace, equals, whitespace, backslash duoblank
                const match = text.match(/^(-?\d+(?:\.\d+)?)\s*=\s*\\duoblank/);
                if (match?.[1]) {
                    const target = parseFloat(match[1]);
                    this.logDebug('Extracted target from left side:', target);
                    return target;
                }

                // Format: "\duoblank{3} = -7" or "\duoblank{3} = 12"
                // Match backslash duoblank, optional number in braces, whitespace, equals, whitespace, optional negative sign, digits, optional decimal part
                const matchReverse = text.match(/\\duoblank\{\d+\}\s*=\s*(-?\d+(?:\.\d+)?)/);
                if (matchReverse?.[1]) {
                    const target = parseFloat(matchReverse[1]);
                    this.logDebug('Extracted target from right side:', target);
                    return target;
                }
            }
        }

        return null;
    }

    private extractTokensAndEntries(
        iframe: HTMLIFrameElement,
    ): { tokens: (number | string)[]; numEntries: number } {
        const tokens: (number | string)[] = [];
        let numEntries = 0;

        try {
            const iframeWindow = iframe.contentWindow as IIframeWindow | null;
            const iframeDoc =
                iframe.contentDocument ?? iframeWindow?.document ?? null;

            // Method 1: Try to access exprBuild directly from window
            if (iframeWindow?.exprBuild) {
                const windowTokens = iframeWindow.tokens ?? [];
                if (windowTokens.length > 0) {
                    tokens.push(...windowTokens);
                    numEntries = iframeWindow.exprBuild.entries?.length ?? 0;
                    this.logDebug('extracted tokens from window.exprBuild');
                }
            }

            // Method 2: Try accessing tokens via window.tokens or window.mathDiagram
            if (tokens.length === 0 && iframeWindow) {
                try {
                    const win = iframeWindow as unknown as Record<string, unknown>;
                    if (Array.isArray(win.tokens)) {
                        tokens.push(...(win.tokens as (number | string)[]));
                        this.logDebug('extracted tokens from window.tokens');
                    }
                    // Check mathDiagram object
                    const mathDiagram = win.mathDiagram as { tokens?: (number | string)[] } | undefined;
                    if (mathDiagram?.tokens && Array.isArray(mathDiagram.tokens)) {
                        tokens.push(...mathDiagram.tokens);
                        this.logDebug('extracted tokens from window.mathDiagram.tokens');
                    }
                } catch {
                    // Cross-origin or access denied, continue to next method
                }
            }

            // Method 3: Parse from script content (more robust patterns)
            if (tokens.length === 0 && iframeDoc) {
                const scripts = iframeDoc.querySelectorAll('script');
                const allScriptContent = Array.from(scripts)
                    .map(s => s.textContent ?? '')
                    .join('\n');

                // Try multiple token patterns
                const tokenPatterns = [
                    /const\s+tokens\s*=\s*\[(.*?)\];/s,
                    /let\s+tokens\s*=\s*\[(.*?)\];/s,
                    /var\s+tokens\s*=\s*\[(.*?)\];/s,
                    /tokens\s*=\s*\[(.*?)\];/s,
                    /window\.tokens\s*=\s*\[(.*?)\];/s,
                ];

                for (const pattern of tokenPatterns) {
                    const tokensMatch = allScriptContent.match(pattern);
                    if (tokensMatch?.[1]) {
                        this.parseTokensString(tokensMatch[1], tokens);
                        if (tokens.length > 0) {
                            this.logDebug('extracted tokens from script pattern:', pattern.toString());
                            break;
                        }
                    }
                }

                // Parse entries count with multiple patterns
                const entriesPatterns = [
                    /entries:\s*\[(null,?\s*)+\]/,
                    /entries\s*:\s*\[(null,?\s*)+\]/,
                    /entries\s*=\s*\[(null,?\s*)+\]/,
                ];

                for (const pattern of entriesPatterns) {
                    const entriesMatch = allScriptContent.match(pattern);
                    if (entriesMatch) {
                        const nullMatches = entriesMatch[0].match(/null/g);
                        numEntries = nullMatches?.length ?? 0;
                        if (numEntries > 0) {
                            this.logDebug('extracted numEntries from script:', numEntries);
                            break;
                        }
                    }
                }

                // Fallback: try to infer numEntries from exprBuild structure
                if (numEntries === 0) {
                    const exprBuildMatch = allScriptContent.match(/exprBuild\s*:\s*\{[^}]*entries\s*:\s*\[(.*?)\]/s);
                    if (exprBuildMatch?.[1]) {
                        const nullMatches = exprBuildMatch[1].match(/null/g);
                        numEntries = nullMatches?.length ?? 0;
                    }
                }
            }

            // Method 4: If still no tokens, check nested iframes (for NumberLine cases)
            if (tokens.length === 0 && iframeDoc) {
                const nestedIframes = iframeDoc.querySelectorAll('iframe');
                for (const nestedIframe of nestedIframes) {
                    try {
                        const nestedWindow = (nestedIframe as HTMLIFrameElement).contentWindow as IIframeWindow | null;
                        if (nestedWindow?.tokens && Array.isArray(nestedWindow.tokens)) {
                            tokens.push(...nestedWindow.tokens);
                            this.logDebug('extracted tokens from nested iframe');
                            break;
                        }
                    } catch {
                        // Cross-origin, skip
                    }
                }
            }
        } catch (e) {
            this.logError('error extracting tokens:', e);
        }

        this.logDebug('final tokens:', tokens, 'numEntries:', numEntries);
        return { tokens, numEntries };
    }

    private parseTokensString(
        tokensStr: string,
        tokens: (number | string)[],
    ): void {
        // Remove comments and clean up
        const cleaned = tokensStr.replace(/\/\/.*$/gm, '').trim();

        // Split by comma, but be careful with nested structures
        const tokenParts: string[] = [];
        let current = '';
        let depth = 0;

        for (const char of cleaned) {
            if (char === '(' || char === '[' || char === '{') {
                depth++;
                current += char;
            } else if (char === ')' || char === ']' || char === '}') {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0) {
                tokenParts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        if (current.trim()) {
            tokenParts.push(current.trim());
        }

        for (const part of tokenParts) {
            const trimmed = part.trim();
            if (!trimmed) continue;

            // Pattern 1: renderNumber(X) -> X (supports negative numbers and decimals)
            const numMatch = trimmed.match(/renderNumber\((-?\d+(?:\.\d+)?)\)/);
            if (numMatch?.[1]) {
                tokens.push(parseFloat(numMatch[1]));
                continue;
            }

            // Pattern 2: Just a number (supports negative numbers and decimals)
            const plainNumMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)$/);
            if (plainNumMatch?.[1]) {
                tokens.push(parseFloat(plainNumMatch[1]));
                continue;
            }

            // Pattern 3: Quoted string - check if it's a number or operator
            const strMatch = trimmed.match(/"([^"]+)"|'([^']+)'/);
            if (strMatch) {
                const strValue = strMatch[1] ?? strMatch[2] ?? '';
                // Check if it's a number (including decimals)
                const quotedNumMatch = strValue.match(/^(-?\d+(?:\.\d+)?)$/);
                if (quotedNumMatch?.[1]) {
                    tokens.push(parseFloat(quotedNumMatch[1]));
                } else {
                    // It's an operator or other string token
                    tokens.push(strValue);
                }
                continue;
            }

            // Pattern 4: String without quotes (like + or -)
            if (['+', '-', '*', '/', '×', '÷'].includes(trimmed)) {
                tokens.push(trimmed);
                continue;
            }

            // Log unparsed tokens for debugging
            this.logDebug('could not parse token:', trimmed);
        }
    }

    private findExpressionSolution(
        tokens: (number | string)[],
        numEntries: number,
        target: number,
    ): number[] | null {
        // Separate numbers and operators
        const numbers: ITokenInfo[] = [];
        const operators: ITokenInfo[] = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (typeof token === 'number') {
                numbers.push({ value: token, index: i });
            } else if (
                token &&
                ['+', '-', '*', '/', '×', '÷'].includes(token)
            ) {
                operators.push({ value: token, index: i });
            }
        }

        this.logDebug('separated tokens - numbers:', numbers.map(n => `[${n.index}]=${n.value}`), 'operators:', operators.map(o => `[${o.index}]=${o.value}`));

        // For numEntries = 1
        if (numEntries === 1) {
            for (const num of numbers) {
                if (this.isEqualWithTolerance(num.value as number, target)) {
                    return [num.index];
                }
            }
            return null;
        }

        // For numEntries = 3: num1 op num2
        if (numEntries === 3) {
            return this.findThreeTokenSolution(numbers, operators, target);
        }

        // For numEntries = 5: num1 op1 num2 op2 num3
        if (numEntries === 5) {
            return this.findFiveTokenSolution(numbers, operators, target);
        }

        return null;
    }

    private findThreeTokenSolution(
        numbers: ITokenInfo[],
        operators: ITokenInfo[],
        target: number,
    ): number[] | null {
        this.logDebug('findThreeTokenSolution: numbers:', numbers.map(n => `${n.value}[${n.index}]`), 'operators:', operators.map(o => `${o.value}[${o.index}]`), 'target:', target);

        // Standard pattern: num1 op num2 (3 tokens total)
        for (const num1 of numbers) {
            for (const op of operators) {
                for (const num2 of numbers) {
                    if (num1.index === num2.index) continue;

                    const result = this.evaluateOp(
                        num1.value as number,
                        op.value as string,
                        num2.value as number,
                    );

                    if (result !== null && this.isEqualWithTolerance(result, target)) {
                        this.log(
                            'found solution:',
                            num1.value,
                            op.value,
                            num2.value,
                            '=',
                            target,
                            '(indices:',
                            [num1.index, op.index, num2.index],
                            ')',
                        );
                        return [num1.index, op.index, num2.index];
                    }
                }
            }
        }

        this.logDebug('no solution found for 3-token pattern');
        return null;
    }

    private findFiveTokenSolution(
        numbers: ITokenInfo[],
        operators: ITokenInfo[],
        target: number,
    ): number[] | null {
        for (const num1 of numbers) {
            for (const op1 of operators) {
                for (const num2 of numbers) {
                    if (num2.index === num1.index) continue;
                    for (const op2 of operators) {
                        if (op2.index === op1.index) continue;
                        for (const num3 of numbers) {
                            if (
                                num3.index === num1.index ||
                                num3.index === num2.index
                            )
                                continue;

                            const expr = `${num1.value}${op1.value}${num2.value}${op2.value}${num3.value}`;
                            const result = evaluateMathExpression(expr);

                            if (result !== null && this.isEqualWithTolerance(result, target)) {
                                this.log('found:', expr, '=', target);
                                return [
                                    num1.index,
                                    op1.index,
                                    num2.index,
                                    op2.index,
                                    num3.index,
                                ];
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    private evaluateOp(a: number, op: string, b: number): number | null {
        switch (op) {
        case '+':
            return a + b;
        case '-':
            return a - b;
        case '*':
        case '×':
            return a * b;
        case '/':
        case '÷':
            return b !== 0 ? a / b : null;
        default:
            return null;
        }
    }

    private isEqualWithTolerance(a: number, b: number, tolerance = 0.0001): boolean {
        return Math.abs(a - b) < tolerance;
    }

    private setSolution(iframe: HTMLIFrameElement, solution: number[]): void {
        try {
            const iframeWindow = iframe.contentWindow as IIframeWindow | null;
            if (!iframeWindow) return;

            // IMPORTANT: Set exprBuild.entries directly with token values (not indices)
            // The component's update subscriber will then populate filled_entry_indices
            if (iframeWindow.exprBuild && iframeWindow.tokens) {
                const tokens = iframeWindow.tokens;
                const entries: (string | number | null)[] = solution.map((idx) => {
                    const token = tokens[idx];
                    return token !== undefined ? token : null;
                });

                // Set entries array
                if (Array.isArray(iframeWindow.exprBuild.entries)) {
                    for (let i = 0; i < entries.length && i < iframeWindow.exprBuild.entries.length; i++) {
                        iframeWindow.exprBuild.entries[i] = entries[i];
                    }
                    this.log('set exprBuild.entries:', entries);

                    // Notify the component of changes
                    if (typeof iframeWindow.exprBuild.notifyUpdateSubscribers === 'function') {
                        iframeWindow.exprBuild.notifyUpdateSubscribers();
                    }
                } else {
                    this.logError('exprBuild.entries is not an array');
                }
            } else {
                this.logError('exprBuild or tokens not found in iframe');
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
        } catch (e) {
            this.logError('error setting solution:', e);
        }
    }
}
