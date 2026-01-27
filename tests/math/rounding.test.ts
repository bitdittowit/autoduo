import { describe, it, expect } from 'vitest';
import {
    roundToNearest,
    floorToNearest,
    ceilToNearest,
    extractRoundingBase,
} from '../../src/math/rounding';

describe('rounding', () => {
    describe('roundToNearest', () => {
        it('should round to nearest 10', () => {
            expect(roundToNearest(41, 10)).toBe(40);
            expect(roundToNearest(45, 10)).toBe(50);
            expect(roundToNearest(44, 10)).toBe(40);
            expect(roundToNearest(18, 10)).toBe(20);
            expect(roundToNearest(12, 10)).toBe(10);
        });

        it('should round to nearest 100', () => {
            expect(roundToNearest(250, 100)).toBe(300);
            expect(roundToNearest(249, 100)).toBe(200);
            expect(roundToNearest(150, 100)).toBe(200);
            expect(roundToNearest(149, 100)).toBe(100);
        });

        it('should round to nearest 1000', () => {
            expect(roundToNearest(1500, 1000)).toBe(2000);
            expect(roundToNearest(1499, 1000)).toBe(1000);
        });

        it('should handle zero', () => {
            expect(roundToNearest(0, 10)).toBe(0);
            expect(roundToNearest(4, 10)).toBe(0);
        });

        it('should handle negative numbers', () => {
            expect(roundToNearest(-41, 10)).toBe(-40);
            expect(roundToNearest(-45, 10)).toBe(-40); // Math.round rounds -0.5 to 0
        });

        it('should throw on non-positive base', () => {
            expect(() => roundToNearest(10, 0)).toThrow('Base must be positive');
            expect(() => roundToNearest(10, -10)).toThrow('Base must be positive');
        });
    });

    describe('floorToNearest', () => {
        it('should floor to nearest 10', () => {
            expect(floorToNearest(45, 10)).toBe(40);
            expect(floorToNearest(49, 10)).toBe(40);
            expect(floorToNearest(50, 10)).toBe(50);
        });

        it('should floor to nearest 100', () => {
            expect(floorToNearest(299, 100)).toBe(200);
            expect(floorToNearest(300, 100)).toBe(300);
        });
    });

    describe('ceilToNearest', () => {
        it('should ceil to nearest 10', () => {
            expect(ceilToNearest(41, 10)).toBe(50);
            expect(ceilToNearest(40, 10)).toBe(40);
            expect(ceilToNearest(1, 10)).toBe(10);
        });

        it('should ceil to nearest 100', () => {
            expect(ceilToNearest(101, 100)).toBe(200);
            expect(ceilToNearest(100, 100)).toBe(100);
        });
    });

    describe('extractRoundingBase', () => {
        it('should extract rounding base from text', () => {
            expect(extractRoundingBase('Round to the nearest 10')).toBe(10);
            expect(extractRoundingBase('Round to the nearest 100')).toBe(100);
            expect(extractRoundingBase('nearest 1000')).toBe(1000);
        });

        it('should be case insensitive', () => {
            expect(extractRoundingBase('NEAREST 10')).toBe(10);
            expect(extractRoundingBase('Nearest 100')).toBe(100);
        });

        it('should handle variations in spacing', () => {
            expect(extractRoundingBase('nearest10')).toBe(10);
            expect(extractRoundingBase('nearest  100')).toBe(100);
        });

        it('should return null for invalid text', () => {
            expect(extractRoundingBase('no rounding here')).toBeNull();
            expect(extractRoundingBase('nearest')).toBeNull();
            expect(extractRoundingBase('')).toBeNull();
        });
    });
});
