/**
 * Парсер для круговых диаграмм (pie charts)
 */

import { logger } from '../utils/logger';
import type { ISimplifiedFraction } from '../types';

/**
 * Извлекает часть SVG для анализа (предпочитает dark-img)
 */
function extractSvgContent(svgContent: string): string {
    // Try to extract just the dark mode SVG
    const darkImgMatch = svgContent.match(/<span class="dark-img">([\s\S]*?)<\/span>/);
    if (darkImgMatch?.[1]) {
        logger.debug('extractPieChartFraction: using dark mode SVG');
        return darkImgMatch[1];
    }

    // Fallback: try light mode
    const lightImgMatch = svgContent.match(/<span class="light-img">([\s\S]*?)<\/span>/);
    if (lightImgMatch?.[1]) {
        logger.debug('extractPieChartFraction: using light mode SVG');
        return lightImgMatch[1];
    }

    return svgContent;
}

/**
 * Метод 1: Подсчёт цветных/нецветных секторов
 */
function extractByColoredSectors(svgContent: string): ISimplifiedFraction | null {
    // Count colored sectors (blue)
    const coloredPattern = /<path[^>]*fill="(#49C0F8|#1CB0F6)"[^>]*>/g;
    const coloredMatches = svgContent.match(coloredPattern) ?? [];

    // Count uncolored sectors (background)
    const uncoloredPattern = /<path[^>]*fill="(#131F24|#FFFFFF)"[^>]*>/g;
    const uncoloredMatches = svgContent.match(uncoloredPattern) ?? [];

    // Filter to only count paths that look like pie sectors (have stroke attribute)
    const coloredCount = coloredMatches.filter(m => m.includes('stroke=')).length;
    const uncoloredCount = uncoloredMatches.filter(m => m.includes('stroke=')).length;
    const totalCount = coloredCount + uncoloredCount;

    if (totalCount > 0) {
        logger.debug('extractPieChartFraction: (method 1) colored =', coloredCount, ', total =', totalCount);
        return {
            numerator: coloredCount,
            denominator: totalCount,
            value: coloredCount / totalCount,
        };
    }

    return null;
}

/**
 * Метод 2: Анализ путей с кругом (для "Show this another way")
 */
function extractByCircleAndPaths(svgContent: string): ISimplifiedFraction | null {
    const hasCircle = svgContent.includes('<circle');
    if (!hasCircle) return null;

    logger.debug('extractPieChartFraction: detected circle-based pie chart');

    // Count all path elements with stroke
    const allPathsPattern = /<path[^>]*stroke[^>]*>/g;
    const allPaths = svgContent.match(allPathsPattern) ?? [];
    const pathCount = allPaths.length;

    logger.debug('extractPieChartFraction: found', pathCount, 'path elements');

    if (pathCount === 0) {
        // Circle with no paths = full circle = 1
        return { numerator: 1, denominator: 1, value: 1.0 };
    }

    // Extract path data for analysis
    const pathDataMatch = svgContent.match(/<path[^>]*d="([^"]+)"[^>]*>/);
    const pathData = pathDataMatch?.[1];

    // Look for paths that go to center (L100 100)
    const sectorPaths = allPaths.filter(p =>
        p.includes('L100 100') || p.includes('L 100 100') || p.includes('100L100'),
    );

    if (sectorPaths.length > 0) {
        const numSectors = sectorPaths.length;

        if (numSectors === 1 && pathData) {
            // Detect quarter-circle by path coordinates
            if (pathData.includes('198') || pathData.includes('2 ') ||
                pathData.includes(' 2C') || pathData.includes(' 2V') ||
                pathData.includes('V2') || pathData.includes('V100')) {
                logger.debug('extractPieChartFraction: (method 2) detected 1/4 sector');
                return { numerator: 1, denominator: 4, value: 0.25 };
            }

            // Check for half-circle
            if (pathData.includes('180') || (pathData.match(/100/g)?.length ?? 0) >= 4) {
                logger.debug('extractPieChartFraction: (method 2) detected 1/2 sector');
                return { numerator: 1, denominator: 2, value: 0.5 };
            }
        }

        // Fallback: estimate based on sector count
        logger.debug('extractPieChartFraction: (method 2) fallback - sectors =', numSectors);
        return { numerator: numSectors, denominator: 4, value: numSectors / 4 };
    }

    // Last resort: single path with circle = 1/4
    if (pathCount === 1) {
        logger.debug('extractPieChartFraction: (method 2) single path with circle - assuming 1/4');
        return { numerator: 1, denominator: 4, value: 0.25 };
    }

    return null;
}

