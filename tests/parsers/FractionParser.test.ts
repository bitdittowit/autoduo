import { describe, it, expect } from 'vitest';
import {
    parseFractionExpression,
    parseSimpleFraction,
    isFractionString,
} from '../../src/parsers/FractionParser';

describe('FractionParser', () => {
    describe('parseFractionExpression', () => {
        it('should parse \\frac{a}{b} format', () => {
            const result = parseFractionExpression('\\frac{1}{2}');
            expect(result).toEqual({ numerator: 1, denominator: 2, value: 0.5 });
        });

        it('should parse \\frac{a}{b} with larger numbers', () => {
            const result = parseFractionExpression('\\frac{3}{4}');
            expect(result).toEqual({ numerator: 3, denominator: 4, value: 0.75 });
        });

        it('should parse simple a/b format', () => {
            const result = parseFractionExpression('3/4');
            expect(result).toEqual({ numerator: 3, denominator: 4, value: 0.75 });
        });

        it('should handle \\mathbf wrapper', () => {
            const result = parseFractionExpression('\\mathbf{\\frac{1}{2}}');
            expect(result).toEqual({ numerator: 1, denominator: 2, value: 0.5 });
        });

        it('should parse compound expressions', () => {
            const result = parseFractionExpression('\\frac{1}{4}+\\frac{1}{4}');
            expect(result?.value).toBeCloseTo(0.5);
            expect(result?.numerator).toBe(1);
            expect(result?.denominator).toBe(2);
        });

        it('should return null for non-fraction strings', () => {
            expect(parseFractionExpression('hello')).toBeNull();
            expect(parseFractionExpression('42')).toBeNull();
        });
    });

    describe('parseSimpleFraction', () => {
        it('should parse simple fractions', () => {
            expect(parseSimpleFraction('1/2')).toEqual({ numerator: 1, denominator: 2 });
            expect(parseSimpleFraction('3/4')).toEqual({ numerator: 3, denominator: 4 });
        });

        it('should handle whitespace', () => {
            expect(parseSimpleFraction(' 1 / 2 ')).toEqual({ numerator: 1, denominator: 2 });
        });

        it('should handle negative numerator', () => {
            expect(parseSimpleFraction('-1/2')).toEqual({ numerator: -1, denominator: 2 });
        });

        it('should return null for invalid input', () => {
            expect(parseSimpleFraction('hello')).toBeNull();
            expect(parseSimpleFraction('1/0')).toBeNull();
            expect(parseSimpleFraction('1')).toBeNull();
        });
    });

    describe('isFractionString', () => {
        it('should return true for simple fractions', () => {
            expect(isFractionString('1/2')).toBe(true);
            expect(isFractionString('3/4')).toBe(true);
            expect(isFractionString(' 1 / 2 ')).toBe(true);
        });

        it('should return true for LaTeX fractions', () => {
            expect(isFractionString('\\frac{1}{2}')).toBe(true);
        });

        it('should return false for non-fractions', () => {
            expect(isFractionString('42')).toBe(false);
            expect(isFractionString('hello')).toBe(false);
        });
    });
});
