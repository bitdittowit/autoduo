import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: [
                // Entry points and type definitions
                'src/index.ts',
                'src/types.ts',
                // Re-export index files
                'src/**/index.ts',
                // UI components (require real browser)
                'src/ui/**',
                // DOM interactions (require real browser)
                'src/dom/**',
                // Core runtime (AutoRunner, etc.)
                'src/core/**',
                // Complex solvers with heavy iframe interaction
                'src/solvers/InteractiveSliderSolver.ts',
                'src/solvers/InteractiveSpinnerSolver.ts',
                'src/solvers/ExpressionBuildSolver.ts',
                'src/solvers/FactorTreeSolver.ts',
                'src/solvers/MatchPairsSolver.ts',
                'src/solvers/PatternTableSolver.ts',
                'src/solvers/PieChartSelectFractionSolver.ts',
            ],
            thresholds: {
                statements: 80,
                branches: 60,
                functions: 80,
                lines: 80,
            },
        },
    },
});
