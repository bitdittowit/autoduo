/**
 * Солвер для заданий "Match the pairs"
 * Сопоставляет элементы по значениям: дроби, pie charts, округление
 */

import { BaseSolver } from './BaseSolver';
import type { IChallengeContext, ISolverResult } from '../types';
import { extractKatexValue } from '../parsers/KatexParser';
import { extractPieChartFraction } from '../parsers/PieChartParser';
import { extractBlockDiagramValue, isBlockDiagram } from '../parsers/BlockDiagramParser';
import { evaluateMathExpression } from '../math/expressions';
import { roundToNearest } from '../math/rounding';
import { findAllIframes } from '../dom/selectors';

interface IToken {
    index: number;
    element: Element;
    rawValue: string;
    numericValue: number | null;
    isBlockDiagram?: boolean;
    isPieChart?: boolean;
    isExpression?: boolean;
    isRoundingTarget?: boolean;
    roundingBase?: number;
    isFactorsList?: boolean;
    factors?: number[];
}

interface IMatchPairsResult extends ISolverResult {
    type: 'matchPairs';
    pairs: { first: string; second: string }[];
    clickedPair: { first: string; second: string };
}

export class MatchPairsSolver extends BaseSolver {
    readonly name = 'MatchPairsSolver';

    canSolve(context: IChallengeContext): boolean {
        // Match pairs require a specific header
        const hasHeader = this.headerContains(context, 'match', 'pair') ||
            this.headerContains(context, 'match', 'equivalent');

        if (!hasHeader) {
            // Without a specific header, don't match (to avoid false positives)
            return false;
        }

        // Exclude if there's a NumberLine slider (those use InteractiveSliderSolver)
        const allIframes = findAllIframes(context.container);
        for (const iframe of allIframes) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (srcdoc?.includes('NumberLine')) {
                // Exclude ExpressionBuild components
                if (!srcdoc.includes('exprBuild') && !srcdoc.includes('ExpressionBuild')) {
                    return false; // This is a slider challenge, not a match pairs challenge
                }
            }
        }

        // Check for tap token elements specifically (both variants)
        const tapTokens = context.container.querySelectorAll(
            '[data-test="challenge-tap-token"], [data-test="-challenge-tap-token"]',
        );

        // Need at least 2 tokens to form a pair
        // Also check if there are any active (non-disabled) tokens remaining
        const activeTokens = Array.from(tapTokens).filter(
            token => token.getAttribute('aria-disabled') !== 'true',
        );

