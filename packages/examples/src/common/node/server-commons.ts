/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2024 TypeFox and others.
 * Licensed under the MIT License. See LICENSE in the package root for license information.
 * ------------------------------------------------------------------------------------------ */
import { WebSocketServer, type ServerOptions } from 'ws';
import { IncomingMessage, Server } from 'node:http';
import { URL } from 'node:url';
import { Socket } from 'node:net';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cp from 'node:child_process';
import {
    type IWebSocket,
    WebSocketMessageReader,
    WebSocketMessageWriter,
} from 'vscode-ws-jsonrpc';
import {
    createConnection,
    createServerProcess,
    forward,
} from 'vscode-ws-jsonrpc/server';
import {
    Message,
    InitializeRequest,
    type InitializeParams,
    type RequestMessage,
    type ResponseMessage,
} from 'vscode-languageserver-protocol';
import * as fs from 'node:fs';

export enum LanguageName {
    /** https://nodejs.org/api/cli.html  */
    node = 'node',
    /** https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html */
    java = 'java',
}

export interface LanguageServerRunConfig {
    serverName: string;
    pathName: string;
    serverPort: number;
    runCommand: LanguageName | string;
    runCommandArgs: string[];
    wsServerOptions: ServerOptions;
    spawnOptions?: cp.SpawnOptions;
    logMessages?: boolean;
    requestMessageHandler?: (message: RequestMessage) => RequestMessage;
    responseMessageHandler?: (message: ResponseMessage) => ResponseMessage;
}

/**
 * start the language server inside the current process
 */
export const launchLanguageServer = (
    runconfig: LanguageServerRunConfig,
    socket: IWebSocket,
) => {
    const { serverName, runCommand, runCommandArgs, spawnOptions } = runconfig;
    // start the language server as an external process
    const reader = new WebSocketMessageReader(socket);
    const writer = new WebSocketMessageWriter(socket);
    const socketConnection = createConnection(reader, writer, () =>
        socket.dispose(),
    );
    const serverConnection = createServerProcess(
        serverName,
        runCommand,
        runCommandArgs,
        spawnOptions,
    );
    if (serverConnection !== undefined) {
        forward(socketConnection, serverConnection, (message) => {
            if (Message.isRequest(message)) {
                if (message.method === 'fileSync') {
                    const fileSyncParams = message.params as {
                        path: string[];
                        text: string;
                        updated: number;
                    };

                    try {
                        const path = `/${fileSyncParams.path.join('/')}`;
                        if (fs.existsSync(path)) {
                            const mtime = fs.statSync(path).mtimeMs;
                            if (fileSyncParams.updated >= mtime) {
                                fs.writeFileSync(path, fileSyncParams.text);
                                fs.utimesSync(
                                    path,
                                    new Date(fileSyncParams.updated),
                                    new Date(fileSyncParams.updated),
                                );
                            }
                        } else {
                            const pathParent = `/${fileSyncParams.path
                                .slice(0, -1)
                                .join('/')}`;
                            fs.mkdirSync(pathParent, { recursive: true });
                            fs.writeFileSync(path, fileSyncParams.text);
                        }
                    } catch (error) {
                        console.error(
                            '[FILE] cannot update',
                            fileSyncParams,
                            error,
                        );
                    }

                    return message;
                }

                if (message.method === 'fileDelete') {
                    const fileDeleteParams = message.params as {
                        path: string[];
                    };

                    try {
                        const path = `/${fileDeleteParams.path.join('/')}`;
                        fs.rmSync(path, { recursive: true });
                        return message;
                    } catch (error) {
                        console.error(
                            '[FILE] cannot delete',
                            fileDeleteParams,
                            error,
                        );
                    }
                }

                if (message.method === 'pipInstall') {
                    const pipInstallParams = message.params as {
                        path: string[];
                    };

                    try {
                        const path = `/${pipInstallParams.path.join('/')}`;
                        cp.execSync(`python -m venv ${path}/venv`);
                        cp.execSync(
                            `${path}/venv/bin/python -m pip install -r requirements.txt`,
                            { cwd: path },
                        );
                    } catch (error) {
                        console.error(
                            '[FILE] cannot pip install',
                            pipInstallParams,
                            error,
                        );
                    }
                    return message;
                }

                if (message.method === InitializeRequest.type.method) {
                    const initializeParams = message.params as InitializeParams;
                    initializeParams.processId = process.pid;
                }

                if (runconfig.logMessages ?? false) {
                    console.log(
                        `${serverName} Server received: ${message.method}`,
                    );
                    console.log(message);
                }
                if (runconfig.requestMessageHandler !== undefined) {
                    return runconfig.requestMessageHandler(message);
                }
            }
            if (Message.isResponse(message)) {
                if (runconfig.logMessages ?? false) {
                    console.log(`${serverName} Server sent:`);
                    console.log(message);
                }
                if (runconfig.responseMessageHandler !== undefined) {
                    return runconfig.responseMessageHandler(message);
                }
            }
            return message;
        });
    }
};

export const upgradeWsServer = (
    runconfig: LanguageServerRunConfig,
    config: {
        server: Server;
        wss: WebSocketServer;
    },
) => {
    config.server.on(
        'upgrade',
        (request: IncomingMessage, socket: Socket, head: Buffer) => {
            const baseURL = `http://${request.headers.host}/`;
            const pathName =
                request.url !== undefined
                    ? new URL(request.url, baseURL).pathname
                    : undefined;
            if (pathName === runconfig.pathName) {
                config.wss.handleUpgrade(request, socket, head, (webSocket) => {
                    const socket: IWebSocket = {
                        send: (content) =>
                            webSocket.send(content, (error) => {
                                if (error) {
                                    throw error;
                                }
                            }),
                        onMessage: (cb) =>
                            webSocket.on('message', (data) => {
                                cb(data);
                            }),
                        onError: (cb) => webSocket.on('error', cb),
                        onClose: (cb) => webSocket.on('close', cb),
                        dispose: () => webSocket.close(),
                    };
                    // launch the server when the web socket is opened
                    if (webSocket.readyState === webSocket.OPEN) {
                        launchLanguageServer(runconfig, socket);
                    } else {
                        webSocket.on('open', () => {
                            launchLanguageServer(runconfig, socket);
                        });
                    }
                });
            }
        },
    );
};

/**
 * Solves: __dirname is not defined in ES module scope
 */
export const getLocalDirectory = (referenceUrl: string | URL) => {
    const __filename = fileURLToPath(referenceUrl);
    return dirname(__filename);
};