/**
 * Метод 3: Анализ секторных путей (pie chart без <circle> элемента)
 * Используется для круговых диаграмм, нарисованных только path-элементами
 */
function extractBySectorPaths(svgContent: string): ISimplifiedFraction | null {
    // Look for paths that form pie sectors (go to center point, typically L100 100)
    const allPathsPattern = /<path[^>]*d="[^"]*"[^>]*>/g;
    const allPaths = svgContent.match(allPathsPattern) ?? [];

    // Filter paths that contain "L100 100" or "L 100 100" (lines to center)
    const sectorPaths = allPaths.filter(p => {
        const dMatch = p.match(/d="([^"]+)"/);
        if (!dMatch?.[1]) return false;
        const d = dMatch[1];
        return /L\s*100\s+100/.test(d);
    });

    if (sectorPaths.length === 0) return null;

    // Count colored (filled) sectors vs total sectors
    const coloredSectors = sectorPaths.filter(p =>
        /#(?:49C0F8|1CB0F6)/i.test(p), // Duolingo blue colors
    );

    const totalSectors = sectorPaths.length;
    const numerator = coloredSectors.length;

    if (totalSectors > 0 && numerator > 0) {
        logger.debug('extractPieChartFraction: (method 3) sector paths - colored:', numerator, 'total:', totalSectors);
        return {
            numerator,
            denominator: totalSectors,
            value: numerator / totalSectors,
        };
    }

    return null;
}

/**
 * Извлекает дробь из круговой диаграммы SVG
 *
 * @param svgContent - содержимое SVG или srcdoc iframe
 * @returns объект с дробью или null
 *
 * @example
 * // Диаграмма с 3 закрашенными секторами из 4
 * extractPieChartFraction(svg) // { numerator: 3, denominator: 4, value: 0.75 }
 */
export function extractPieChartFraction(svgContent: string | null): ISimplifiedFraction | null {
    if (!svgContent) return null;

    const svg = extractSvgContent(svgContent);

    // Try method 1: colored/uncolored sectors
    const result1 = extractByColoredSectors(svg);
    if (result1) return result1;

    // Try method 2: circle + paths analysis
    const result2 = extractByCircleAndPaths(svg);
    if (result2) return result2;

    // Try method 3: sector paths without circle (pie chart drawn with paths only)
    const result3 = extractBySectorPaths(svg);
    if (result3) return result3;

    logger.debug('extractPieChartFraction: no pie sectors found');
    return null;
}

/**
 * Проверяет, содержит ли SVG круговую диаграмму
 */
export function isPieChart(svgContent: string): boolean {
    if (!svgContent) return false;

    // First, exclude block diagrams (they have rect elements)
    const hasRects = /<rect[^>]*>/i.test(svgContent);
    if (hasRects) {
        // Block diagrams and grids have rects, pie charts don't
        return false;
    }

    // Pie charts typically have colored paths or circles
    const hasColoredPaths = /#(?:49C0F8|1CB0F6)/i.test(svgContent);
    const hasCircle = /<circle/i.test(svgContent);
    const hasPaths = /<path[^>]*>/i.test(svgContent);

    // Check for sector paths (paths with L100 100 - lines to center)
    const hasSectorPaths = /L\s*100\s+100/.test(svgContent);

    return (hasColoredPaths && hasPaths) || hasCircle || (hasSectorPaths && hasColoredPaths);
}