        // Require header AND at least 2 active tokens
        return activeTokens.length >= 2;
    }

    solve(context: IChallengeContext): ISolverResult | null {
        this.log('starting');

        const tapTokens = context.container.querySelectorAll(
            '[data-test="challenge-tap-token"], [data-test="-challenge-tap-token"]',
        );

        this.log('found tap tokens:', tapTokens.length);

        if (tapTokens.length < 2) {
            return this.failure('matchPairs', 'Not enough tap tokens');
        }

        // Extract values from all tokens (only active/clickable ones)
        const tokens = this.extractTokens(Array.from(tapTokens));

        this.log('active tokens:', tokens.length);

        if (tokens.length < 2) {
            // Check if challenge is already complete (all pairs matched)
            const allDisabled = Array.from(tapTokens).every(
                token => token.getAttribute('aria-disabled') === 'true',
            );
            if (allDisabled && tapTokens.length >= 2) {
                this.log('all pairs already matched, challenge complete');
                return this.success<IMatchPairsResult>({
                    type: 'matchPairs',
                    pairs: [],
                    clickedPair: { first: '', second: '' },
                });
            }
            return this.failure('matchPairs', 'Not enough active tokens');
        }

        // Find matching pairs
        const pairs = this.findPairs(tokens);

        if (pairs.length === 0) {
            this.logError('no matching pairs found');
            return this.failure('matchPairs', 'No matching pairs found');
        }

        this.log('found', pairs.length, 'pairs to match');

        // Click all pairs sequentially
        // Start clicking the first pair immediately
        const firstPair = pairs[0];
        if (!firstPair) {
            return this.failure('matchPairs', 'No pair to click');
        }

        this.log('clicking pair:', firstPair.first.rawValue, '↔', firstPair.second.rawValue);

        this.click(firstPair.first.element);

        // Click second element of first pair with delay
        setTimeout(() => {
            this.click(firstPair.second.element);
        }, 100);

        // If there are more pairs, click them sequentially with delays
        // This allows DOM to update between clicks
        for (let i = 1; i < pairs.length; i++) {
            const pair = pairs[i];
            if (!pair) continue;

            setTimeout(() => {
                this.log('clicking pair:', pair.first.rawValue, '↔', pair.second.rawValue);
                this.click(pair.first.element);
                setTimeout(() => {
                    this.click(pair.second.element);
                }, 100);
            }, 300 * i); // Delay increases for each subsequent pair
        }

        return this.success<IMatchPairsResult>({
            type: 'matchPairs',
            pairs: pairs.map(p => ({
                first: p.first.rawValue,
                second: p.second.rawValue,
            })),
            clickedPair: {
                first: firstPair.first.rawValue,
                second: firstPair.second.rawValue,
            },
        });
    }

    private extractTokens(tapTokens: Element[]): IToken[] {
        const tokens: IToken[] = [];
        let hasNearestRounding = false;
        let roundingBase = 10;

        for (let i = 0; i < tapTokens.length; i++) {
            const token = tapTokens[i];
            if (!token) continue;

            // Skip disabled tokens
            if (token.getAttribute('aria-disabled') === 'true') {
                this.log('token', i, 'is disabled, skipping');
                continue;
            }

            // Check for "Nearest X" label
            const nearestLabel = token.querySelector('._27M4R');
            if (nearestLabel) {
                const labelText = nearestLabel.textContent ?? '';
                this.log('token', i, 'has Nearest label:', labelText);
                const nearestMatch = labelText.match(/Nearest\s*(\d+)/i);
                if (nearestMatch?.[1]) {
                    hasNearestRounding = true;
                    roundingBase = parseInt(nearestMatch[1], 10);

                    const tokenData = this.extractRoundingToken(
                        token,
                        i,
                        roundingBase,
                    );
                    if (tokenData) {
                        this.log('token', i, 'extracted rounding:', tokenData.rawValue);
                        tokens.push(tokenData);
                        continue;
                    } else {
                        this.log('token', i, 'failed to extract rounding value');
                    }
                }
            }

            // Check for iframe with block diagram or pie chart
            const iframe = token.querySelector<HTMLIFrameElement>(
                'iframe[title="Math Web Element"]',
            );
            if (iframe && !nearestLabel) {
                const srcdoc = iframe.getAttribute('srcdoc');
                if (srcdoc?.includes('<svg')) {
                    // First check for block diagram (has rect elements)
                    if (isBlockDiagram(srcdoc)) {
                        const blockCount = extractBlockDiagramValue(srcdoc);
                        if (blockCount !== null) {
                            this.log('token', i, 'extracted block diagram:', blockCount);
                            tokens.push({
                                index: i,
                                element: token,
                                rawValue: `${blockCount} blocks`,
                                numericValue: blockCount,
                                isBlockDiagram: true,
                            });
                            continue;
                        }
                    }

                    // Then check for pie chart
                    const fraction = extractPieChartFraction(srcdoc);
                    if (fraction) {
                        this.log('token', i, 'extracted pie chart:', fraction.value);
                        tokens.push({
                            index: i,
                            element: token,
                            rawValue: `${fraction.numerator}/${fraction.denominator} (pie)`,
                            numericValue: fraction.value,
                            isPieChart: true,
                        });
                        continue;
                    }
                }
            }

            // Extract KaTeX value
            const value = extractKatexValue(token);
            if (value) {
                // Check if this is a list of factors (e.g., "1, 4, 5, 10" or "1,4,5,10")
                const hasFactorsLabel = token.textContent?.toLowerCase().includes('factor') ?? false;
                const factorsMatch = value.match(/^[\d\s,]+$/);
                const hasMultipleCommas = (value.match(/,/g) ?? []).length >= 1;

                if ((factorsMatch && hasMultipleCommas) || hasFactorsLabel) {
                    // Parse the factors list
                    const factors = value.split(',')
                        .map(s => {
                            const num = parseInt(s.trim(), 10);
                            return Number.isNaN(num) ? null : num;
                        })
                        .filter((n): n is number => n !== null);

                    if (factors.length > 1) {
                        this.log('token', i, 'FACTORS LIST detected:', factors.join(', '));
                        tokens.push({
                            index: i,
                            element: token,
                            rawValue: value,
                            numericValue: null,
                            isFactorsList: true,
                            factors,
                        });
                        continue;
                    }
                }

                const evaluated = evaluateMathExpression(value);
                const isCompound = this.isCompoundExpression(value);

                this.log('token', i, 'extracted KaTeX:', value, '=', evaluated);
                tokens.push({
                    index: i,
                    element: token,
                    rawValue: value,
                    numericValue: evaluated,
                    isExpression: isCompound,
                    isPieChart: false,
                });
            } else {
                this.log('token', i, 'failed to extract any value');
            }
        }

        // Store for use in findPairs
        this.hasNearestRounding = hasNearestRounding;
        this.roundingBase = roundingBase;

        return tokens;
    }

    private hasNearestRounding = false;
    private roundingBase = 10;

    private extractRoundingToken(
        token: Element,
        index: number,
        roundingBase: number,
    ): IToken | null {
        // Check for block diagram first
        const iframe = token.querySelector<HTMLIFrameElement>(
            'iframe[title="Math Web Element"]',
        );
        if (iframe) {
            const srcdoc = iframe.getAttribute('srcdoc');
            if (srcdoc) {
                const blockCount = extractBlockDiagramValue(srcdoc);
                if (blockCount !== null) {
                    return {
                        index,
                        element: token,
                        rawValue: `${blockCount} blocks`,
                        numericValue: blockCount,
                        isBlockDiagram: true,
                        isRoundingTarget: true,
                        roundingBase,
                    };
                }
            }
        }

        // Otherwise KaTeX number
        const value = extractKatexValue(token);
        if (value) {
            const evaluated = evaluateMathExpression(value);
            return {
                index,
                element: token,
                rawValue: value,
                numericValue: evaluated,
                isBlockDiagram: false,
                isRoundingTarget: true,
                roundingBase,
            };
        }

        return null;
    }

    private isCompoundExpression(value: string): boolean {
        return (
            value.includes('+') ||
            value.includes('*') ||
            /\)\s*-/.test(value) ||
            /\d\s*-\s*\(/.test(value)
        );
    }

    private findPairs(
        tokens: IToken[],
    ): { first: IToken; second: IToken }[] {
        const pairs: { first: IToken; second: IToken }[] = [];
        const usedIndices = new Set<number>();

        const pieCharts = tokens.filter(t => t.isPieChart);
        const blockDiagrams = tokens.filter(t => t.isBlockDiagram && !t.isRoundingTarget);
        const roundingTargets = tokens.filter(t => t.isRoundingTarget);
        const factorsLists = tokens.filter(t => t.isFactorsList);
        const numbers = tokens.filter(
            t => !t.isPieChart && !t.isBlockDiagram && !t.isRoundingTarget && !t.isFactorsList,
        );

        this.log(
            'blockDiagrams:', blockDiagrams.length,
            'pieCharts:', pieCharts.length,
            'roundingTargets:', roundingTargets.length,
            'factorsLists:', factorsLists.length,
            'numbers:', numbers.length,
        );

        // MODE 1: Rounding matching
        if (this.hasNearestRounding && roundingTargets.length > 0) {
            this.matchRounding(tokens, roundingTargets, pairs, usedIndices);
        }
        // MODE 2: Block diagram matching (blocks to numbers with same value)
        else if (blockDiagrams.length > 0 && numbers.length > 0) {
            this.matchBlockDiagrams(blockDiagrams, numbers, pairs, usedIndices);
        }
        // MODE 3: Factors matching (numbers to their factors lists)
        else if (factorsLists.length > 0 && numbers.length > 0) {
            this.matchFactors(factorsLists, numbers, pairs, usedIndices);
        }
        // MODE 4: Pie chart matching
        else if (pieCharts.length > 0 && numbers.length > 0) {
            this.matchPieCharts(pieCharts, numbers, pairs, usedIndices);
        }
        // MODE 5: Expression matching
        else {
            this.matchExpressions(tokens, pairs, usedIndices);
        }

        return pairs;
    }

    private matchRounding(
        tokens: IToken[],
        roundingTargets: IToken[],
        pairs: { first: IToken; second: IToken }[],
        usedIndices: Set<number>,
    ): void {
        const numbers = tokens.filter(
            t => !t.isPieChart && !t.isBlockDiagram && !t.isRoundingTarget,
        );

        for (const num of numbers) {
            if (usedIndices.has(num.index) || num.numericValue === null) continue;

            const rounded = roundToNearest(num.numericValue, this.roundingBase);

            for (const target of roundingTargets) {
                if (usedIndices.has(target.index)) continue;

                if (target.numericValue === rounded) {
                    pairs.push({ first: num, second: target });
                    usedIndices.add(num.index);
                    usedIndices.add(target.index);
                    this.log(
                        'found rounding pair:',
                        num.rawValue,
                        '→',
                        rounded,
                    );
                    break;
                }
            }
        }
    }

    private matchBlockDiagrams(
        blockDiagrams: IToken[],
        numbers: IToken[],
        pairs: { first: IToken; second: IToken }[],
        usedIndices: Set<number>,
    ): void {
        for (const block of blockDiagrams) {
            if (usedIndices.has(block.index) || block.numericValue === null) continue;

            for (const num of numbers) {
                if (usedIndices.has(num.index) || num.numericValue === null) {
                    continue;
                }

                if (Math.abs(block.numericValue - num.numericValue) < 0.0001) {
                    pairs.push({ first: block, second: num });
                    usedIndices.add(block.index);
                    usedIndices.add(num.index);
                    this.log('found block diagram pair:', block.rawValue, '=', num.rawValue);
                    break;
                }
            }
        }
    }

    private matchFactors(
        factorsLists: IToken[],
        numbers: IToken[],
        pairs: { first: IToken; second: IToken }[],
        usedIndices: Set<number>,
    ): void {
        this.log('using factors matching mode');

        // Helper function to check if all numbers in a list are factors of a given number
        const areAllFactors = (factors: number[], number: number): boolean => {
            if (number <= 0) return false;
            return factors.every(factor => {
                if (factor <= 0 || factor > number) return false;
                return number % factor === 0;
            });
        };

        for (const num of numbers) {
            if (usedIndices.has(num.index)) continue;
            if (num.numericValue === null || Number.isNaN(num.numericValue)) continue;

            // Find matching factors list where all factors divide the number
            for (const factorsList of factorsLists) {
                if (usedIndices.has(factorsList.index)) continue;
                if (!factorsList.factors) continue;

                if (areAllFactors(factorsList.factors, num.numericValue)) {
                    pairs.push({ first: num, second: factorsList });
                    usedIndices.add(num.index);
                    usedIndices.add(factorsList.index);
                    this.log(
                        'found factors pair:',
                        num.rawValue,
                        '↔',
                        factorsList.rawValue,
                        '(factors:',
                        factorsList.factors.join(', '),
                        ')',
                    );
                    break;
                }
            }
        }
    }

    private matchPieCharts(
        pieCharts: IToken[],
        numbers: IToken[],
        pairs: { first: IToken; second: IToken }[],
        usedIndices: Set<number>,
    ): void {
        for (const pie of pieCharts) {
            if (pie.numericValue === null) continue;

            for (const frac of numbers) {
                if (usedIndices.has(frac.index) || frac.numericValue === null) {
                    continue;
                }

                if (Math.abs(pie.numericValue - frac.numericValue) < 0.0001) {
                    pairs.push({ first: pie, second: frac });
                    usedIndices.add(frac.index);
                    this.log('found pie chart pair:', pie.rawValue, '=', frac.rawValue);
                    break;
                }
            }
        }
    }

    private matchExpressions(
        tokens: IToken[],
        pairs: { first: IToken; second: IToken }[],
        usedIndices: Set<number>,
    ): void {
        const expressions = tokens.filter(t => t.isExpression && !t.isRoundingTarget);
        const simpleFractions = tokens.filter(
            t => !t.isExpression && !t.isRoundingTarget && !t.isPieChart && !t.isBlockDiagram,
        );

        if (expressions.length > 0 && simpleFractions.length > 0) {
            for (const expr of expressions) {
                if (expr.numericValue === null) continue;

                for (const frac of simpleFractions) {
                    if (usedIndices.has(frac.index) || frac.numericValue === null) {
                        continue;
                    }

                    if (Math.abs(expr.numericValue - frac.numericValue) < 0.0001) {
                        pairs.push({ first: expr, second: frac });
                        usedIndices.add(frac.index);
                        this.log('found expression pair:', expr.rawValue, '=', frac.rawValue);
                        break;
                    }
                }
            }
        } else {
            // Fallback: match any tokens with same numeric value
            this.matchFallback(tokens, pairs, usedIndices);
        }
    }

    private matchFallback(
        tokens: IToken[],
        pairs: { first: IToken; second: IToken }[],
        usedIndices: Set<number>,
    ): void {
        const fallbackTokens = tokens.filter(t => !t.isRoundingTarget);

        for (let i = 0; i < fallbackTokens.length; i++) {
            const t1 = fallbackTokens[i];
            if (!t1 || usedIndices.has(t1.index) || t1.numericValue === null) {
                continue;
            }

            for (let j = i + 1; j < fallbackTokens.length; j++) {
                const t2 = fallbackTokens[j];
                if (!t2 || usedIndices.has(t2.index) || t2.numericValue === null) {
                    continue;
                }

                if (
                    Math.abs(t1.numericValue - t2.numericValue) < 0.0001 &&
                    t1.rawValue !== t2.rawValue
                ) {
                    pairs.push({ first: t1, second: t2 });
                    usedIndices.add(t1.index);
                    usedIndices.add(t2.index);
                    this.log('found fallback pair:', t1.rawValue, '=', t2.rawValue);
                    break;
                }
            }
        }
    }
}
