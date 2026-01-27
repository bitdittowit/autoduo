/**
 * AutoDuo - Автоматическое решение заданий Duolingo Math
 *
 * Entry point для userscript
 */

import { CONFIG } from './config';
import { logger } from './utils/logger';
import { getLogPanel } from './ui/LogPanel';
import { getControlPanel } from './ui/ControlPanel';

// Re-export для использования в других модулях
export * from './types';
export { CONFIG } from './config';
export * from './utils/logger';
export * from './utils/helpers';
export * from './math/fractions';
export * from './math/rounding';
export * from './math/expressions';
export * from './parsers';
export * from './solvers';
export * from './core';
export * from './ui';

// DOM exports with namespacing to avoid conflicts
export * as dom from './dom';

/**
 * Инициализация AutoDuo
 */
function initAutoDuo(): void {
    // Show UI panels
    const logPanel = getLogPanel();
    const controlPanel = getControlPanel();

    logPanel.show();
    controlPanel.show();

    // Connect logger to UI
    logger.setLogPanel(logPanel);

    logger.info(`AutoDuo ${CONFIG.version} ready`);
    logger.info('Click "Solve 1" to solve current challenge');
    logger.info('Click "Start" to auto-solve all challenges');
}

/**
 * Запуск при загрузке страницы
 */
function main(): void {
    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAutoDuo);
    } else {
        initAutoDuo();
    }
}

// Run main
main();
