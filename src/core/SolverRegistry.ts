/**
 * Регистр всех доступных солверов
 */

import type { ISolver, IChallengeContext, ISolverResult } from '../types';
import { logger } from '../utils/logger';

// Import all solvers
import { RoundToNearestSolver } from '../solvers/RoundToNearestSolver';
import { TypeAnswerSolver } from '../solvers/TypeAnswerSolver';
import { SelectEquivalentFractionSolver } from '../solvers/SelectEquivalentFractionSolver';
import { ComparisonChoiceSolver } from '../solvers/ComparisonChoiceSolver';
import { SelectFactorsSolver } from '../solvers/SelectFactorsSolver';
import { LeastCommonMultipleSolver } from '../solvers/LeastCommonMultipleSolver';
import { VisualLCMSolver } from '../solvers/VisualLCMSolver';
import { GreatestCommonFactorSolver } from '../solvers/GreatestCommonFactorSolver';
import { VisualGCFSolver } from '../solvers/VisualGCFSolver';
import { SelectOperatorSolver } from '../solvers/SelectOperatorSolver';
import { SelectPieChartSolver } from '../solvers/SelectPieChartSolver';
import { PieChartTextInputSolver } from '../solvers/PieChartTextInputSolver';
import { EquationBlankSolver } from '../solvers/EquationBlankSolver';
import { MatchPairsSolver } from '../solvers/MatchPairsSolver';
import { InteractiveSliderSolver } from '../solvers/InteractiveSliderSolver';
import { InteractiveSpinnerSolver } from '../solvers/InteractiveSpinnerSolver';
import { ExpressionBuildSolver } from '../solvers/ExpressionBuildSolver';
import { FactorTreeSolver } from '../solvers/FactorTreeSolver';
import { PatternTableSolver } from '../solvers/PatternTableSolver';
import { PieChartSelectFractionSolver } from '../solvers/PieChartSelectFractionSolver';
import { BlockDiagramChoiceSolver } from '../solvers/BlockDiagramChoiceSolver';
import { BlockDiagramTextInputSolver } from '../solvers/BlockDiagramTextInputSolver';
import { SolveForXSolver } from '../solvers/SolveForXSolver';
import { FractionToDecimalChoiceSolver } from '../solvers/FractionToDecimalChoiceSolver';
import { RatioChoiceSolver } from '../solvers/RatioChoiceSolver';

/**
 * Регистр солверов - выбирает подходящий солвер для задания
 */
export class SolverRegistry {
    private solvers: ISolver[] = [];

    constructor() {
        this.registerDefaultSolvers();
    }

    /**
     * Регистрирует солвер
     */
    register(solver: ISolver): void {
        this.solvers.push(solver);
        logger.debug('SolverRegistry: registered', solver.name);
    }

    /**
     * Находит подходящий солвер для задания
     */
    findSolver(context: IChallengeContext): ISolver | null {
        for (const solver of this.solvers) {
            if (solver.canSolve(context)) {
                logger.info('SolverRegistry: selected', solver.name);
                return solver;
            }
        }
        return null;
    }

    /**
     * Решает задание используя подходящий солвер
     */
    solve(context: IChallengeContext): ISolverResult | null {
        const solver = this.findSolver(context);
        if (!solver) {
            logger.warn('SolverRegistry: no solver found for challenge');
            return null;
        }

        try {
            return solver.solve(context);
        } catch (error) {
            logger.error('SolverRegistry: solver error', error);
            return null;
        }
    }

    /**
     * Регистрирует все солверы по умолчанию
     * Порядок важен - более специфичные солверы должны быть первыми
     */
    private registerDefaultSolvers(): void {
        // Interactive iframe solvers (most specific)
        // Note: InteractiveSliderSolver must be BEFORE ExpressionBuildSolver
        // because NumberLine sliders may contain "ExpressionBuild" in their iframe code
        this.register(new InteractiveSliderSolver());
        this.register(new ExpressionBuildSolver());
        this.register(new InteractiveSpinnerSolver());
        this.register(new FactorTreeSolver());
        this.register(new RatioChoiceSolver()); // Must be before MatchPairs and PatternTable
        this.register(new MatchPairsSolver());
        this.register(new PatternTableSolver());

        // Specific challenge type solvers
        this.register(new BlockDiagramChoiceSolver());
        this.register(new BlockDiagramTextInputSolver());
        this.register(new RoundToNearestSolver());
        this.register(new SelectFactorsSolver()); // Select factors from list
        this.register(new VisualLCMSolver()); // Select LCM with visual block diagrams
        this.register(new LeastCommonMultipleSolver()); // Select LCM with text numbers
        this.register(new VisualGCFSolver()); // Find GCF with visual block diagrams
        this.register(new GreatestCommonFactorSolver()); // Find GCF with text numbers
        this.register(new SelectEquivalentFractionSolver());
        this.register(new FractionToDecimalChoiceSolver()); // Convert fraction to decimal
        this.register(new ComparisonChoiceSolver());
        this.register(new SelectOperatorSolver());
        this.register(new PieChartTextInputSolver());
        this.register(new PieChartSelectFractionSolver());
        this.register(new SelectPieChartSolver());
        this.register(new SolveForXSolver()); // Solve for X with choices (before EquationBlankSolver)
        this.register(new EquationBlankSolver());

        // Generic solvers last (catch-all)
        this.register(new TypeAnswerSolver());
    }

    /**
     * Возвращает список всех зарегистрированных солверов
     */
    getSolvers(): ISolver[] {
        return [...this.solvers];
    }
}

// Singleton instance
let registryInstance: SolverRegistry | null = null;

export function getSolverRegistry(): SolverRegistry {
    if (!registryInstance) {
        registryInstance = new SolverRegistry();
    }
    return registryInstance;
}
