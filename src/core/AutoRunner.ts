/**
 * Автоматический запуск решения заданий
 */

import { logger } from '../utils/logger';
import { delay, clickContinueButton } from '../dom/interactions';
import { detectChallenge, isOnResultScreen, isIncorrect } from './ChallengeDetector';
import { getSolverRegistry } from './SolverRegistry';
import { CONFIG } from '../config';

export interface IAutoRunnerConfig {
    delayBetweenActions: number;
    delayAfterSolve: number;
    stopOnError: boolean;
}

const DEFAULT_CONFIG: IAutoRunnerConfig = {
    delayBetweenActions: CONFIG.delays.betweenActions,
    delayAfterSolve: CONFIG.delays.afterSolve,
    stopOnError: true,
};

/**
 * Автоматический runner для решения заданий
 */
export class AutoRunner {
    private isRunning = false;
    private config: IAutoRunnerConfig;
    private solvedCount = 0;
    private errorCount = 0;

    constructor(config: Partial<IAutoRunnerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Запускает автоматическое решение
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('AutoRunner: already running');
            return;
        }

        logger.info('AutoRunner: starting');
        this.isRunning = true;
        this.solvedCount = 0;
        this.errorCount = 0;

        await this.runLoop();
    }

    /**
     * Останавливает автоматическое решение
     */
    stop(): void {
        logger.info('AutoRunner: stopping');
        this.isRunning = false;
    }

    /**
     * Возвращает статус
     */
    getStatus(): { isRunning: boolean; solved: number; errors: number } {
        return {
            isRunning: this.isRunning,
            solved: this.solvedCount,
            errors: this.errorCount,
        };
    }

    /**
     * Основной цикл
     */
    private async runLoop(): Promise<void> {
        while (this.isRunning) {
            try {
                // Check if on result screen
                if (isOnResultScreen()) {
                    logger.info('AutoRunner: lesson complete');
                    this.stop();
                    break;
                }

                // Check for incorrect answer
                if (isIncorrect()) {
                    logger.warn('AutoRunner: incorrect answer detected');
                    if (this.config.stopOnError) {
                        this.stop();
                        break;
                    }
                    clickContinueButton();
                    await delay(this.config.delayBetweenActions);
                    continue;
                }

                // Try to solve
                const solved = await this.solveOne();

                if (solved) {
                    this.solvedCount++;
                    await delay(this.config.delayAfterSolve);

                    // Click continue/check button
                    clickContinueButton();
                    await delay(this.config.delayBetweenActions);
                } else {
                    // No challenge found or couldn't solve, wait and retry
                    await delay(this.config.delayBetweenActions);
                }
            } catch (error) {
                logger.error('AutoRunner: error in loop', error);
                this.errorCount++;

                if (this.config.stopOnError) {
                    this.stop();
                    break;
                }

                await delay(this.config.delayBetweenActions);
            }
        }

        logger.info('AutoRunner: stopped. Solved:', this.solvedCount, 'Errors:', this.errorCount);
    }

    /**
     * Решает одно задание
     */
    private async solveOne(): Promise<boolean> {
        const context = detectChallenge();
        if (!context) {
            logger.debug('AutoRunner: no challenge detected');
            return false;
        }

        const registry = getSolverRegistry();
        const result = registry.solve(context);

        if (result?.success) {
            logger.info('AutoRunner: solved with', result.type);
            return true;
        }

        logger.warn('AutoRunner: failed to solve');
        return false;
    }
}

// Singleton instance
let runnerInstance: AutoRunner | null = null;

export function getAutoRunner(): AutoRunner {
    if (!runnerInstance) {
        runnerInstance = new AutoRunner();
    }
    return runnerInstance;
}
