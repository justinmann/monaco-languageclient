/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2024 TypeFox and others.
 * Licensed under the MIT License. See LICENSE in the package root for license information.
 * ------------------------------------------------------------------------------------------ */

import { describe, expect, test } from 'vitest';
import { EditorApp, EditorAppConfig, verifyUrlOrCreateDataUrl, WrapperConfig } from 'monaco-editor-wrapper';
import { createWrapperConfigClassicApp, createWrapperConfigExtendedApp } from './helper.js';

const buildConfig = (): WrapperConfig => {
    const wrapperConfig = createWrapperConfigClassicApp();
    wrapperConfig.editorAppConfig.editorOptions = {};
    return wrapperConfig;
};

describe('Test EditorAppBase', () => {

    test('classic type: empty EditorAppConfigClassic', () => {
        const wrapperConfig = createWrapperConfigClassicApp();
        expect(wrapperConfig.editorAppConfig.$type).toBe('classic');
    });

    test('extended type: empty EditorAppConfigExtended', () => {
        const wrapperConfig = createWrapperConfigExtendedApp();
        expect(wrapperConfig.editorAppConfig.$type).toBe('extended');
    });

    test('editorOptions: semanticHighlighting=true', () => {
        const wrapperConfig = buildConfig();
        const configClassic = wrapperConfig.editorAppConfig as EditorAppConfig;
        configClassic.editorOptions!['semanticHighlighting.enabled'] = true;

        const app = new EditorApp('config defaults', configClassic);
        expect(configClassic.$type).toEqual('classic');
        expect(app.getConfig().editorOptions?.['semanticHighlighting.enabled']).toBeTruthy();
    });

    test('editorOptions: semanticHighlighting=false', () => {
        const wrapperConfig = buildConfig();
        const configClassic = wrapperConfig.editorAppConfig as EditorAppConfig;
        configClassic.editorOptions!['semanticHighlighting.enabled'] = false;

        const app = new EditorApp('config defaults', configClassic);
        expect(app.getConfig().editorOptions?.['semanticHighlighting.enabled']).toBeFalsy();
    });

    test('editorOptions: semanticHighlighting="configuredByTheme"', () => {
        const wrapperConfig = buildConfig();
        const configClassic = wrapperConfig.editorAppConfig as EditorAppConfig;
        configClassic.editorOptions!['semanticHighlighting.enabled'] = 'configuredByTheme';

        const app = new EditorApp('config defaults', configClassic);
        expect(app.getConfig().editorOptions?.['semanticHighlighting.enabled']).toEqual('configuredByTheme');
    });

    test('config defaults', () => {
        const editorAppConfig = createWrapperConfigClassicApp().editorAppConfig;
        const app = new EditorApp('config defaults', editorAppConfig as EditorAppConfig);
        expect(app.getConfig().codeResources?.main?.text).toEqual('');
        expect(app.getConfig().codeResources?.original).toBeUndefined();
        expect(app.getConfig().useDiffEditor ?? false).toBeFalsy();
        expect(app.getConfig().readOnly).toBeFalsy();
        expect(app.getConfig().domReadOnly).toBeFalsy();
    });

    test('verifyUrlorCreateDataUrl: url', () => {
        const url = new URL('./editorAppExtended.test.ts', import.meta.url);
        expect(verifyUrlOrCreateDataUrl(url)).toBe(url.href);
    });

    test('verifyUrlorCreateDataUrl: url', async () => {
        const url = new URL('../../../node_modules/langium-statemachine-dsl/syntaxes/statemachine.tmLanguage.json', window.location.href);
        const text = await (await fetch(url)).text();
        expect(verifyUrlOrCreateDataUrl(text)).toBe(`data:text/plain;base64,${btoa(text)}`);
    });

    test('config defaults', () => {
        const editorAppConfig = createWrapperConfigExtendedApp().editorAppConfig;
        const app = new EditorApp('config defaults', editorAppConfig);
        expect(app.getConfig().codeResources?.main?.text).toEqual('');
        expect(app.getConfig().codeResources?.original).toBeUndefined();
        expect(app.getConfig().useDiffEditor ?? false).toBeFalsy();
        expect(app.getConfig().readOnly).toBeFalsy();
        expect(app.getConfig().domReadOnly).toBeFalsy();
    });
});
