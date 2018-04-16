/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
//import { ExtensionContext, window, workspace, WorkspaceFolder, commands, debug, Terminal, languages, CompletionItem, CompletionItemKind, Task, TaskDefinition, Disposable, ShellExecution, ProcessExecution, InputBoxOptions } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let term: vscode.Terminal = null;

let extPath: string;
let taskProvider: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {

    extPath = context.extensionPath;

    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('dokd.initWorkspace', () => initWorkspace()));
    context.subscriptions.push(vscode.commands.registerCommand('dokd.restoreModules', () => restoreModules()));
    context.subscriptions.push(vscode.commands.registerCommand('dokd.buildAll', () => buildAll()));
    context.subscriptions.push(vscode.commands.registerCommand('dokd.newCollection', () => newCollection()));

    // Trap terminal closure event to clean up terminal reference
    if ('onDidCloseTerminal' in <any>vscode.window) {
        
        (<any>vscode.window).onDidCloseTerminal((terminal: vscode.Terminal) => {

            // If the terminal process is our terminal then clean up the reference
            if (terminal.processId == term.processId) {
                term = null;
            }
        });
    }

    // Register auto-completion items
	// languages.registerCompletionItemProvider('powershell', {
	// 	provideCompletionItems() {
	// 		return getCompletionItems();
	// 	}
    // });
    
    // Register DOK Dsc task provider
    taskProvider = vscode.workspace.registerTaskProvider('dokd', {
		provideTasks: () => {
			return getTasks();
		},
		resolveTask(_task: vscode.Task): vscode.Task | undefined {
			return undefined;
		}
	});
}

function getCompletionItems(): vscode.CompletionItem[] {

    // const sectionCompletion = new CompletionItem('Section').insertText = "Section {\r\n}"

    return [
        new vscode.CompletionItem('document'),
        new vscode.CompletionItem('Section'),
        new vscode.CompletionItem('Table')
    ];
}

// Implementation to call module command
function initWorkspace(): void {

    if (vscode.workspace == null) {
        return;
    }

    let t = getTerminal();

    t.sendText(`Initialize-DOKDsc;`, true);
    t.show();
}

// Implementation to restore modules from a DOK Dsc workspace
function restoreModules(): void {

    if (vscode.workspace == null) {
        return;
    }
    
    let t = getTerminal();

    t.sendText(`Restore-DOKDscModule;`, true);
    t.show();
}

function buildAll(): void {
    
    if (vscode.workspace == null) {
        return;
    }

    let t = getTerminal();

    // launchTests(`Invoke-DOKDscBuild`, ``, false);

    t.sendText(`Invoke-DOKDscBuild;`, true);
    t.show();
}

function newCollection(): void {

    if (vscode.workspace == null) {
        return;
    }

    vscode.window
        .showInputBox({ prompt: "Enter the collection name", placeHolder: "Type the name of the collection to create" })
        .then(response => {

            if (response != undefined) {
                let t = getTerminal();
                t.sendText(`New-DOKDscCollection -Name '${response}';`, true);
                t.show();
            }
        });
}

// Get an existing terminal instance or create a new one
function getTerminal(): vscode.Terminal {

    if (term == null) {
        const scriptPath = path.join(extPath, "/scripts/terminalStartup.ps1");        
        term = vscode.window.createTerminal("DOK Dsc", "PowerShell.exe", [ "-NoExit", "-File", scriptPath ]);
    }

    return term;
}

function launchTests(cmd, uriString, runInDebugger, describeBlockName?) {
    // var uri = vscode.Uri.parse(uriString);
    let currentDocument = vscode.window.activeTextEditor.document;

    //args: [
    //     `-Script "${uri.fsPath}"`,
    //     describeBlockName
    //         ? `-TestName '${describeBlockName}'`
    //         : ""
    // ],

    let launchConfig = {
        request: "launch",
        type: "PowerShell",
        name: "PowerShell Launch Pester Tests",
        script: cmd,
        args: [
            
        ],
        internalConsoleOptions: "neverOpen",
        noDebug: !runInDebugger,
        cwd:
            currentDocument.isUntitled
                ? vscode.workspace.rootPath
                : currentDocument.fileName
    }

    // Create or show the interactive console
    vscode.commands.executeCommand('PowerShell.ShowSessionConsole', true);

    // Write out temporary debug session file
    // utils.writeSessionFile(
    //     utils.getDebugSessionFilePath(),
    //     this.sessionManager.getSessionDetails());

    // TODO: Update to handle multiple root workspaces.
    vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], launchConfig);
}

// Define a collection publish task
interface DOKDscPublishTaskDefinition extends vscode.TaskDefinition {
	collectionName: string;
	path?: string;
}

// Define a collection build task
interface DOKDscBuildTaskDefinition extends vscode.TaskDefinition {
	collectionName: string;
    path?: string;
    force: boolean;
}

