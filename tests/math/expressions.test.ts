import { describe, it, expect } from 'vitest';
import {
    evaluateMathExpression,
    isValidMathExpression,
} from '../../src/math/expressions';

describe('expressions', () => {
    describe('evaluateMathExpression', () => {
        it('should evaluate simple addition', () => {
            expect(evaluateMathExpression('2+3')).toBe(5);
            expect(evaluateMathExpression('10 + 20')).toBe(30);
        });

        it('should evaluate simple subtraction', () => {
            expect(evaluateMathExpression('10-3')).toBe(7);
            expect(evaluateMathExpression('5 - 2')).toBe(3);
        });

        it('should evaluate multiplication', () => {
            expect(evaluateMathExpression('2*3')).toBe(6);
            expect(evaluateMathExpression('4 * 5')).toBe(20);
        });

        it('should evaluate division', () => {
            expect(evaluateMathExpression('10/2')).toBe(5);
            expect(evaluateMathExpression('15 / 3')).toBe(5);
        });

        it('should evaluate fractions', () => {
            expect(evaluateMathExpression('(1/2)')).toBe(0.5);
            expect(evaluateMathExpression('(1/2)+(1/2)')).toBe(1);
        });

        it('should handle parentheses', () => {
            expect(evaluateMathExpression('(2+3)*4')).toBe(20);
            expect(evaluateMathExpression('2*(3+4)')).toBe(14);
        });

        it('should convert LaTeX operators', () => {
            expect(evaluateMathExpression('2×3')).toBe(6);
            expect(evaluateMathExpression('6÷2')).toBe(3);
            expect(evaluateMathExpression('5−2')).toBe(3);
        });

        it('should return null for empty input', () => {
            expect(evaluateMathExpression('')).toBeNull();
            expect(evaluateMathExpression(null)).toBeNull();
            expect(evaluateMathExpression(undefined)).toBeNull();
        });

        it('should return null for invalid expressions', () => {
            expect(evaluateMathExpression('hello')).toBeNull();
            expect(evaluateMathExpression('2 + + 3')).toBeNull();
        });

        it('should handle complex expressions', () => {
            expect(evaluateMathExpression('(1+2)*(3+4)')).toBe(21);
            expect(evaluateMathExpression('10/2+3*4')).toBe(17);
        });
    });

    describe('isValidMathExpression', () => {
        it('should return true for valid expressions', () => {
            expect(isValidMathExpression('2+3')).toBe(true);
            expect(isValidMathExpression('(1/2)')).toBe(true);
            expect(isValidMathExpression('10*5')).toBe(true);
        });

        it('should return false for invalid expressions', () => {
            expect(isValidMathExpression('hello')).toBe(false);
            expect(isValidMathExpression('')).toBe(false);
        });
    });
});
