/**
 * AutoDuo - Auto-solve Duolingo Math challenges
 *
 * Точка входа приложения
 */

import { CONFIG } from './config';
import { logger } from './utils/logger';

// Re-export для использования в других модулях
export * from './types';
export * from './config';
export * from './utils/logger';
export * from './utils/helpers';
export * from './math/fractions';
export * from './math/rounding';

/**
 * Инициализация скрипта
 */
function init(): void {
    logger.info(`AutoDuo v${CONFIG.version} initialized`);

    // TODO: Здесь будет инициализация UI и основного цикла
    // После миграции всей логики из script.js
}

// Запуск при загрузке страницы
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
