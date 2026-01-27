/**
 * AutoDuo - Автоматическое решение заданий Duolingo Math
 *
 * Entry point для userscript
 */

import { CONFIG } from './config';
import { logger } from './utils/logger';
import { getLogPanel } from './ui/LogPanel';
import { getControlPanel } from './ui/ControlPanel';
import { getAutoRunner } from './core/AutoRunner';

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
    logger.info(`AutoDuo ${CONFIG.version} initializing...`);

    // Show UI panels
    const logPanel = getLogPanel();
    const controlPanel = getControlPanel();

    logPanel.show();
    controlPanel.show();

    // Connect logger to UI
    logger.setLogPanel(logPanel);

    logger.info('AutoDuo initialized');
    logger.info('Press Start to begin auto-solving');

    // Auto-start if configured
    if (CONFIG.autoSubmit) {
        logger.info('Auto-start enabled');
        setTimeout(() => {
            getAutoRunner().start();
        }, 1000);
    }
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
