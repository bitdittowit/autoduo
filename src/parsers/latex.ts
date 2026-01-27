/**
 * Утилиты для работы с LaTeX разметкой
 */

import { logger } from '../utils/logger';

/**
 * Извлекает содержимое из LaTeX команды с вложенными скобками
 * @param str - исходная строка
 * @param command - LaTeX команда (например, '\\mathbf')
 * @returns строка с удалённой командой и её скобками
 *
 * @example
 * extractLatexContent('\\mathbf{42}', '\\mathbf') // '42'
 * extractLatexContent('\\frac{1}{2}', '\\frac') // '1}{2}' (только первые скобки)
 */
export function extractLatexContent(str: string, command: string): string {
    const cmdIndex = str.indexOf(command);
    if (cmdIndex === -1) return str;

    const startBrace = str.indexOf('{', cmdIndex + command.length);
    if (startBrace === -1) return str;

    let depth = 1;
    let endBrace = startBrace + 1;
    while (depth > 0 && endBrace < str.length) {
        if (str[endBrace] === '{') depth++;
        else if (str[endBrace] === '}') depth--;
        endBrace++;
    }

    const content = str.substring(startBrace + 1, endBrace - 1);
    return str.substring(0, cmdIndex) + content + str.substring(endBrace);
}

/**
 * Удаляет все LaTeX обёртки из строки
 * @param str - исходная строка с LaTeX
 * @returns очищенная строка
 */
export function cleanLatexWrappers(str: string): string {
    let result = str;

    const wrappers = ['\\mathbf', '\\textbf', '\\text', '\\mbox'];

    for (const wrapper of wrappers) {
        while (result.includes(wrapper + '{')) {
            result = extractLatexContent(result, wrapper);
        }
    }

    return result;
}

/**
 * Конвертирует LaTeX операторы в стандартные символы
 * @param str - строка с LaTeX операторами
 * @returns строка со стандартными операторами
 */
export function convertLatexOperators(str: string): string {
    return str
        .replace(/\\cdot/g, '*')      // \cdot -> *
        .replace(/\\times/g, '*')     // \times -> *
        .replace(/\\div/g, '/')       // \div -> /
        .replace(/\\pm/g, '±')        // \pm -> ±
        .replace(/×/g, '*')           // Unicode multiplication
        .replace(/÷/g, '/')           // Unicode division
        .replace(/−/g, '-')           // Unicode minus
        .replace(/⋅/g, '*');          // Unicode middle dot
}

/**
 * Конвертирует \frac{a}{b} в (a/b)
 * @param str - строка с LaTeX дробями
 * @returns строка с обычными дробями
 */
export function convertLatexFractions(str: string): string {
    let result = str;

    while (result.includes('\\frac{')) {
        const fracMatch = result.match(/\\frac\{/);
        if (fracMatch?.index === undefined) break;

        const fracStart = fracMatch.index;

        // Find numerator
        const numStart = fracStart + 6; // after \frac{
        let depth = 1;
        let numEnd = numStart;
        while (depth > 0 && numEnd < result.length) {
            if (result[numEnd] === '{') depth++;
            else if (result[numEnd] === '}') depth--;
            numEnd++;
        }
        const numerator = result.substring(numStart, numEnd - 1);

        // Find denominator
        const denomStart = numEnd + 1; // after }{
        depth = 1;
        let denomEnd = denomStart;
        while (depth > 0 && denomEnd < result.length) {
            if (result[denomEnd] === '{') depth++;
            else if (result[denomEnd] === '}') depth--;
            denomEnd++;
        }
        const denominator = result.substring(denomStart, denomEnd - 1);

        const replacement = '(' + numerator + '/' + denominator + ')';
        result = result.substring(0, fracStart) + replacement + result.substring(denomEnd);
    }

    return result;
}

/**
 * Полная очистка LaTeX строки для вычисления
 * @param str - LaTeX строка
 * @returns очищенная строка готовая для eval
 */
export function cleanLatexForEval(str: string): string {
    let result = str;

    result = cleanLatexWrappers(result);
    result = convertLatexOperators(result);
    result = convertLatexFractions(result);
    result = result.replace(/\s+/g, ''); // Remove whitespace

    logger.debug('cleanLatexForEval:', str, '->', result);

    return result;
}
