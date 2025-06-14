/* eslint-env node */
/* global module, require, process */
// Mock VSCode module for CLI context
// Enhanced for standalone executable compatibility

const os = require("os")
const path = require("path")

module.exports = {
	workspace: {
		getConfiguration: (section) => ({
			get: (key, defaultValue) => {
				// Return sensible defaults for CLI context
				if (section === "roo-cline" && key === "customStoragePath") {
					return path.join(os.homedir(), ".roo-cline")
				}
				return defaultValue
			},
			has: () => false,
			update: () => Promise.resolve(),
		}),
		fs: {
			readFile: () => Promise.reject(new Error("VSCode fs not available in CLI")),
			writeFile: () => Promise.reject(new Error("VSCode fs not available in CLI")),
			stat: () => Promise.reject(new Error("VSCode fs not available in CLI")),
			createDirectory: () => Promise.reject(new Error("VSCode fs not available in CLI")),
			delete: () => Promise.reject(new Error("VSCode fs not available in CLI")),
		},
		workspaceFolders: [],
		onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
		rootPath: process.cwd(),
	},
	window: {
		showInformationMessage: () => Promise.resolve(),
		showErrorMessage: () => Promise.resolve(),
		showInputBox: () => Promise.resolve(),
		showQuickPick: () => Promise.resolve(),
		createOutputChannel: () => ({
			appendLine: () => {},
			show: () => {},
			dispose: () => {},
		}),
		createTextEditorDecorationType: () => ({
			dispose: () => {},
		}),
		activeTextEditor: null,
		visibleTextEditors: [],
	},
	commands: {
		executeCommand: () => Promise.resolve(),
		registerCommand: () => ({ dispose: () => {} }),
	},
	env: {
		clipboard: {
			writeText: () => Promise.resolve(),
			readText: () => Promise.resolve(""),
		},
	},
	Uri: {
		file: (path) => ({ path }),
		parse: (uri) => ({ path: uri }),
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
		constructor(anchor, active) {
			this.anchor = anchor
			this.active = active
		}
	},
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
	ViewColumn: {
		One: 1,
		Two: 2,
		Three: 3,
	},
	TextEditorRevealType: {
		Default: 0,
		InCenter: 1,
		InCenterIfOutsideViewport: 2,
		AtTop: 3,
	},
	ExtensionContext: class MockExtensionContext {
		constructor() {
			this.globalState = {
				get: () => undefined,
				update: () => Promise.resolve(),
			}
			this.secrets = {
				get: () => Promise.resolve(),
				store: () => Promise.resolve(),
				delete: () => Promise.resolve(),
			}
			this.subscriptions = []
		}
	},
}
