/**
 * Солвер для дерева факторов
 * Размещает числа в дереве факторов где parent = left * right
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { findAllIframes, findIframeByContent } from '../dom/selectors';

interface IFactorTreeResult extends ISolverResult {
    type: 'factorTree';
    tokenTreeIndices: number[];
}

interface ITreeNode {
    value: number | null;
    left?: ITreeNode | null;
    right?: ITreeNode | null;
}

interface IBlankInfo {
    treeIndex: number;
    expectedValue: number | null;
}

// Declare iframe window interface
interface IIframeWindow extends Window {
    getOutputVariables?: () => { tokenTreeIndices?: number[] };
    OUTPUT_VARS?: { tokenTreeIndices?: number[] };
    postOutputVariables?: () => void;
    duo?: { onFirstInteraction?: () => void };
    duoDynamic?: { onInteraction?: () => void };
}

export class FactorTreeSolver extends BaseSolver {
    readonly name = 'FactorTreeSolver';

    canSolve(context: IChallengeContext): boolean {
        const allIframes = findAllIframes(context.container);

        for (const iframe of allIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (srcdoc?.includes('originalTree') && srcdoc.includes('originalTokens')) {
                return true;
            }
        }

        return false;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        const allIframes = findAllIframes(context.container);
        const iframe = findIframeByContent(allIframes, 'originalTree');

        if (!iframe) {
            return this.failure('factorTree', 'No factor tree iframe found');
        }

        const srcdoc = iframe.getAttribute('srcdoc');
        if (!srcdoc) {
            return this.failure('factorTree', 'No srcdoc found');
        }

        // Parse originalTree
        const tree = this.parseTree(srcdoc);
        if (!tree) {
            return this.failure('factorTree', 'Could not parse tree');
        }

        // Parse originalTokens
        const tokens = this.parseTokens(srcdoc);
        if (tokens.length === 0) {
            return this.failure('factorTree', 'No tokens found');
        }

        this.logDebug('tokens =', JSON.stringify(tokens));

        // Find blanks and their expected values
        const blanks = this.findBlanks(tree);
        this.logDebug('blanks =', JSON.stringify(blanks));

        // Match tokens to blanks
        const tokenTreeIndices = this.matchTokensToBlanks(tokens, blanks);
        this.log('solution tokenTreeIndices =', JSON.stringify(tokenTreeIndices));

        // Set solution
        const success = this.setSolution(iframe, tokenTreeIndices);

        const result: IFactorTreeResult = {
            type: 'factorTree',
            success,
            tokenTreeIndices,
        };

        return result;
    }

    private parseTree(srcdoc: string): ITreeNode | null {
        const treeMatch = srcdoc.match(/const\s+originalTree\s*=\s*(\{[\s\S]*?\});/);
        if (!treeMatch?.[1]) {
            this.logError('could not find originalTree in srcdoc');
            return null;
        }

        try {
            return JSON.parse(treeMatch[1]) as ITreeNode;
        } catch (e) {
            this.logError('failed to parse originalTree:', e);
            return null;
        }
    }

    private parseTokens(srcdoc: string): number[] {
        const tokensMatch = srcdoc.match(
            /const\s+originalTokens\s*=\s*\[([\s\S]*?)\];/,
        );
        if (!tokensMatch?.[1]) {
            this.logError('could not find originalTokens in srcdoc');
            return [];
        }

        const tokens: number[] = [];
        const numberMatches = tokensMatch[1].matchAll(/renderNumber\((\d+)\)/g);

        for (const match of numberMatches) {
            if (match[1]) {
                tokens.push(parseInt(match[1], 10));
            }
        }

        return tokens;
    }

    private findBlanks(tree: ITreeNode): IBlankInfo[] {
        const blanks: IBlankInfo[] = [];
        const nodeMap = new Map<number, ITreeNode>();
        const blankExpectedValues = new Map<number, number>();

        // Helper to get effective value (actual or calculated expected value)
        const getEffectiveValue = (
            node: ITreeNode | null | undefined,
            treeIndex: number,
        ): number | null => {
            if (!node) return null;
            if (node.value !== null) {
                return typeof node.value === 'number' ? node.value : parseFloat(String(node.value));
            }
            return blankExpectedValues.get(treeIndex) ?? null;
        };

        // Post-order traversal: visit children first, then parent
        const traverseTree = (
            node: ITreeNode | null | undefined,
            treeIndex: number,
            parentNode: ITreeNode | null = null,
        ): void => {
            if (!node) return;

            nodeMap.set(treeIndex, node);

            // First, recursively traverse children (post-order)
            if (node.left) {
                traverseTree(node.left, treeIndex * 2, node);
            }
            if (node.right) {
                traverseTree(node.right, treeIndex * 2 + 1, node);
            }

            // Now process this node (after children have been processed)
            if (node.value === null) {
                let expectedValue: number | null = null;

                // Case 1: Calculate from children (parent = left * right)
                const leftValue = getEffectiveValue(node.left, treeIndex * 2);
                const rightValue = getEffectiveValue(node.right, treeIndex * 2 + 1);

                if (leftValue !== null && rightValue !== null) {
                    expectedValue = leftValue * rightValue;
                    blankExpectedValues.set(treeIndex, expectedValue);
                    this.logDebug(
                        'blank at index',
                        treeIndex,
                        'expected value =',
                        leftValue,
                        '*',
                        rightValue,
                        '=',
                        expectedValue,
                    );
                }
                // Case 2: Calculate from parent and sibling (child = parent / sibling)
                else if (parentNode) {
                    const parentTreeIndex = Math.floor(treeIndex / 2);
                    const parentValue = getEffectiveValue(parentNode, parentTreeIndex);

                    if (parentValue !== null) {
                        let siblingValue: number | null = null;
                        if (treeIndex % 2 === 0) {
                            // Even index = left child, check right sibling
                            siblingValue = getEffectiveValue(parentNode.right, treeIndex + 1);
                        } else {
                            // Odd index = right child, check left sibling
                            siblingValue = getEffectiveValue(parentNode.left, treeIndex - 1);
                        }

                        if (
                            siblingValue !== null &&
                            siblingValue !== 0 &&
                            parentValue % siblingValue === 0
                        ) {
                            expectedValue = parentValue / siblingValue;
                            blankExpectedValues.set(treeIndex, expectedValue);
                            this.logDebug(
                                'blank at index',
                                treeIndex,
                                'expected value =',
                                parentValue,
                                '/',
                                siblingValue,
                                '=',
                                expectedValue,
                            );
                        }
                    }
                }

                blanks.push({ treeIndex, expectedValue });
            }
        };

        // Start traversal from root at index 1
        traverseTree(tree, 1);

        // Iterative refinement for blanks that couldn't be calculated
        let changed = true;
        while (changed) {
            changed = false;
            for (const blank of blanks) {
                if (blank.expectedValue === null) {
                    const node = nodeMap.get(blank.treeIndex);
                    if (!node) continue;

                    // Try to calculate from children
                    const leftValue = getEffectiveValue(node.left, blank.treeIndex * 2);
                    const rightValue = getEffectiveValue(node.right, blank.treeIndex * 2 + 1);

                    if (leftValue !== null && rightValue !== null) {
                        const newExpectedValue = leftValue * rightValue;
                        blank.expectedValue = newExpectedValue;
                        blankExpectedValues.set(blank.treeIndex, newExpectedValue);
                        changed = true;
                        this.logDebug(
                            'blank at index',
                            blank.treeIndex,
                            'expected value (refined from children) =',
                            leftValue,
                            '*',
                            rightValue,
                            '=',
                            newExpectedValue,
                        );
                    } else {
                        // Try to calculate from parent and sibling
                        const parentTreeIndex = Math.floor(blank.treeIndex / 2);
                        if (parentTreeIndex >= 1) {
                            const parentNode = nodeMap.get(parentTreeIndex);
                            if (parentNode) {
                                const parentValue = getEffectiveValue(parentNode, parentTreeIndex);

                                if (parentValue !== null) {
                                    let siblingValue: number | null = null;
                                    if (blank.treeIndex % 2 === 0) {
                                        siblingValue = getEffectiveValue(
                                            parentNode.right,
                                            blank.treeIndex + 1,
                                        );
                                    } else {
                                        siblingValue = getEffectiveValue(
                                            parentNode.left,
                                            blank.treeIndex - 1,
                                        );
                                    }

                                    if (
                                        siblingValue !== null &&
                                        siblingValue !== 0 &&
                                        parentValue % siblingValue === 0
                                    ) {
                                        const newExpectedValue = parentValue / siblingValue;
                                        blank.expectedValue = newExpectedValue;
                                        blankExpectedValues.set(blank.treeIndex, newExpectedValue);
                                        changed = true;
                                        this.logDebug(
                                            'blank at index',
                                            blank.treeIndex,
                                            'expected value (refined from parent) =',
                                            parentValue,
                                            '/',
                                            siblingValue,
                                            '=',
                                            newExpectedValue,
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        this.logDebug(
            'found',
            blanks.length,
            'blank(s):',
            JSON.stringify(
                blanks.map(b => ({ treeIndex: b.treeIndex, expectedValue: b.expectedValue })),
            ),
        );

        return blanks;
    }

    private matchTokensToBlanks(tokens: number[], blanks: IBlankInfo[]): number[] {
        const tokenTreeIndices = new Array<number>(tokens.length).fill(0);
        const usedBlanks = new Set<number>();

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            for (const blank of blanks) {
                if (
                    blank.expectedValue === token &&
                    !usedBlanks.has(blank.treeIndex)
                ) {
                    tokenTreeIndices[i] = blank.treeIndex;
                    usedBlanks.add(blank.treeIndex);
                    this.logDebug(
                        'token',
                        token,
                        '(index',
                        i,
                        ') -> tree position',
                        blank.treeIndex,
                    );
                    break;
                }
            }
        }

        return tokenTreeIndices;
    }

    private setSolution(iframe: HTMLIFrameElement, solution: number[]): boolean {
        let success = false;

        try {
            const iframeWindow = iframe.contentWindow as IIframeWindow | null;
            if (!iframeWindow) return false;

            // Set tokenTreeIndices
            if (typeof iframeWindow.getOutputVariables === 'function') {
                const vars = iframeWindow.getOutputVariables();
                if (vars && 'tokenTreeIndices' in vars) {
                    vars.tokenTreeIndices = solution;
                    success = true;
                    this.log('set tokenTreeIndices via getOutputVariables');
                }
            }

            if (!success && iframeWindow.OUTPUT_VARS) {
                iframeWindow.OUTPUT_VARS.tokenTreeIndices = solution;
                success = true;
                this.log('set tokenTreeIndices via OUTPUT_VARS');
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
                { type: 'outputVariables', payload: { tokenTreeIndices: solution } },
                '*',
            );
        } catch (e) {
            this.logError('error setting solution:', e);
        }

        return success;
    }
}