// Define a workspace collection
class DOKDscWorkspaceCollection {
    name: string
}

// Define settings for a workspace
class DOKDscWorkspaceSetting {
    collections: DOKDscWorkspaceCollection[]
}

function isEnabled(folder: vscode.WorkspaceFolder): boolean {
	return true;
}

async function exists(file: string): Promise<boolean> {
	return new Promise<boolean>((resolve, _reject) => {
		fs.exists(file, (value) => {
			resolve(value);
		});
	});
}

async function readFile(file: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		fs.readFile(file, (err, data) => {
			if (err) {
				reject(err);
			}
			resolve(data.toString());
		});
	});
}

// Get tasks for the workspace
async function getTasks(): Promise<vscode.Task[]> {

    let emptyTasks: vscode.Task[] = [];
	let folders = vscode.workspace.workspaceFolders;

	if (!folders) {
		return emptyTasks;
	}

    let result: vscode.Task[] = [];

    for (let i = 0; i < folders.length; i++) {
		if (isEnabled(folders[i])) {
			let tasks = await getWorkspaceTasks(folders[i]);
			result.push(...tasks);
		}
    }
    
	return result;
}

async function getWorkspaceTasks(folder: vscode.WorkspaceFolder): Promise<vscode.Task[]> {
	let emptyTasks: vscode.Task[] = [];

	if (folder.uri.scheme !== 'file') {
		return emptyTasks;
    }
    
	let rootPath = folder.uri.fsPath;

    let settingsJson = path.join(rootPath, '.dokd', 'settings.json');
    
	if (!await exists(settingsJson)) {
		return emptyTasks;
	}

	try {
		var contents = await readFile(settingsJson);
        var json = JSON.parse(contents);
        
		if (!json.collections) {
			return emptyTasks;
		}

        const result: vscode.Task[] = [];

        let workspace: DOKDscWorkspaceSetting = Object.assign(new DOKDscWorkspaceSetting(), JSON.parse(contents));

        workspace.collections.forEach(each => {

            // Create an incremental task for each of the discovered collections
            const taskBuildInc = createBuildTask(each.name, false, rootPath, folder, [ ]);
            result.push(taskBuildInc);

            // Create a full task for each of the discovered collections
            const taskBuildFull = createBuildTask(each.name, true, rootPath, folder, [ ]);
            result.push(taskBuildFull);

            // Create a publish task for each of the discovered collections
            const taskPackage = createPublishTask(each.name, rootPath, folder, [ ]);
            result.push(taskPackage);
        });

        // Create all build task
        // const task = createBuildTask("(All)", rootPath, folder, [ ]);
        // result.push(task);
        
        return result;
        
	} catch (e) {
		return emptyTasks;
	}
}

// Create a package collection task instance
function createPublishTask(collectionName: string, rootPath: string, folder: vscode.WorkspaceFolder, matcher?: any): vscode.Task {

	function getTaskName(collectionName: string) {
		return `Publish collection ${collectionName}`;
	}

	function getDOKCommandLine(folder: vscode.WorkspaceFolder): string {
		return `Publish-DOKDscCollection -WorkspacePath '${folder.uri.fsPath}' -Name '${collectionName}';`;
	}

	let kind: DOKDscPublishTaskDefinition = {
        type: 'dokd',
        collectionName: collectionName
    };
    
    let taskName = getTaskName(collectionName);
    
    // Return the task instance
	return new vscode.Task(
        kind,
        taskName,
        'DOK Dsc',
        new vscode.ShellExecution(getDOKCommandLine(folder), { cwd: rootPath }),
        matcher
    );
}

// Create a build collection task instance
function createBuildTask(collectionName: string, force: boolean, rootPath: string, folder: vscode.WorkspaceFolder, matcher?: any): vscode.Task {

	function getTaskName(collectionName: string) {

        if (force) {
            return `Build collection ${collectionName} (Full)`;
        } else {
            return `Build collection ${collectionName}`;
        }
	}

	function getDOKCommandLine(folder: vscode.WorkspaceFolder, collectionName: string, force: boolean): string {

        if (force) {
            return `Invoke-DOKDscBuild -WorkspacePath '${folder.uri.fsPath}' -Name '${collectionName}' -Force;`;
        } else {
            return `Invoke-DOKDscBuild -WorkspacePath '${folder.uri.fsPath}' -Name '${collectionName}';`;
        }
	}

	let kind: DOKDscBuildTaskDefinition = {
        type: 'dokd',
        collectionName: collectionName,
        force: force
    };
    
    let taskName = getTaskName(collectionName);
    
    // Return the task instance
	return new vscode.Task(
        kind,
        taskName,
        'DOK Dsc',
        new vscode.ShellExecution(getDOKCommandLine(folder, collectionName, force), { cwd: rootPath }),
        matcher
    );
}