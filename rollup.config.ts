import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const banner = `// ==UserScript==
// @name         AutoDuo
// @namespace    https://github.com/bitdittowit/autoduo
// @version      ${pkg.version}
// @description  Auto-solve Duolingo Math challenges
// @author       bitdittowit
// @match        https://www.duolingo.com/*
// @grant        none
// ==/UserScript==
`;

export default defineConfig({
    input: 'src/index.ts',
    output: {
        file: 'dist/autoduo.user.js',
        format: 'iife',
        name: 'AutoDuo',
        banner,
        sourcemap: false,
    },
    plugins: [
        resolve(),
        typescript({
            tsconfig: './tsconfig.json',
            include: ['src/**/*.ts'],
        }),
        // terser() // Temporarily disabled due to build issue
    ],
});
