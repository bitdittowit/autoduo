import { describe, it, expect } from 'vitest';
import {
    delay,
    isNumber,
    safeParseInt,
    safeParseFloat,
    normalizeWhitespace,
    isDigitsOnly,
    clamp,
} from '../../src/utils/helpers';

describe('helpers', () => {
    describe('delay', () => {
        it('should delay execution', async () => {
            const start = Date.now();
            await delay(50);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
        });
    });

    describe('isNumber', () => {
        it('should return true for valid numbers', () => {
            expect(isNumber(0)).toBe(true);
            expect(isNumber(42)).toBe(true);
            expect(isNumber(-42)).toBe(true);
            expect(isNumber(3.14)).toBe(true);
        });

        it('should return false for NaN and Infinity', () => {
            expect(isNumber(NaN)).toBe(false);
            expect(isNumber(Infinity)).toBe(false);
            expect(isNumber(-Infinity)).toBe(false);
        });

        it('should return false for non-numbers', () => {
            expect(isNumber('42')).toBe(false);
            expect(isNumber(null)).toBe(false);
            expect(isNumber(undefined)).toBe(false);
        });
    });

    describe('safeParseInt', () => {
        it('should parse valid integers', () => {
            expect(safeParseInt('42')).toBe(42);
            expect(safeParseInt('-42')).toBe(-42);
            expect(safeParseInt('0')).toBe(0);
        });

        it('should return null for invalid integers', () => {
            expect(safeParseInt('abc')).toBeNull();
            expect(safeParseInt('')).toBeNull();
            expect(safeParseInt('3.14')).toBe(3); // parseInt truncates
        });
    });

    describe('safeParseFloat', () => {
        it('should parse valid floats', () => {
            expect(safeParseFloat('3.14')).toBe(3.14);
            expect(safeParseFloat('-3.14')).toBe(-3.14);
            expect(safeParseFloat('42')).toBe(42);
        });

        it('should return null for invalid floats', () => {
            expect(safeParseFloat('abc')).toBeNull();
            expect(safeParseFloat('')).toBeNull();
        });
    });

    describe('normalizeWhitespace', () => {
        it('should normalize whitespace', () => {
            expect(normalizeWhitespace('  hello   world  ')).toBe('hello world');
            expect(normalizeWhitespace('a\n\nb\tc')).toBe('a b c');
        });

        it('should handle empty strings', () => {
            expect(normalizeWhitespace('')).toBe('');
            expect(normalizeWhitespace('   ')).toBe('');
        });
    });

    describe('isDigitsOnly', () => {
        it('should return true for digit-only strings', () => {
            expect(isDigitsOnly('123')).toBe(true);
            expect(isDigitsOnly('0')).toBe(true);
            expect(isDigitsOnly('999999')).toBe(true);
        });

        it('should return false for non-digit strings', () => {
            expect(isDigitsOnly('12.3')).toBe(false);
            expect(isDigitsOnly('-123')).toBe(false);
            expect(isDigitsOnly('12a3')).toBe(false);
            expect(isDigitsOnly('')).toBe(false);
        });
    });

    describe('clamp', () => {
        it('should clamp values within range', () => {
            expect(clamp(5, 0, 10)).toBe(5);
            expect(clamp(0, 0, 10)).toBe(0);
            expect(clamp(10, 0, 10)).toBe(10);
        });

        it('should clamp values below min', () => {
            expect(clamp(-5, 0, 10)).toBe(0);
        });

        it('should clamp values above max', () => {
            expect(clamp(15, 0, 10)).toBe(10);
        });
    });
});
