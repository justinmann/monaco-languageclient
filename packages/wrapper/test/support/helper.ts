/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2024 TypeFox and others.
 * Licensed under the MIT License. See LICENSE in the package root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { createModelReference } from '@codingame/monaco-vscode-api/monaco';
import type { LanguageClientConfig, WrapperConfig } from 'monaco-editor-wrapper';
import { configureDefaultWorkerFactory } from 'monaco-editor-wrapper/workers/workerLoaders';

export const createMewModelReference = async () => {
    const uri = vscode.Uri.parse('/workspace/statemachineUri.statemachine');
    return await createModelReference(uri, 'text');
};

export const createMonacoEditorDiv = () => {
    const div = document.createElement('div');
    div.id = 'monaco-editor-root';
    document.body.insertAdjacentElement('beforeend', div);
    return div;
};

export const createWrapperConfigExtendedApp = (): WrapperConfig => {
    return {
        $type: 'extended',
        htmlContainer: createMonacoEditorDiv(),
        vscodeApiConfig: {
            loadThemes: false
        },
        editorAppConfig: {
            codeResources: {
                modified: {
                    text: '',
                    fileExt: 'js'
                }
            },
            monacoWorkerFactory: configureDefaultWorkerFactory
        }
    };
};

export const createDefaultLcWorkerConfig = (): LanguageClientConfig => {
    return {
        name: 'test-worker-direct',
        clientOptions: {
            documentSelector: ['javascript']
        },
        connection: {
            options: {
                $type: 'WorkerDirect',
                // create a web worker to pass to the wrapper
                worker: new Worker('./worker/langium-server.ts', {
                    type: 'module',
                    name: 'Langium LS'
                })
            }
        }
    };
};

export const createDefaultLcUnreachableUrlConfig = (): LanguageClientConfig => {
    return {
        name: 'test-ws-unreachable',
        clientOptions: {
            documentSelector: ['javascript']
        },
        connection: {
            options: {
                $type: 'WebSocketUrl',
                url: 'ws://localhost:12345/Tester'
            }
        }
    };
};

export const delayExecution = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
