import { describe, it, expect } from 'vitest';
import {
    gcd,
    lcm,
    simplifyFraction,
    simplifyFractionWithValue,
    compareFractions,
    areFractionsEqual,
    addFractions,
    subtractFractions,
    multiplyFractions,
    divideFractions,
} from '../../src/math/fractions';

describe('fractions', () => {
    describe('gcd', () => {
        it('should return GCD of two positive numbers', () => {
            expect(gcd(12, 8)).toBe(4);
            expect(gcd(17, 13)).toBe(1);
            expect(gcd(100, 25)).toBe(25);
            expect(gcd(48, 18)).toBe(6);
        });

        it('should handle zero', () => {
            expect(gcd(0, 5)).toBe(5);
            expect(gcd(5, 0)).toBe(5);
            expect(gcd(0, 0)).toBe(0);
        });

        it('should handle negative numbers', () => {
            expect(gcd(-12, 8)).toBe(4);
            expect(gcd(12, -8)).toBe(4);
            expect(gcd(-12, -8)).toBe(4);
        });

        it('should return same number when one is divisible by other', () => {
            expect(gcd(10, 5)).toBe(5);
            expect(gcd(100, 10)).toBe(10);
        });
    });

    describe('lcm', () => {
        it('should return LCM of two numbers', () => {
            expect(lcm(4, 6)).toBe(12);
            expect(lcm(3, 5)).toBe(15);
            expect(lcm(12, 18)).toBe(36);
        });

        it('should handle equal numbers', () => {
            expect(lcm(5, 5)).toBe(5);
        });
    });

    describe('simplifyFraction', () => {
        it('should simplify fractions', () => {
            expect(simplifyFraction(4, 8)).toEqual({ numerator: 1, denominator: 2 });
            expect(simplifyFraction(15, 25)).toEqual({ numerator: 3, denominator: 5 });
            expect(simplifyFraction(12, 18)).toEqual({ numerator: 2, denominator: 3 });
        });

        it('should handle already simplified fractions', () => {
            expect(simplifyFraction(3, 7)).toEqual({ numerator: 3, denominator: 7 });
            expect(simplifyFraction(1, 2)).toEqual({ numerator: 1, denominator: 2 });
        });

        it('should handle negative fractions', () => {
            expect(simplifyFraction(-4, 8)).toEqual({ numerator: -1, denominator: 2 });
            expect(simplifyFraction(4, -8)).toEqual({ numerator: -1, denominator: 2 });
        });

        it('should throw on zero denominator', () => {
            expect(() => simplifyFraction(1, 0)).toThrow('Denominator cannot be zero');
        });
    });

    describe('simplifyFractionWithValue', () => {
        it('should return simplified fraction with value', () => {
            const result = simplifyFractionWithValue(4, 8);
            expect(result.numerator).toBe(1);
            expect(result.denominator).toBe(2);
            expect(result.value).toBe(0.5);
        });
    });

    describe('compareFractions', () => {
        it('should compare fractions correctly', () => {
            expect(compareFractions(1, 2, 1, 4)).toBe(1);  // 1/2 > 1/4
            expect(compareFractions(1, 4, 1, 2)).toBe(-1); // 1/4 < 1/2
            expect(compareFractions(2, 4, 1, 2)).toBe(0);  // 2/4 = 1/2
        });

        it('should handle equal fractions with different representations', () => {
            expect(compareFractions(3, 6, 1, 2)).toBe(0);
            expect(compareFractions(4, 8, 2, 4)).toBe(0);
        });
    });

    describe('areFractionsEqual', () => {
        it('should return true for equal fractions', () => {
            expect(areFractionsEqual(1, 2, 2, 4)).toBe(true);
            expect(areFractionsEqual(3, 9, 1, 3)).toBe(true);
        });

        it('should return false for unequal fractions', () => {
            expect(areFractionsEqual(1, 2, 1, 3)).toBe(false);
        });
    });

    describe('addFractions', () => {
        it('should add fractions with same denominator', () => {
            expect(addFractions(1, 4, 2, 4)).toEqual({ numerator: 3, denominator: 4 });
        });

        it('should add fractions with different denominators', () => {
            expect(addFractions(1, 2, 1, 3)).toEqual({ numerator: 5, denominator: 6 });
        });

        it('should simplify result', () => {
            expect(addFractions(1, 4, 1, 4)).toEqual({ numerator: 1, denominator: 2 });
        });
    });

    describe('subtractFractions', () => {
        it('should subtract fractions', () => {
            expect(subtractFractions(3, 4, 1, 4)).toEqual({ numerator: 1, denominator: 2 });
            expect(subtractFractions(1, 2, 1, 3)).toEqual({ numerator: 1, denominator: 6 });
        });
    });

    describe('multiplyFractions', () => {
        it('should multiply fractions', () => {
            expect(multiplyFractions(1, 2, 2, 3)).toEqual({ numerator: 1, denominator: 3 });
            expect(multiplyFractions(3, 4, 2, 5)).toEqual({ numerator: 3, denominator: 10 });
        });
    });

    describe('divideFractions', () => {
        it('should divide fractions', () => {
            expect(divideFractions(1, 2, 1, 4)).toEqual({ numerator: 2, denominator: 1 });
            expect(divideFractions(3, 4, 2, 3)).toEqual({ numerator: 9, denominator: 8 });
        });

        it('should throw on division by zero', () => {
            expect(() => divideFractions(1, 2, 0, 3)).toThrow('Cannot divide by zero');
        });
    });
});
