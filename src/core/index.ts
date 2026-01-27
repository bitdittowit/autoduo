/**
 * Экспорт Core модулей
 */

export {
    detectChallenge,
    isOnResultScreen,
    isIncorrect,
    isOnHomePage,
    hasNextLesson,
    clickNextLesson,
} from './ChallengeDetector';
export { SolverRegistry, getSolverRegistry } from './SolverRegistry';
export { AutoRunner, getAutoRunner } from './AutoRunner';
export type { IAutoRunnerConfig } from './AutoRunner';
