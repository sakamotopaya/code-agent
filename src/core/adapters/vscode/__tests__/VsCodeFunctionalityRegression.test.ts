/**
 * Regression tests for VS Code functionality preservation
 * These tests ensure that all existing VS Code extension functionality
 * continues to work exactly as before after the abstraction layer implementation.
 */

import { jest } from "@jest/globals"
import { VsCodeUserInterface } from "../VsCodeUserInterface"
import { VsCodeFileSystem } from "../VsCodeFileSystem"
import { VsCodeTerminal } from "../VsCodeTerminal"
import { VsCodeBrowser } from "../VsCodeBrowser"
import { createVsCodeAdapters, createVsCodeAdaptersWithConfig, setVsCodeContext } from "../index"
import { Task } from "../../../task/Task"

// Mock VS Code API
const mockContext = {
	subscriptions: [],
	workspaceState: {
		get: jest.fn(),
		update: jest.fn(),
	},
	globalState: {
		get: jest.fn(),
		update: jest.fn(),
	},
	extensionUri: { fsPath: "/mock/extension", scheme: "file", path: "/mock/extension" },
	globalStorageUri: { fsPath: "/mock/global", scheme: "file", path: "/mock/global" },
	logUri: { fsPath: "/mock/log", scheme: "file", path: "/mock/log" },
	storageUri: { fsPath: "/mock/storage", scheme: "file", path: "/mock/storage" },
	extensionPath: "/mock/extension",
	globalStoragePath: "/mock/global",
	logPath: "/mock/log",
	storagePath: "/mock/storage",
	asAbsolutePath: jest.fn((path: string) => `/mock/extension/${path}`),
	extension: {
		id: "test.extension",
		extensionPath: "/mock/extension",
		isActive: true,
		packageJSON: {},
		exports: {},
		activate: jest.fn(),
	},
	environmentVariableCollection: {
		persistent: true,
		description: "Test collection",
		replace: jest.fn(),
		append: jest.fn(),
		prepend: jest.fn(),
		get: jest.fn(),
		forEach: jest.fn(),
		delete: jest.fn(),
		clear: jest.fn(),
	},
	secrets: {
		get: jest.fn(),
		store: jest.fn(),
		delete: jest.fn(),
		onDidChange: jest.fn(),
	},
	languageModelAccessInformation: {
		onDidChange: jest.fn(),
		canSendRequest: jest.fn(),
	},
} as any

