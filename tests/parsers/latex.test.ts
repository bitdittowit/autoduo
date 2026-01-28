import { describe, it, expect } from 'vitest';
import {
    extractLatexContent,
    cleanLatexWrappers,
    convertLatexOperators,
    convertLatexFractions,
    cleanLatexForEval,
} from '../../src/parsers/latex';

describe('latex utilities', () => {
    describe('extractLatexContent', () => {
        it('should extract content from \\mathbf{}', () => {
            expect(extractLatexContent('\\mathbf{42}', '\\mathbf')).toBe('42');
            expect(extractLatexContent('\\mathbf{hello}', '\\mathbf')).toBe('hello');
        });

        it('should handle nested braces', () => {
            expect(extractLatexContent('\\mathbf{a{b}c}', '\\mathbf')).toBe('a{b}c');
        });

        it('should return original string if command not found', () => {
            expect(extractLatexContent('no command here', '\\mathbf')).toBe('no command here');
        });

        it('should handle multiple commands (first only)', () => {
            const result = extractLatexContent('\\mathbf{a} + \\mathbf{b}', '\\mathbf');
            expect(result).toBe('a + \\mathbf{b}');
        });
    });

    describe('cleanLatexWrappers', () => {
        it('should remove \\mathbf wrapper', () => {
            expect(cleanLatexWrappers('\\mathbf{42}')).toBe('42');
        });

        it('should remove \\textbf wrapper', () => {
            expect(cleanLatexWrappers('\\textbf{hello}')).toBe('hello');
        });

        it('should remove multiple wrappers', () => {
            expect(cleanLatexWrappers('\\mathbf{\\textbf{42}}')).toBe('42');
        });

        it('should remove all occurrences', () => {
            expect(cleanLatexWrappers('\\mathbf{a} + \\mathbf{b}')).toBe('a + b');
        });

        it('should handle \\text and \\mbox', () => {
            expect(cleanLatexWrappers('\\text{hello}')).toBe('hello');
            expect(cleanLatexWrappers('\\mbox{world}')).toBe('world');
        });
    });

    describe('convertLatexOperators', () => {
        it('should convert \\cdot to *', () => {
            expect(convertLatexOperators('2 \\cdot 3')).toBe('2 * 3');
        });

        it('should convert \\times to *', () => {
            expect(convertLatexOperators('2 \\times 3')).toBe('2 * 3');
        });

        it('should convert \\div to /', () => {
            expect(convertLatexOperators('6 \\div 2')).toBe('6 / 2');
        });

        it('should convert Unicode operators', () => {
            expect(convertLatexOperators('2 × 3')).toBe('2 * 3');
            expect(convertLatexOperators('6 ÷ 2')).toBe('6 / 2');
            expect(convertLatexOperators('5 − 2')).toBe('5 - 2');
        });

        it('should convert \\neg before number', () => {
            expect(convertLatexOperators('\\neg 29')).toBe('-29');
            expect(convertLatexOperators('\\neg 5')).toBe('-5');
        });

        it('should convert \\neg with parentheses', () => {
            expect(convertLatexOperators('\\neg(-0.55)')).toBe('-(-0.55)');
            expect(convertLatexOperators('\\neg(-2.6)')).toBe('-(-2.6)');
            expect(convertLatexOperators('\\neg(-2.45)')).toBe('-(-2.45)');
            expect(convertLatexOperators('\\neg(5)')).toBe('-(5)');
        });

        it('should convert \\neg with \\left( and \\right)', () => {
            expect(convertLatexOperators('\\neg\\left(-0.55\\right)')).toBe('-(-0.55)');
            expect(convertLatexOperators('\\neg\\left(5\\right)')).toBe('-(5)');
        });
    });

    describe('convertLatexFractions', () => {
        it('should convert simple fractions', () => {
            expect(convertLatexFractions('\\frac{1}{2}')).toBe('(1/2)');
            expect(convertLatexFractions('\\frac{3}{4}')).toBe('(3/4)');
        });

        it('should convert multiple fractions', () => {
            expect(convertLatexFractions('\\frac{1}{2} + \\frac{1}{4}')).toBe('(1/2) + (1/4)');
        });

        it('should handle nested content', () => {
            expect(convertLatexFractions('\\frac{10}{20}')).toBe('(10/20)');
        });
    });

    describe('cleanLatexForEval', () => {
        it('should fully clean LaTeX for evaluation', () => {
            expect(cleanLatexForEval('\\mathbf{2} \\cdot \\mathbf{3}')).toBe('2*3');
            expect(cleanLatexForEval('\\frac{1}{2} + \\frac{1}{2}')).toBe('(1/2)+(1/2)');
        });

        it('should remove whitespace', () => {
            expect(cleanLatexForEval('  2  +  3  ')).toBe('2+3');
        });
    });
});
