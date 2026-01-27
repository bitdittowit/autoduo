import { beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Глобальный DOM для всех тестов
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://www.duolingo.com/',
    pretendToBeVisual: true,
});

// Устанавливаем глобальные объекты
global.document = dom.window.document;
global.window = dom.window as unknown as Window & typeof globalThis;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.NodeList = dom.window.NodeList;

// Мокаем console для предотвращения вывода в тестах
// eslint-disable-next-line @typescript-eslint/no-empty-function
vi.spyOn(console, 'log').mockImplementation(() => {});
// eslint-disable-next-line @typescript-eslint/no-empty-function
vi.spyOn(console, 'warn').mockImplementation(() => {});
// eslint-disable-next-line @typescript-eslint/no-empty-function
vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
    // Очищаем DOM перед каждым тестом
    document.body.innerHTML = '';
    vi.clearAllMocks();
});
