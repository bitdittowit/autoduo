/**
 * Солвер для построения выражений
 * Drag-and-drop токенов для составления выражения равного целевому значению
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { evaluateMathExpression } from '../math/expressions';
import { findAllIframes, findIframeByContent } from '../dom/selectors';

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
    exprBuild?: { entries?: unknown[] };
    tokens?: (number | string)[];
}

export class ExpressionBuildSolver extends BaseSolver {
    readonly name = 'ExpressionBuildSolver';

    canSolve(context: IChallengeContext): boolean {
        const allIframes = findAllIframes(context.container);

        for (const iframe of allIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (srcdoc?.includes('exprBuild') || srcdoc?.includes('ExpressionBuild')) {
                return true;
            }
        }

        return false;
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
            const text = annotation.textContent ?? '';

            if (text.includes('\\duoblank')) {
                // Format: "12 = \duoblank{3}"
                const match = text.match(/(\d+)\s*=\s*\\duoblank/);
                if (match?.[1]) {
                    return parseInt(match[1], 10);
                }

                // Format: "\duoblank{3} = 12"
                const matchReverse = text.match(/\\duoblank\{\d+\}\s*=\s*(\d+)/);
                if (matchReverse?.[1]) {
                    return parseInt(matchReverse[1], 10);
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

            // Try to access exprBuild directly
            if (iframeWindow?.exprBuild) {
                const windowTokens = iframeWindow.tokens ?? [];
                tokens.push(...windowTokens);
                numEntries = iframeWindow.exprBuild.entries?.length ?? 0;
            }

            // If not found, parse from script content
            if (tokens.length === 0 && iframeDoc) {
                const scripts = iframeDoc.querySelectorAll('script');

                for (const script of scripts) {
                    const content = script.textContent ?? '';

                    // Parse tokens array
                    const tokensMatch = content.match(
                        /const\s+tokens\s*=\s*\[(.*?)\];/s,
                    );
                    if (tokensMatch?.[1]) {
                        this.parseTokensString(tokensMatch[1], tokens);
                    }

                    // Parse entries count
                    const entriesMatch = content.match(
                        /entries:\s*\[(null,?\s*)+\]/,
                    );
                    if (entriesMatch) {
                        const nullMatches = entriesMatch[0].match(/null/g);
                        numEntries = nullMatches?.length ?? 0;
                    }
                }
            }
        } catch (e) {
            this.logError('error extracting tokens:', e);
        }

        return { tokens, numEntries };
    }

    private parseTokensString(
        tokensStr: string,
        tokens: (number | string)[],
    ): void {
        const tokenParts = tokensStr.split(',').map(t => t.trim());

        for (const part of tokenParts) {
            // renderNumber(X) -> X
            const numMatch = part.match(/renderNumber\((\d+)\)/);
            if (numMatch?.[1]) {
                tokens.push(parseInt(numMatch[1], 10));
            } else {
                // String token like "+" or "-"
                const strMatch = part.match(/"([^"]+)"|'([^']+)'/);
                if (strMatch) {
                    tokens.push(strMatch[1] ?? strMatch[2] ?? '');
                }
            }
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

        // For numEntries = 1
        if (numEntries === 1) {
            for (const num of numbers) {
                if (num.value === target) {
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
        for (const num1 of numbers) {
            for (const op of operators) {
                for (const num2 of numbers) {
                    if (num1.index === num2.index) continue;

                    const result = this.evaluateOp(
                        num1.value as number,
                        op.value as string,
                        num2.value as number,
                    );

                    if (result === target) {
                        this.log(
                            'found:',
                            num1.value,
                            op.value,
                            num2.value,
                            '=',
                            target,
                        );
                        return [num1.index, op.index, num2.index];
                    }
                }
            }
        }
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

                            if (result === target) {
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

    private setSolution(iframe: HTMLIFrameElement, solution: number[]): void {
        try {
            const iframeWindow = iframe.contentWindow as IIframeWindow | null;
            if (!iframeWindow) return;

            // Set filled_entry_indices
            if (typeof iframeWindow.getOutputVariables === 'function') {
                const vars = iframeWindow.getOutputVariables();
                if (vars) {
                    vars.filled_entry_indices = solution;
                    this.log('set filled_entry_indices');
                }
            } else if (iframeWindow.OUTPUT_VARS) {
                iframeWindow.OUTPUT_VARS.filled_entry_indices = solution;
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
