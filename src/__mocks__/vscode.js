// Mock VSCode API for Jest tests
const vscode = {
	// Common constants
	ExtensionContext: {},
	Uri: {
		file: jest.fn().mockImplementation((path) => ({ path, scheme: "file" })),
		parse: jest.fn().mockImplementation((uri) => ({ path: uri, scheme: "file" })),
	},

	// Window namespace
	window: {
		showInformationMessage: jest.fn(),
		showWarningMessage: jest.fn(),
		showErrorMessage: jest.fn(),
		showQuickPick: jest.fn(),
		showInputBox: jest.fn(),
		createTerminal: jest.fn(),
		activeTerminal: null,
		terminals: [],
		createOutputChannel: jest.fn().mockReturnValue({
			append: jest.fn(),
			appendLine: jest.fn(),
			clear: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
		}),
		withProgress: jest.fn().mockImplementation((options, task) => task()),
	},

	// Workspace namespace
	workspace: {
		getConfiguration: jest.fn().mockReturnValue({
			get: jest.fn(),
			update: jest.fn(),
			has: jest.fn(),
		}),
		workspaceFolders: [],
		onDidChangeConfiguration: jest.fn(),
		openTextDocument: jest.fn(),
		saveAll: jest.fn(),
	},

	// Commands namespace
	commands: {
		registerCommand: jest.fn(),
		executeCommand: jest.fn(),
	},

	// Languages namespace
	languages: {
		registerCodeActionsProvider: jest.fn(),
		createDiagnosticCollection: jest.fn().mockReturnValue({
			set: jest.fn(),
			delete: jest.fn(),
			clear: jest.fn(),
			dispose: jest.fn(),
		}),
	},

	// Enums and constants
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},

	ViewColumn: {
		One: 1,
		Two: 2,
		Three: 3,
		Active: -1,
		Beside: -2,
	},

	StatusBarAlignment: {
		Left: 1,
		Right: 2,
	},

	// Progress location
	ProgressLocation: {
		SourceControl: 1,
		Window: 10,
		Notification: 15,
	},

	// Disposable
	Disposable: jest.fn().mockImplementation(() => ({
		dispose: jest.fn(),
	})),

	// Event emitter
	EventEmitter: jest.fn().mockImplementation(() => ({
		event: jest.fn(),
		fire: jest.fn(),
		dispose: jest.fn(),
	})),
}

module.exports = vscode
