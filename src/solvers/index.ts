/**
 * Экспорт всех солверов
 */

export { BaseSolver } from './BaseSolver';
export { RoundToNearestSolver } from './RoundToNearestSolver';
export { TypeAnswerSolver } from './TypeAnswerSolver';
export { SelectEquivalentFractionSolver } from './SelectEquivalentFractionSolver';
export { ComparisonChoiceSolver } from './ComparisonChoiceSolver';
export { SelectOperatorSolver } from './SelectOperatorSolver';
export { SelectPieChartSolver } from './SelectPieChartSolver';
export { PieChartTextInputSolver } from './PieChartTextInputSolver';
export { EquationBlankSolver } from './EquationBlankSolver';
export { MatchPairsSolver } from './MatchPairsSolver';
export { InteractiveSliderSolver } from './InteractiveSliderSolver';
export { InteractiveSpinnerSolver } from './InteractiveSpinnerSolver';
export { ExpressionBuildSolver } from './ExpressionBuildSolver';
export { FactorTreeSolver } from './FactorTreeSolver';
export { PatternTableSolver } from './PatternTableSolver';

// Re-export types
export type { ISolver, ISolverResult, IChallengeContext } from '../types';
