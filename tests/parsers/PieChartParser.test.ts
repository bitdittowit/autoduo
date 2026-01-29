import { describe, it, expect } from 'vitest';
import {
    extractPieChartFraction,
    isPieChart,
} from '../../src/parsers/PieChartParser';

describe('PieChartParser', () => {
    describe('extractPieChartFraction', () => {
        it('should return null for empty input', () => {
            expect(extractPieChartFraction(null)).toBeNull();
            expect(extractPieChartFraction('')).toBeNull();
        });

        it('should extract fraction from colored sectors', () => {
            const svg = `
                <span class="dark-img">
                    <path fill="#49C0F8" stroke="black" d="..." />
                    <path fill="#49C0F8" stroke="black" d="..." />
                    <path fill="#49C0F8" stroke="black" d="..." />
                    <path fill="#131F24" stroke="black" d="..." />
                </span>
            `;
            const result = extractPieChartFraction(svg);
            expect(result).toEqual({
                numerator: 3,
                denominator: 4,
                value: 0.75,
            });
        });

        it('should return 1/1 for full circle without paths', () => {
            const svg = `
                <span class="dark-img">
                    <circle cx="100" cy="100" r="50" />
                </span>
            `;
            const result = extractPieChartFraction(svg);
            expect(result).toEqual({
                numerator: 1,
                denominator: 1,
                value: 1.0,
            });
        });

        it('should handle circle with sector paths', () => {
            const svg = `
                <span class="dark-img">
                    <circle cx="100" cy="100" r="50" />
                    <path stroke="black" d="M100 100 L100 2 V100" />
                </span>
            `;
            const result = extractPieChartFraction(svg);
            // Should detect as 1/4 based on path analysis
            expect(result).not.toBeNull();
        });

        it('should extract fraction from sector paths without circle', () => {
            // Pie chart drawn only with path elements (no circle)
            const svg = `
                <span class="dark-img">
                    <svg>
                        <path d="M15 51C23 36 36 23 51 15L100 100" fill="#49C0F8" />
                        <path d="M100 2C117 2 134 6 149 15L100 100" fill="#49C0F8" />
                        <path d="M184 51C193 65 198 82 198 100L100 100" fill="#49C0F8" />
                        <path d="M184 149C176 163 163 176 149 184L100 100" fill="#FFFFFF" />
                        <path d="M100 198C82 198 65 193 50 184L100 100" fill="#FFFFFF" />
                        <path d="M15 149C6 134 2 117 2 100L100 100" fill="#FFFFFF" />
                    </svg>
                </span>
            `;
            const result = extractPieChartFraction(svg);
            expect(result).toBeDefined();
            expect(result?.numerator).toBe(3);
            expect(result?.denominator).toBe(6);
            expect(result?.value).toBe(0.5);
        });
    });

    describe('isPieChart', () => {
        it('should return true for pie chart with colored paths', () => {
            const svg = '<path fill="#49C0F8" stroke="black" />';
            expect(isPieChart(svg)).toBe(true);
        });

        it('should return true for circle-based pie chart', () => {
            const svg = '<circle cx="100" cy="100" r="50" />';
            expect(isPieChart(svg)).toBe(true);
        });

        it('should return false for non-pie chart SVG', () => {
            expect(isPieChart('')).toBe(false);
            expect(isPieChart('<rect />')).toBe(false);
        });
    });
});
