/**
 * Автоматический запуск решения заданий
 */

import { logger } from '../utils/logger';
import { delay, clickContinueButtonAsync } from '../dom/interactions';
import {
    detectChallenge,
    isOnResultScreen,
    isIncorrect,
    isOnHomePage,
    clickNextLesson,
} from './ChallengeDetector';
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
        let stuckCounter = 0;
        const maxStuckAttempts = 5;

        while (this.isRunning) {
            try {
                // Check if on result screen (lesson complete)
                if (isOnResultScreen()) {
                    logger.info('AutoRunner: lesson complete, looking for next...');
                    const clicked = await clickContinueButtonAsync(5000);
                    if (!clicked) {
                        stuckCounter++;
                        logger.warn(`AutoRunner: cannot click continue (attempt ${stuckCounter}/${maxStuckAttempts})`);
                        if (stuckCounter >= maxStuckAttempts) {
                            logger.error('AutoRunner: stuck on result screen, stopping');
                            this.stop();
                            break;
                        }
                    } else {
                        stuckCounter = 0;
                    }
                    await delay(1000);
                    continue;
                }

                // Check if on home page (need to start next lesson)
                if (isOnHomePage()) {
                    logger.info('AutoRunner: on home page, starting next lesson...');
                    const started = clickNextLesson();
                    if (!started) {
                        logger.info('AutoRunner: no more lessons available, course complete!');
                        this.stop();
                        break;
                    }
                    stuckCounter = 0;
                    await delay(2000); // Wait for lesson to load
                    continue;
                }

                // Check for incorrect answer
                if (isIncorrect()) {
                    logger.warn('AutoRunner: incorrect answer detected');
                    if (this.config.stopOnError) {
                        this.stop();
                        break;
                    }
                    const clicked = await clickContinueButtonAsync(5000);
                    if (!clicked) {
                        stuckCounter++;
                        if (stuckCounter >= maxStuckAttempts) {
                            logger.error('AutoRunner: stuck on incorrect screen, stopping');
                            this.stop();
                            break;
                        }
                    } else {
                        stuckCounter = 0;
                    }
                    await delay(this.config.delayBetweenActions);
                    continue;
                }

                // Reset stuck counter on normal progress
                stuckCounter = 0;

                // Try to solve
                const solved = await this.solveOne();

                if (solved) {
                    this.solvedCount++;
                    await delay(this.config.delayAfterSolve);

                    // Click continue/check button (wait for it to become enabled)
                    // Use longer timeout for table challenges which may need more processing time
                    const clicked = await clickContinueButtonAsync(10000);
                    if (!clicked) {
                        logger.warn('AutoRunner: continue button not clicked (may be disabled or not found)');
                        // Don't increment stuck counter here - the challenge was solved,
                        // just the button might need more time
                    }
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
