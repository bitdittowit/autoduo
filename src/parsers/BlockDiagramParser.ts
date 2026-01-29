/**
 * Парсер для блок-диаграмм (используются в заданиях на округление)
 *
 * Блок-диаграммы показывают столбцы по 10 блоков каждый,
 * используются для визуализации чисел в десятичной системе.
 */

import { logger } from '../utils/logger';

/**
 * Извлекает часть SVG для анализа (предпочитает dark-img)
 */
function extractSvgContent(srcdoc: string): string {
    // Prefer dark-img since Duolingo Math often uses dark theme
    const darkImgMatch = srcdoc.match(/<span class="dark-img">([\s\S]*?)<\/span>/);
    if (darkImgMatch?.[1]) {
        logger.debug('extractBlockDiagramValue: using dark-img SVG');
        return darkImgMatch[1];
    }

    // Fallback to light-img
    const lightImgMatch = srcdoc.match(/<span class="light-img">([\s\S]*?)<\/span>/);
    if (lightImgMatch?.[1]) {
        logger.debug('extractBlockDiagramValue: using light-img SVG');
        return lightImgMatch[1];
    }

    return srcdoc;
}

/**
 * Подсчитывает "сотенные" блоки (структуры с clip-rule="evenodd")
 */
function countHundredBlocks(svgContent: string): number {
    const allPaths = svgContent.match(/<path[^>]*>/gi) ?? [];
    let count = 0;

    // Method 1: Old style hundred blocks with clip-rule="evenodd"
    for (const pathTag of allPaths) {
        const hasClipRule = /clip-rule=["']evenodd["']/i.test(pathTag);
        const hasFillColor = /fill=["']#(?:1CB0F6|49C0F8)["']/i.test(pathTag);
        if (hasClipRule && hasFillColor) {
            count += 100;
        }
    }

    // Method 2: New style hundred blocks with large rounded rect borders
    // These have: <rect height="222" rx="19" ...> or similar (boundaries of 100-block)
    // Typically height ~200-250 and rx (rounded corners) indicates hundred block boundary
    const largeRects = svgContent.match(/<rect[^>]*height=["'](\d+)["'][^>]*rx=["'](\d+)["'][^>]*>/gi) ?? [];
    for (const rectTag of largeRects) {
        const heightMatch = rectTag.match(/height=["'](\d+)["']/);
        const rxMatch = rectTag.match(/rx=["'](\d+)["']/);
        if (heightMatch?.[1] && rxMatch?.[1]) {
            const height = parseInt(heightMatch[1]);
            const rx = parseInt(rxMatch[1]);
            // Large rounded rect with height 200-250 and rx 15-25 indicates hundred block
            if (height >= 200 && height <= 250 && rx >= 15 && rx <= 25) {
                count += 100;
            }
        }
    }

    return count;
}

/**
 * Подсчитывает обычные блоки (rect и простые path без clip-rule)
 * Each column of 10 blocks has: 2 <path> (top/bottom rounded) + 8 <rect> (middle) = 10 total
 * So we count ALL elements (rect + simple path), and each element = 1 block
 */
function countRegularBlocks(svgContent: string): number {
    let count = 0;

    // Count rects with fill color
    const rectPattern = /<rect[^>]*fill=["']#(?:1CB0F6|49C0F8)["'][^>]*>/gi;
    const rectMatches = svgContent.match(rectPattern);
    if (rectMatches) {
        count += rectMatches.length;
    }

    // Count simple paths (without clip-rule) with fill color
    const allPaths = svgContent.match(/<path[^>]*>/gi) ?? [];
    for (const pathTag of allPaths) {
        const hasClipRule = /clip-rule=["']evenodd["']/i.test(pathTag);
        const hasFillColor = /fill=["']#(?:1CB0F6|49C0F8)["']/i.test(pathTag);
        if (!hasClipRule && hasFillColor) {
            count++;
        }
    }

    return count;
}

/**
 * Извлекает значение из блок-диаграммы SVG
 *
 * Блок-диаграммы используются в заданиях "Round to Nearest 10/100".
 * Каждый столбец = 10 блоков. Специальные структуры = 100 блоков.
 *
 * @param srcdoc - srcdoc атрибут iframe с SVG
 * @returns числовое значение (10, 20, 100, 200...) или null
 *
 * @example
 * // SVG с 4 столбцами по 10 блоков
 * extractBlockDiagramValue(srcdoc) // 40
 */
export function extractBlockDiagramValue(srcdoc: string): number | null {
    if (!srcdoc) return null;

    const svgContent = extractSvgContent(srcdoc);

    // IMPORTANT: Exclude pie charts (they have <circle> elements)
    // Pie charts also have colored paths, but they're circles, not block diagrams
    if (svgContent.includes('<circle')) {
        logger.debug('extractBlockDiagramValue: skipping - detected circle (pie chart)');
        return null;
    }

    // Count "hundred block" structures first
    const hundredBlocks = countHundredBlocks(svgContent);
    logger.debug('extractBlockDiagramValue: countHundredBlocks returned', hundredBlocks);
    if (hundredBlocks > 0) {
        logger.debug('extractBlockDiagramValue: found hundred-block structures =', hundredBlocks);
    }

    // Count regular blocks
    // Each column of 10 blocks has: 2 <path> (top/bottom rounded) + 8 <rect> (middle) = 10 total
    // So we count ALL elements (rect + simple path), and each element = 1 block
    const regularBlocks = countRegularBlocks(svgContent);
    logger.debug('extractBlockDiagramValue: countRegularBlocks returned', regularBlocks);

    if (regularBlocks > 0) {
        const total = regularBlocks + hundredBlocks;
        logger.debug('extractBlockDiagramValue: regular =', regularBlocks, '+ hundreds =', hundredBlocks, '=', total);
        return total;
    }

    // Alternative method: count rect elements with specific height
    // Each column has 8 rects with height 14.1755 or 14.1323
    const heightRectMatches = svgContent.match(/<rect[^>]*height=["']14\.1(?:755|323)["'][^>]*>/gi);
    if (heightRectMatches && heightRectMatches.length > 0) {
        // 8 rects per column, each column represents 10
        const columns = Math.round(heightRectMatches.length / 8);
        const total = columns * 10 + hundredBlocks;
        logger.debug('extractBlockDiagramValue: columns =', columns, '+ hundreds =', hundredBlocks, '=', total);
        return total;
    }

    // If only hundred blocks found
    if (hundredBlocks > 0) {
        return hundredBlocks;
    }

    logger.debug('extractBlockDiagramValue: no blocks found');
    return null;
}

/**
 * Проверяет, содержит ли srcdoc блок-диаграмму
 */
export function isBlockDiagram(srcdoc: string): boolean {
    if (!srcdoc) return false;

    // IMPORTANT: Exclude pie charts (they have <circle> elements)
    // Pie charts may have colored paths but they're circles, not block diagrams
    if (srcdoc.includes('<circle')) {
        return false;
    }

    // Block diagrams have rect elements with specific fill colors
    const hasBlockColors = /#(?:1CB0F6|49C0F8)/i.test(srcdoc);
    const hasRects = /<rect[^>]*>/i.test(srcdoc);

    return hasBlockColors && hasRects;
}