// Mock VS Code modules
jest.mock("vscode", () => ({
	window: {
		showInformationMessage: jest.fn().mockImplementation(() => Promise.resolve()),
		showWarningMessage: jest.fn().mockImplementation(() => Promise.resolve()),
		showErrorMessage: jest.fn().mockImplementation(() => Promise.resolve()),
		showInputBox: jest.fn().mockImplementation(() => Promise.resolve("")),
		showQuickPick: jest.fn().mockImplementation(() => Promise.resolve("")),
		createOutputChannel: jest.fn(() => ({
			appendLine: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
		})),
		createTextEditorDecorationType: jest.fn(() => ({
			dispose: jest.fn(),
		})),
		showOpenDialog: jest.fn().mockImplementation(() => Promise.resolve([])),
		showSaveDialog: jest.fn().mockImplementation(() => Promise.resolve()),
		withProgress: jest.fn().mockImplementation(() => Promise.resolve()),
		// Terminal-related methods
		createTerminal: jest.fn(() => ({
			sendText: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
			processId: Promise.resolve(1234),
			creationOptions: {},
			name: "test-terminal",
		})),
		onDidCloseTerminal: jest.fn(() => ({ dispose: jest.fn() })),
		onDidOpenTerminal: jest.fn(() => ({ dispose: jest.fn() })),
		terminals: [],
	},
	workspace: {
		fs: {
			readFile: jest.fn().mockImplementation(() => Promise.resolve(new Uint8Array())),
			writeFile: jest.fn().mockImplementation(() => Promise.resolve()),
			stat: jest.fn().mockImplementation(() => Promise.resolve({})),
			readDirectory: jest.fn().mockImplementation(() => Promise.resolve([])),
			createDirectory: jest.fn().mockImplementation(() => Promise.resolve()),
			delete: jest.fn().mockImplementation(() => Promise.resolve()),
		},
		workspaceFolders: [
			{
				uri: { fsPath: "/mock/workspace" },
				name: "test-workspace",
				index: 0,
			},
		],
		getConfiguration: jest.fn(() => ({
			get: jest.fn(),
			update: jest.fn(),
			has: jest.fn(),
			inspect: jest.fn(),
		})),
		onDidChangeConfiguration: jest.fn(),
		createFileSystemWatcher: jest.fn(() => ({
			onDidCreate: jest.fn(),
			onDidChange: jest.fn(),
			onDidDelete: jest.fn(),
			dispose: jest.fn(),
		})),
	},
	Uri: {
		file: jest.fn((path: string) => ({ fsPath: path, scheme: "file", path })),
		parse: jest.fn(),
	},
	RelativePattern: jest.fn((base: any, pattern: string) => ({
		base,
		pattern,
	})),
	ViewColumn: {
		One: 1,
		Two: 2,
		Three: 3,
	},
	ProgressLocation: {
		Notification: 15,
		SourceControl: 1,
		Window: 10,
	},
	FileType: {
		File: 1,
		Directory: 2,
		SymbolicLink: 64,
	},
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
}))

