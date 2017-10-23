/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import { ExtensionContext, window, workspace, WorkspaceFolder, commands, debug, Terminal, languages, CompletionItem, CompletionItemKind, Task, TaskDefinition, Disposable, ShellExecution, ProcessExecution, InputBoxOptions } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let term: Terminal = null;

let extPath: string;
let taskProvider: Disposable | undefined;

export function activate(context: ExtensionContext) {

    extPath = context.extensionPath;

    // Register commands
    context.subscriptions.push(commands.registerCommand('dokd.initWorkspace', () => initWorkspace()));
    context.subscriptions.push(commands.registerCommand('dokd.restoreModules', () => restoreModules()));
    context.subscriptions.push(commands.registerCommand('dokd.buildAll', () => buildAll()));
    context.subscriptions.push(commands.registerCommand('dokd.newCollection', () => newCollection()));

    // Trap terminal closure event to clean up terminal reference
    if ('onDidCloseTerminal' in <any>window) {
        
        (<any>window).onDidCloseTerminal((terminal: Terminal) => {

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
    taskProvider = workspace.registerTaskProvider('dokd', {
		provideTasks: () => {
			return getTasks();
		},
		resolveTask(_task: Task): Task | undefined {
			return undefined;
		}
	});
}

function getCompletionItems(): CompletionItem[] {

    // const sectionCompletion = new CompletionItem('Section').insertText = "Section {\r\n}"

    return [
        new CompletionItem('document'),
        new CompletionItem('Section'),
        new CompletionItem('Table')
    ];
}

// Implementation to call module command
function initWorkspace(): void {

    if (workspace == null) {
        return;
    }

    let t = getTerminal();

    t.sendText(`Initialize-DOKDsc;`, true);
    t.show();
}

// Implementation to restore modules from a DOK Dsc workspace
function restoreModules(): void {

    if (workspace == null) {
        return;
    }
    
    let t = getTerminal();

    t.sendText(`Restore-DOKDscModule;`, true);
    t.show();
}

function buildAll(): void {
    
    if (workspace == null) {
        return;
    }

    let t = getTerminal();

    t.sendText(`Invoke-DOKDscBuild;`, true);
    t.show();
}

function newCollection(): void {

    if (workspace == null) {
        return;
    }

    window
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
function getTerminal(): Terminal {

    if (term == null) {
        const scriptPath = path.join(extPath, "/scripts/terminalStartup.ps1");        
        term = window.createTerminal("DOK Dsc", "PowerShell.exe", [ "-NoExit", "-File", scriptPath ]);
    }

    return term;
}

// Define a configuration build task
interface DOKDscBuildTaskDefinition extends TaskDefinition {
	collectionName: string;
	path?: string;
}

// Define a workspace configuratuin
class DOKDscWorkspaceCollection {
    name: string
}

// Define settings for a workspace
class DOKDscWorkspaceSetting {
    collections: DOKDscWorkspaceCollection[]
}

function isEnabled(folder: WorkspaceFolder): boolean {
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
async function getTasks(): Promise<Task[]> {

    let emptyTasks: Task[] = [];
	let folders = workspace.workspaceFolders;

	if (!folders) {
		return emptyTasks;
	}

    let result: Task[] = [];

    for (let i = 0; i < folders.length; i++) {
		if (isEnabled(folders[i])) {
			let tasks = await getWorkspaceTasks(folders[i]);
			result.push(...tasks);
		}
    }
    
	return result;
}

async function getWorkspaceTasks(folder: WorkspaceFolder): Promise<Task[]> {
	let emptyTasks: Task[] = [];

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

        const result: Task[] = [];

        let workspace: DOKDscWorkspaceSetting = Object.assign(new DOKDscWorkspaceSetting(), JSON.parse(contents));

        workspace.collections.forEach(each => {

            // Create a task for each of the discovered configuration
            const task = createBuildTask(each.name, rootPath, folder, [ ]);
            
            // const lowerCaseTaskName = each.name.toLowerCase();

            result.push(task);
        });
        
        return result;
        
	} catch (e) {
		return emptyTasks;
	}
}

// Create a build task instance
function createBuildTask(collectionName: string, rootPath: string, folder: WorkspaceFolder, matcher?: any): Task {

	function getTaskName(collectionName: string) {
		return `Build collection ${collectionName}`;
	}

	function getDOKCommandLine(folder: WorkspaceFolder): string {
		return `Invoke-DOKDscBuild -WorkspacePath '${folder.uri.fsPath}' -Name '${collectionName}';`;
	}

	let kind: DOKDscBuildTaskDefinition = {
        type: 'dokd',
        collectionName: collectionName
    };
    
    let taskName = getTaskName(collectionName);
    
    // Return the task instance
	return new Task(
        kind,
        taskName,
        'DOK Dsc',
        new ShellExecution(getDOKCommandLine(folder), { cwd: rootPath }),
        matcher
    );
}