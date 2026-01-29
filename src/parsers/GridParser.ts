/**
 * Парсер для сеточных диаграмм (grid diagrams)
 *
 * Сеточные диаграммы показывают прямоугольную сетку ячеек,
 * где некоторые ячейки закрашены для визуализации дробей.
 */

import { logger } from '../utils/logger';
import type { ISimplifiedFraction } from '../types';

/**
 * Извлекает часть SVG для анализа (предпочитает dark-img)
 */
function extractSvgContent(srcdoc: string): string {
    // Prefer dark-img since Duolingo Math often uses dark theme
    const darkImgMatch = srcdoc.match(/<span class="dark-img">([\s\S]*?)<\/span>/);
    if (darkImgMatch?.[1]) {
        logger.debug('extractGridFraction: using dark-img SVG');
        return darkImgMatch[1];
    }

    // Fallback to light-img
    const lightImgMatch = srcdoc.match(/<span class="light-img">([\s\S]*?)<\/span>/);
    if (lightImgMatch?.[1]) {
        logger.debug('extractGridFraction: using light-img SVG');
        return lightImgMatch[1];
    }

    return srcdoc;
}

/**
 * Извлекает дробь из сеточной диаграммы SVG
 *
 * Сеточные диаграммы используются в заданиях для визуализации дробей.
 * Каждая ячейка сетки = 1 единица.
 *
 * @param srcdoc - srcdoc атрибут iframe с SVG
 * @returns объект с дробью или null
 *
 * @example
 * // SVG с сеткой 3x3, где 6 ячеек закрашены
 * extractGridFraction(srcdoc) // { numerator: 6, denominator: 9, value: 0.666... }
 */
export function extractGridFraction(srcdoc: string): ISimplifiedFraction | null {
    if (!srcdoc) return null;

    const svgContent = extractSvgContent(srcdoc);

    // IMPORTANT: Exclude pie charts (they have paths to center L100 100)
    // Pie charts have sector paths, grids don't
    if (/L\s*100\s+100/.test(svgContent)) {
        logger.debug('extractGridFraction: skipping - detected pie chart (L100 100)');
        return null;
    }

    // Count all path elements with fill color (grid cells as paths)
    const allPaths = svgContent.match(/<path[^>]*fill=["'][^"']+["'][^>]*>/gi) ?? [];

    // Count all rect elements with fill color (grid cells as rects)
    const allRects = svgContent.match(/<rect[^>]*fill=["'][^"']+["'][^>]*>/gi) ?? [];

    const totalCells = allPaths.length + allRects.length;

    if (totalCells === 0) {
        logger.debug('extractGridFraction: no grid cells found');
        return null;
    }

    // Count colored (blue) cells
    const coloredPaths = allPaths.filter(p => /#(?:49C0F8|1CB0F6)/i.test(p));
    const coloredRects = allRects.filter(r => /#(?:49C0F8|1CB0F6)/i.test(r));
    const coloredCells = coloredPaths.length + coloredRects.length;

    if (coloredCells === 0) {
        logger.debug('extractGridFraction: no colored cells found');
        return null;
    }

    logger.debug('extractGridFraction: colored =', coloredCells, 'total =', totalCells);

    return {
        numerator: coloredCells,
        denominator: totalCells,
        value: coloredCells / totalCells,
    };
}

/**
 * Проверяет, содержит ли srcdoc сеточную диаграмму
 */
export function isGridDiagram(srcdoc: string): boolean {
    if (!srcdoc) return false;

    const svgContent = extractSvgContent(srcdoc);

    // Exclude pie charts (they have <circle> elements or sector paths with L100 100)
    const hasCircle = svgContent.includes('<circle');
    const hasSectorPaths = /L\s*100\s+100/.test(svgContent);
    if (hasCircle || hasSectorPaths) return false;

    // Grids have rect or path elements with fill colors
    const hasColoredElements = /#(?:49C0F8|1CB0F6)/i.test(svgContent);
    const hasRects = /<rect[^>]*>/i.test(svgContent);
    const hasPaths = /<path[^>]*>/i.test(svgContent);

    // Grids typically have multiple rect or path elements
    const rectCount = (svgContent.match(/<rect[^>]*>/gi) ?? []).length;
    const pathCount = (svgContent.match(/<path[^>]*>/gi) ?? []).length;

    // A grid should have multiple cells (at least 4, typically 9 for 3x3 or more)
    return hasColoredElements && (hasRects || hasPaths) && (rectCount + pathCount >= 4);
}
