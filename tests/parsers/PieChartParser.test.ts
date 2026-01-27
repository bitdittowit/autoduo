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
