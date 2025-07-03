// Mock implementation of vscode for CLI builds
module.exports = {
	workspace: {
		name: "mock-workspace",
		workspaceFolders: [],
		getConfiguration: () => ({
			get: () => undefined,
			update: () => Promise.resolve(),
			has: () => false,
			inspect: () => undefined,
		}),
		createFileSystemWatcher: () => ({
			onDidChange: () => ({ dispose: () => {} }),
			onDidCreate: () => ({ dispose: () => {} }),
			onDidDelete: () => ({ dispose: () => {} }),
			dispose: () => {},
		}),
		onDidChangeConfiguration: () => ({ dispose: () => {} }),
		applyEdit: () => Promise.resolve(true),
		openTextDocument: () =>
			Promise.resolve({
				fileName: "mock-file.txt",
				getText: () => "",
				lineCount: 1,
				lineAt: () => ({ text: "", range: null }),
				save: () => Promise.resolve(true),
				uri: { fsPath: "/mock/path" },
			}),
	},
	window: {
		showErrorMessage: (msg) => console.error("VSCode Error:", msg),
		showWarningMessage: (msg) => console.warn("VSCode Warning:", msg),
		showInformationMessage: (msg) => console.info("VSCode Info:", msg),
		createOutputChannel: () => ({
			appendLine: () => {},
			append: () => {},
			show: () => {},
			hide: () => {},
			dispose: () => {},
		}),
		activeTextEditor: null,
		visibleTextEditors: [],
		onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
		onDidChangeVisibleTextEditors: () => ({ dispose: () => {} }),
		showTextDocument: () => Promise.resolve({}),
		createTerminal: () => ({
			show: () => {},
			hide: () => {},
			dispose: () => {},
			sendText: () => {},
			name: "mock-terminal",
		}),
		createTextEditorDecorationType: () => ({
			dispose: () => {},
		}),
	},
	commands: {
		registerCommand: () => ({ dispose: () => {} }),
		executeCommand: () => Promise.resolve(),
	},
	Uri: {
		file: (path) => ({ fsPath: path, scheme: "file", path }),
		parse: (uriString) => ({ fsPath: uriString, scheme: "file", path: uriString }),
	},
	Range: class MockRange {
		constructor(start, end) {
			this.start = start
			this.end = end
		}
	},
	Position: class MockPosition {
		constructor(line, character) {
			this.line = line
			this.character = character
		}
	},
	Selection: class MockSelection {
		constructor(start, end) {
			this.start = start
			this.end = end
		}
	},
	TextEdit: {
		replace: () => ({}),
		insert: () => ({}),
		delete: () => ({}),
	},
	WorkspaceEdit: class MockWorkspaceEdit {
		constructor() {
			this.edits = []
		}
		set() {}
		replace() {}
		insert() {}
		delete() {}
	},
	extensions: {
		getExtension: () => undefined,
		all: [],
	},
	env: {
		machineId: "mock-machine-id",
		sessionId: "mock-session-id",
		language: "en",
		clipboard: {
			readText: () => Promise.resolve(""),
			writeText: () => Promise.resolve(),
		},
	},
	version: "1.0.0",
}
