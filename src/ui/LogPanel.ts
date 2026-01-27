/**
 * Панель логов для отображения в интерфейсе
 */

import { CONFIG } from '../config';

export class LogPanel {
    private container: HTMLDivElement | null = null;
    private content: HTMLDivElement | null = null;
    private maxLines = 100;
    private isVisible = true;

    /**
     * Создаёт и показывает панель логов
     */
    show(): void {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'autoduo-log-panel';
        this.container.innerHTML = `
            <div style="
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 400px;
                max-height: 300px;
                background: rgba(0, 0, 0, 0.9);
                border: 1px solid #333;
                border-radius: 8px;
                font-family: monospace;
                font-size: 11px;
                color: #fff;
                z-index: 99999;
                overflow: hidden;
            ">
                <div style="
                    padding: 8px 12px;
                    background: #1a1a2e;
                    border-bottom: 1px solid #333;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <span style="font-weight: bold; color: #58cc02;">
                        AutoDuo ${CONFIG.version}
                    </span>
                    <button id="autoduo-log-toggle" style="
                        background: none;
                        border: none;
                        color: #888;
                        cursor: pointer;
                        font-size: 14px;
                    ">−</button>
                </div>
                <div id="autoduo-log-content" style="
                    padding: 8px;
                    max-height: 250px;
                    overflow-y: auto;
                "></div>
            </div>
        `;

        document.body.appendChild(this.container);
        this.content = document.getElementById('autoduo-log-content') as HTMLDivElement;

        // Toggle visibility
        const toggle = document.getElementById('autoduo-log-toggle');
        toggle?.addEventListener('click', () => this.toggle());
    }

    /**
     * Скрывает панель
     */
    hide(): void {
        if (this.container) {
            this.container.remove();
            this.container = null;
            this.content = null;
        }
    }

    /**
     * Переключает видимость контента
     */
    toggle(): void {
        if (!this.content) return;

        this.isVisible = !this.isVisible;
        this.content.style.display = this.isVisible ? 'block' : 'none';

        const toggle = document.getElementById('autoduo-log-toggle');
        if (toggle) {
            toggle.textContent = this.isVisible ? '−' : '+';
        }
    }

    /**
     * Добавляет сообщение в лог
     */
    log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
        if (!this.content) return;

        const colors: Record<string, string> = {
            info: '#fff',
            warn: '#ffc107',
            error: '#dc3545',
            debug: '#6c757d',
        };

        const line = document.createElement('div');
        line.style.color = colors[level] ?? '#fff';
        line.style.marginBottom = '2px';
        line.style.wordBreak = 'break-word';

        const time = new Date().toLocaleTimeString();
        line.textContent = `[${time}] ${message}`;

        this.content.appendChild(line);

        // Limit lines
        while (this.content.children.length > this.maxLines) {
            this.content.firstChild?.remove();
        }

        // Auto-scroll to bottom
        this.content.scrollTop = this.content.scrollHeight;
    }

    /**
     * Очищает лог
     */
    clear(): void {
        if (this.content) {
            this.content.innerHTML = '';
        }
    }
}

// Singleton
let logPanelInstance: LogPanel | null = null;

export function getLogPanel(): LogPanel {
    if (!logPanelInstance) {
        logPanelInstance = new LogPanel();
    }
    return logPanelInstance;
}
