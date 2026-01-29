import { describe, it, expect } from 'vitest';
import {
    extractGridFraction,
    isGridDiagram,
} from '../../src/parsers/GridParser';

describe('GridParser', () => {
    describe('extractGridFraction', () => {
        it('should extract fraction from 3x3 grid with 6 colored cells', () => {
            const grid3x3_6 = `
                <span class="dark-img">
                    <svg>
                        <path fill="#131F24" />
                        <path fill="#131F24" />
                        <path fill="#131F24" />
                        <path fill="#49C0F8" />
                        <path fill="#49C0F8" />
                        <path fill="#49C0F8" />
                        <path fill="#49C0F8" />
                        <path fill="#49C0F8" />
                        <path fill="#49C0F8" />
                    </svg>
                </span>
            `;
            const result = extractGridFraction(grid3x3_6);
            expect(result).toBeDefined();
            expect(result?.numerator).toBe(6);
            expect(result?.denominator).toBe(9);
            expect(result?.value).toBeCloseTo(0.6667, 4);
        });

        it('should extract fraction from 3x3 grid with 3 colored cells', () => {
            const grid3x3_3 = `
                <span class="dark-img">
                    <svg>
                        <path fill="#49C0F8" />
                        <path fill="#49C0F8" />
                        <path fill="#49C0F8" />
                        <path fill="#131F24" />
                        <path fill="#131F24" />
                        <path fill="#131F24" />
                        <path fill="#131F24" />
                        <path fill="#131F24" />
                        <path fill="#131F24" />
                    </svg>
                </span>
            `;
            const result = extractGridFraction(grid3x3_3);
            expect(result).toBeDefined();
            expect(result?.numerator).toBe(3);
            expect(result?.denominator).toBe(9);
            expect(result?.value).toBeCloseTo(0.3333, 4);
        });

        it('should handle rect elements', () => {
            const gridWithRects = `
                <span class="dark-img">
                    <svg>
                        <rect fill="#49C0F8" />
                        <rect fill="#49C0F8" />
                        <rect fill="#FFFFFF" />
                        <rect fill="#FFFFFF" />
                    </svg>
                </span>
            `;
            const result = extractGridFraction(gridWithRects);
            expect(result).toBeDefined();
            expect(result?.numerator).toBe(2);
            expect(result?.denominator).toBe(4);
            expect(result?.value).toBe(0.5);
        });

        it('should return null for pie charts with sector paths', () => {
            // Pie charts have paths with L100 100 (lines to center)
            const pieChart = `
                <span class="dark-img">
                    <svg>
                        <path d="M15 51C23 36 36 23 51 15L100 100" fill="#49C0F8" />
                        <path d="M100 2C117 2 134 6 149 15L100 100" fill="#49C0F8" />
                    </svg>
                </span>
            `;
            expect(extractGridFraction(pieChart)).toBeNull();
        });

        it('should return null for empty input', () => {
            expect(extractGridFraction('')).toBeNull();
        });
    });

    describe('isGridDiagram', () => {
        it('should return true for grid diagram with colored cells', () => {
            const grid = `
                <svg>
                    <path fill="#49C0F8" />
                    <path fill="#49C0F8" />
                    <path fill="#131F24" />
                    <path fill="#131F24" />
                </svg>
            `;
            expect(isGridDiagram(grid)).toBe(true);
        });

        it('should return false for pie charts', () => {
            const pieChart = `
                <svg>
                    <path d="M15 51L100 100" fill="#49C0F8" />
                    <path d="M100 2L100 100" fill="#49C0F8" />
                </svg>
            `;
            expect(isGridDiagram(pieChart)).toBe(false);
        });

        it('should return false for diagrams with too few cells', () => {
            const tooFew = `
                <svg>
                    <path fill="#49C0F8" />
                    <path fill="#131F24" />
                </svg>
            `;
            expect(isGridDiagram(tooFew)).toBe(false);
        });

        it('should return false for empty input', () => {
            expect(isGridDiagram('')).toBe(false);
        });
    });
});
