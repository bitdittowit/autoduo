import { describe, it, expect } from 'vitest';
import {
    extractBlockDiagramValue,
    isBlockDiagram,
} from '../../src/parsers/BlockDiagramParser';

describe('BlockDiagramParser', () => {
    describe('extractBlockDiagramValue', () => {
        it('should return null for empty input', () => {
            expect(extractBlockDiagramValue('')).toBeNull();
        });

        it('should count rect elements with fill color', () => {
            const svgWithRects = `
                <span class="dark-img">
                    <rect fill="#49C0F8" />
                    <rect fill="#49C0F8" />
                    <rect fill="#49C0F8" />
                </span>
            `;
            expect(extractBlockDiagramValue(svgWithRects)).toBe(3);
        });

        it('should count path elements with fill color (without clip-rule)', () => {
            const svgWithPaths = `
                <span class="dark-img">
                    <path fill="#49C0F8" d="..." />
                    <path fill="#49C0F8" d="..." />
                </span>
            `;
            expect(extractBlockDiagramValue(svgWithPaths)).toBe(2);
        });

        it('should count hundred-block structures (with clip-rule)', () => {
            const svgWithHundreds = `
                <span class="dark-img">
                    <path fill="#49C0F8" clip-rule="evenodd" d="..." />
                </span>
            `;
            expect(extractBlockDiagramValue(svgWithHundreds)).toBe(100);
        });

        it('should combine regular blocks and hundreds', () => {
            const svgCombined = `
                <span class="dark-img">
                    <path fill="#49C0F8" clip-rule="evenodd" d="..." />
                    <rect fill="#49C0F8" />
                    <rect fill="#49C0F8" />
                </span>
            `;
            expect(extractBlockDiagramValue(svgCombined)).toBe(102);
        });

        it('should prefer dark-img over light-img', () => {
            const svgBothModes = `
                <span class="light-img">
                    <rect fill="#1CB0F6" />
                </span>
                <span class="dark-img">
                    <rect fill="#49C0F8" />
                    <rect fill="#49C0F8" />
                </span>
            `;
            expect(extractBlockDiagramValue(svgBothModes)).toBe(2);
        });
    });

    describe('isBlockDiagram', () => {
        it('should return true for block diagram SVG', () => {
            const svg = '<rect fill="#49C0F8" />';
            expect(isBlockDiagram(svg)).toBe(true);
        });

        it('should return false for non-block diagram SVG', () => {
            expect(isBlockDiagram('<rect fill="#000000" />')).toBe(false);
            expect(isBlockDiagram('<circle />')).toBe(false);
            expect(isBlockDiagram('')).toBe(false);
        });
    });
});