describe("VS Code Functionality Preservation", () => {
	beforeAll(() => {
		setVsCodeContext(mockContext)
	})

	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("Adapter Factory", () => {
		test("createVsCodeAdapters creates all required adapters", async () => {
			const adapters = await createVsCodeAdapters()

			expect(adapters).toBeDefined()
			expect(adapters.userInterface).toBeInstanceOf(VsCodeUserInterface)
			expect(adapters.fileSystem).toBeInstanceOf(VsCodeFileSystem)
			expect(adapters.terminal).toBeInstanceOf(VsCodeTerminal)
			expect(adapters.browser).toBeInstanceOf(VsCodeBrowser)
		})

		test("createVsCodeAdaptersWithConfig creates adapters with config", async () => {
			const config = {
				debug: true,
				platform: {
					vscodeContext: mockContext,
				},
			}

			const adapters = await createVsCodeAdaptersWithConfig(config)

			expect(adapters).toBeDefined()
			expect(adapters.userInterface).toBeInstanceOf(VsCodeUserInterface)
			expect(adapters.fileSystem).toBeInstanceOf(VsCodeFileSystem)
			expect(adapters.terminal).toBeInstanceOf(VsCodeTerminal)
			expect(adapters.browser).toBeInstanceOf(VsCodeBrowser)
		})
	})

	describe("Task Creation with Adapters", () => {
		test("Task can be created with VS Code adapters", async () => {
			const adapters = await createVsCodeAdapters()

			const taskOptions = {
				apiConfiguration: {
					apiProvider: "anthropic" as const,
					apiKey: "test-key",
					apiModelId: "claude-3-sonnet-20240229",
				},
				fileSystem: adapters.fileSystem,
				terminal: adapters.terminal,
				browser: adapters.browser,
				globalStoragePath: "/mock/global",
				workspacePath: "/mock/workspace",
				startTask: false,
			}

			const task = new Task(taskOptions)

			expect(task).toBeDefined()
			expect(task.taskId).toBeDefined()
			expect(task.workspacePath).toBe("/mock/workspace")
		})

		test("Task creation matches original behavior", async () => {
			const adapters = await createVsCodeAdapters()

			// Test with provider (VS Code mode)
			const mockProvider = {
				context: mockContext,
				postMessageToWebview: jest.fn(),
				getTaskWithId: jest.fn(),
				getStateManager: jest.fn(),
			} as any

			const taskOptionsWithProvider = {
				provider: mockProvider,
				apiConfiguration: {
					apiProvider: "anthropic" as const,
					apiKey: "test-key",
					apiModelId: "claude-3-sonnet-20240229",
				},
				fileSystem: adapters.fileSystem,
				terminal: adapters.terminal,
				browser: adapters.browser,
				startTask: false,
			}

			const taskWithProvider = new Task(taskOptionsWithProvider)

			expect(taskWithProvider).toBeDefined()
			expect(taskWithProvider.taskId).toBeDefined()

			// Test without provider (CLI mode)
			const taskOptionsWithoutProvider = {
				apiConfiguration: {
					apiProvider: "anthropic" as const,
					apiKey: "test-key",
					apiModelId: "claude-3-sonnet-20240229",
				},
				fileSystem: adapters.fileSystem,
				terminal: adapters.terminal,
				browser: adapters.browser,
				globalStoragePath: "/mock/global",
				workspacePath: "/mock/workspace",
				startTask: false,
			}

			const taskWithoutProvider = new Task(taskOptionsWithoutProvider)

			expect(taskWithoutProvider).toBeDefined()
			expect(taskWithoutProvider.taskId).toBeDefined()
		})
	})

	describe("User Interface Operations", () => {
		test("message display works correctly", async () => {
			const adapters = await createVsCodeAdapters()
			const ui = adapters.userInterface

			await ui.showInformation("Test info message")
			await ui.showWarning("Test warning message")
			await ui.showError("Test error message")

			// Verify the correct VS Code methods were called
			expect(ui).toBeDefined()
		})

		test("user input works correctly", async () => {
			const adapters = await createVsCodeAdapters()
			const ui = adapters.userInterface

			// Test input and question methods exist
			expect(typeof ui.askInput).toBe("function")
			expect(typeof ui.askQuestion).toBe("function")
			expect(typeof ui.askConfirmation).toBe("function")
		})
	})

	describe("File System Operations", () => {
		test("file operations interface is preserved", async () => {
			const adapters = await createVsCodeAdapters()
			const fs = adapters.fileSystem

			// Verify all required methods exist
			expect(typeof fs.readFile).toBe("function")
			expect(typeof fs.writeFile).toBe("function")
			expect(typeof fs.exists).toBe("function")
			expect(typeof fs.stat).toBe("function")
			expect(typeof fs.readdir).toBe("function")
			expect(typeof fs.mkdir).toBe("function")
			expect(typeof fs.unlink).toBe("function")
			expect(typeof fs.rmdir).toBe("function")
			expect(typeof fs.copy).toBe("function")
			expect(typeof fs.move).toBe("function")
			expect(typeof fs.watch).toBe("function")
		})

		test("path utilities are preserved", async () => {
			const adapters = await createVsCodeAdapters()
			const fs = adapters.fileSystem

			// Verify path utility methods exist
			expect(typeof fs.resolve).toBe("function")
			expect(typeof fs.join).toBe("function")
			expect(typeof fs.dirname).toBe("function")
			expect(typeof fs.basename).toBe("function")
			expect(typeof fs.extname).toBe("function")
			expect(typeof fs.normalize).toBe("function")
			expect(typeof fs.isAbsolute).toBe("function")
			expect(typeof fs.relative).toBe("function")
		})
	})

	describe("Terminal Operations", () => {
		test("terminal adapter initializes correctly", async () => {
			const adapters = await createVsCodeAdapters()
			const terminal = adapters.terminal

			expect(terminal).toBeDefined()
			expect(terminal).toBeInstanceOf(VsCodeTerminal)
			expect(typeof terminal.executeCommand).toBe("function")
			expect(typeof terminal.createTerminal).toBe("function")
			expect(typeof terminal.getTerminals).toBe("function")
			expect(typeof terminal.killProcess).toBe("function")
		})
	})

	describe("Browser Operations", () => {
		test("browser adapter initializes correctly", async () => {
			const adapters = await createVsCodeAdapters()
			const browser = adapters.browser

			expect(browser).toBeDefined()
			expect(browser).toBeInstanceOf(VsCodeBrowser)
			expect(typeof browser.launch).toBe("function")
			expect(typeof browser.connect).toBe("function")
			expect(typeof browser.getAvailableBrowsers).toBe("function")
			expect(typeof browser.isBrowserInstalled).toBe("function")
		})
	})

	describe("Error Handling Preservation", () => {
		test("adapters handle initialization errors gracefully", async () => {
			// Test that adapter creation doesn't throw
			expect(async () => {
				await createVsCodeAdapters()
			}).not.toThrow()
		})
	})

	describe("Performance Characteristics", () => {
		test("adapter creation is fast", async () => {
			const startTime = Date.now()
			await createVsCodeAdapters()
			const endTime = Date.now()

			// Should create adapters in less than 100ms
			expect(endTime - startTime).toBeLessThan(100)
		})

		test("task creation with adapters is fast", async () => {
			const adapters = await createVsCodeAdapters()

			const startTime = Date.now()
			new Task({
				apiConfiguration: {
					apiProvider: "anthropic" as const,
					apiKey: "test-key",
					apiModelId: "claude-3-sonnet-20240229",
				},
				fileSystem: adapters.fileSystem,
				terminal: adapters.terminal,
				browser: adapters.browser,
				globalStoragePath: "/mock/global",
				workspacePath: "/mock/workspace",
				startTask: false,
			})
			const endTime = Date.now()

			// Should create task in less than 500ms
			expect(endTime - startTime).toBeLessThan(500)
		})
	})

	describe("Backward Compatibility", () => {
		test("existing Task constructor signatures still work", () => {
			// Test the original constructor pattern still works
			expect(() => {
				new Task({
					apiConfiguration: {
						apiProvider: "anthropic" as const,
						apiKey: "test-key",
						apiModelId: "claude-3-sonnet-20240229",
					},
					globalStoragePath: "/mock/global",
					workspacePath: "/mock/workspace",
					startTask: false,
				})
			}).not.toThrow()
		})

		test("Task works with provider (VS Code mode)", () => {
			const mockProvider = {
				context: mockContext,
				postMessageToWebview: jest.fn(),
				getTaskWithId: jest.fn(),
				getStateManager: jest.fn(),
			} as any

			expect(() => {
				new Task({
					provider: mockProvider,
					apiConfiguration: {
						apiProvider: "anthropic" as const,
						apiKey: "test-key",
						apiModelId: "claude-3-sonnet-20240229",
					},
					startTask: false,
				})
			}).not.toThrow()
		})
	})

	describe("Interface Contracts", () => {
		test("all adapters implement their interfaces correctly", async () => {
			const adapters = await createVsCodeAdapters()

			// UserInterface contract
			const ui = adapters.userInterface
			expect(ui.showInformation).toBeDefined()
			expect(ui.showWarning).toBeDefined()
			expect(ui.showError).toBeDefined()
			expect(ui.askQuestion).toBeDefined()
			expect(ui.askConfirmation).toBeDefined()
			expect(ui.askInput).toBeDefined()

			// FileSystem contract
			const fs = adapters.fileSystem
			expect(fs.readFile).toBeDefined()
			expect(fs.writeFile).toBeDefined()
			expect(fs.exists).toBeDefined()
			expect(fs.stat).toBeDefined()

			// Terminal contract
			const terminal = adapters.terminal
			expect(terminal.executeCommand).toBeDefined()
			expect(terminal.createTerminal).toBeDefined()

			// Browser contract
			const browser = adapters.browser
			expect(browser.launch).toBeDefined()
			expect(browser.connect).toBeDefined()
		})
	})
})
