/**
 * Парсер для KaTeX элементов
 */

import { logger } from '../utils/logger';
import { cleanLatexWrappers, convertLatexOperators, convertLatexFractions } from './latex';

/**
 * Извлекает значение из KaTeX элемента
 *
 * Поддерживает три метода извлечения:
 * 1. Из тега <annotation> (содержит сырой LaTeX)
 * 2. Из .katex-html (видимая часть)
 * 3. Из textContent (fallback)
 *
 * @param element - DOM элемент с KaTeX
 * @returns очищенное значение или null
 *
 * @example
 * // HTML: <span class="katex"><annotation>\\mathbf{42}</annotation></span>
 * extractKatexValue(element) // '42'
 */
export function extractKatexValue(element: Element | null): string | null {
    if (!element) {
        logger.debug('extractKatexValue: element is null');
        return null;
    }

    logger.debug('extractKatexValue: processing element');

    // Method 1: Try to get from annotation tag (contains raw LaTeX)
    const annotation = element.querySelector('annotation');
    if (annotation?.textContent) {
        let raw = annotation.textContent;
        logger.debug('extractKatexValue: found annotation', raw);

        // Clean LaTeX markup
        raw = cleanLatexWrappers(raw);

        // Convert LaTeX operators to standard symbols
        raw = convertLatexOperators(raw);

        // Convert \frac to (a/b)
        raw = convertLatexFractions(raw);

        // Remove whitespace
        raw = raw.replace(/\s+/g, '');

        logger.debug('extractKatexValue: cleaned annotation value', raw);
        return raw;
    }

    // Method 2: Get from katex-html (visible part)
    const katexHtml = element.querySelector('.katex-html');
    if (katexHtml?.textContent) {
        const text = katexHtml.textContent.trim();
        logger.debug('extractKatexValue: found katex-html text', text);
        return text;
    }

    // Method 3: Just get text content
    const text = element.textContent?.trim() ?? null;
    logger.debug('extractKatexValue: fallback to textContent', text);
    return text;
}

/**
 * Извлекает числовое значение из KaTeX элемента
 *
 * @param element - DOM элемент с KaTeX
 * @returns число или null
 */
export function extractKatexNumber(element: Element | null): number | null {
    const value = extractKatexValue(element);
    if (value === null) return null;

    // Try to parse as integer first
    const intValue = parseInt(value, 10);
    if (!Number.isNaN(intValue) && String(intValue) === value) {
        return intValue;
    }

    // Try to parse as float
    const floatValue = parseFloat(value);
    if (!Number.isNaN(floatValue)) {
        return floatValue;
    }

    return null;
}

/**
 * Извлекает текст из annotation элемента в контейнере
 *
 * @param container - контейнер для поиска
 * @returns текст annotation или null
 */
export function extractAnnotationText(container: Element): string | null {
    const annotation = container.querySelector('annotation');
    return annotation?.textContent?.trim() ?? null;
}

/**
 * Очищает LaTeX текст annotation от обёрток
 *
 * @param text - текст из annotation
 * @returns очищенный текст
 */
export function cleanAnnotationText(text: string): string {
    let cleaned = text;
    cleaned = cleanLatexWrappers(cleaned);
    cleaned = cleaned.replace(/\\htmlClass\{[^}]*\}\{([^}]+)\}/g, '$1');
    return cleaned.trim();
}
