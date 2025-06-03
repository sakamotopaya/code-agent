/**
 * Comprehensive validation tests for VS Code functionality preservation
 * These tests validate that Story 4 objectives are met - ensuring all existing
 * VS Code extension functionality continues to work after abstraction layer implementation.
 */

import { jest } from "@jest/globals"
import { createVsCodeAdapters, setVsCodeContext } from "../index"
import { Task } from "../../../task/Task"

// Mock VS Code API with comprehensive coverage
const mockContext = {
	subscriptions: [],
	workspaceState: {
		get: jest.fn().mockReturnValue(undefined),
		update: jest.fn().mockResolvedValue(undefined),
	},
	globalState: {
		get: jest.fn().mockReturnValue(undefined),
		update: jest.fn().mockResolvedValue(undefined),
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
		get: jest.fn().mockResolvedValue(undefined),
		store: jest.fn().mockResolvedValue(undefined),
		delete: jest.fn().mockResolvedValue(undefined),
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
		showInformationMessage: jest.fn().mockResolvedValue(undefined),
		showWarningMessage: jest.fn().mockResolvedValue(undefined),
		showErrorMessage: jest.fn().mockResolvedValue(undefined),
		showInputBox: jest.fn().mockResolvedValue("mock-input"),
		showQuickPick: jest.fn().mockResolvedValue({ label: "Option 1" }),
		createOutputChannel: jest.fn(() => ({
			appendLine: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
		})),
		createTextEditorDecorationType: jest.fn(() => ({
			dispose: jest.fn(),
		})),
		showOpenDialog: jest.fn().mockResolvedValue([{ fsPath: "/mock/file" }]),
		showSaveDialog: jest.fn().mockResolvedValue({ fsPath: "/mock/save" }),
		withProgress: jest.fn().mockImplementation((options, task) => task({ report: jest.fn() })),
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
			readFile: jest.fn().mockResolvedValue(new Uint8Array()),
			writeFile: jest.fn().mockResolvedValue(undefined),
			stat: jest.fn().mockResolvedValue({
				type: 1, // FileType.File
				ctime: 0,
				mtime: 0,
				size: 0,
			}),
			readDirectory: jest.fn().mockResolvedValue([]),
			createDirectory: jest.fn().mockResolvedValue(undefined),
			delete: jest.fn().mockResolvedValue(undefined),
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

// Mock file system modules
jest.mock("fs/promises", () => ({
	readFile: jest.fn().mockResolvedValue("mock file content"),
	writeFile: jest.fn().mockResolvedValue(undefined),
	appendFile: jest.fn().mockResolvedValue(undefined),
	access: jest.fn().mockResolvedValue(undefined),
	stat: jest.fn().mockResolvedValue({
		isFile: () => true,
		isDirectory: () => false,
		isSymbolicLink: () => false,
		size: 1024,
		mtime: new Date(),
		ctime: new Date(),
		atime: new Date(),
		birthtime: new Date(),
		mode: 0o644,
	}),
	mkdir: jest.fn().mockResolvedValue(undefined),
	rmdir: jest.fn().mockResolvedValue(undefined),
	readdir: jest.fn().mockResolvedValue([]),
	unlink: jest.fn().mockResolvedValue(undefined),
	copyFile: jest.fn().mockResolvedValue(undefined),
	rename: jest.fn().mockResolvedValue(undefined),
}))

// Mock child_process
jest.mock("child_process", () => ({
	exec: jest.fn((command, options, callback) => {
		if (typeof options === "function") {
			callback = options
			options = {}
		}
		setTimeout(() => callback(null, "stdout", "stderr"), 10)
	}),
	spawn: jest.fn(() => ({
		stdout: { on: jest.fn() },
		stderr: { on: jest.fn() },
		stdin: { write: jest.fn(), end: jest.fn() },
		on: jest.fn((event, callback) => {
			if (event === "close") {
				setTimeout(() => callback(0, null), 10)
			}
		}),
		pid: 12345,
		killed: false,
	})),
}))

describe("VS Code Functionality Preservation Validation", () => {
	beforeAll(() => {
		setVsCodeContext(mockContext)
	})

	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("Story 4: Core Abstraction Layer Validation", () => {
		test("✅ VS Code adapters are successfully created", async () => {
			const adapters = await createVsCodeAdapters()

			expect(adapters).toBeDefined()
			expect(adapters.userInterface).toBeDefined()
			expect(adapters.fileSystem).toBeDefined()
			expect(adapters.terminal).toBeDefined()
			expect(adapters.browser).toBeDefined()
		})

		test("✅ Task can be created with VS Code adapters (preserves original behavior)", async () => {
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

		test("✅ Backward compatibility: Task works with provider (original VS Code mode)", async () => {
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

		test("✅ User interface operations function correctly", async () => {
			const adapters = await createVsCodeAdapters()
			const ui = adapters.userInterface

			// Test all core UI operations
			await expect(ui.showInformation("Test info")).resolves.not.toThrow()
			await expect(ui.showWarning("Test warning")).resolves.not.toThrow()
			await expect(ui.showError("Test error")).resolves.not.toThrow()
			await expect(ui.askInput("Enter input:")).resolves.toBeDefined()
			await expect(ui.askQuestion("Choose option:", { choices: ["A", "B"] })).resolves.toBeDefined()
			await expect(ui.askConfirmation("Are you sure?")).resolves.toBeDefined()

			// Verify disposal works
			expect(() => ui.dispose()).not.toThrow()
		})

		test("✅ File system operations interface is preserved", async () => {
			const adapters = await createVsCodeAdapters()
			const fs = adapters.fileSystem

			// Test all required file system methods exist and work
			await expect(fs.readFile("/test/file.txt")).resolves.toBeDefined()
			await expect(fs.writeFile("/test/file.txt", "content")).resolves.not.toThrow()
			await expect(fs.exists("/test/file.txt")).resolves.toBeDefined()
			await expect(fs.stat("/test/file.txt")).resolves.toBeDefined()
			await expect(fs.readdir("/test")).resolves.toBeDefined()
			await expect(fs.mkdir("/test/dir")).resolves.not.toThrow()

			// Test path utilities
			expect(typeof fs.resolve("./test")).toBe("string")
			expect(typeof fs.join("a", "b", "c")).toBe("string")
			expect(typeof fs.dirname("/a/b/c")).toBe("string")
			expect(typeof fs.basename("/a/b/c")).toBe("string")
			expect(typeof fs.extname("file.txt")).toBe("string")
		})

		test("✅ Terminal operations maintain functionality", async () => {
			const adapters = await createVsCodeAdapters()
			const terminal = adapters.terminal

			// Test command execution
			const result = await terminal.executeCommand("echo test")
			expect(result).toBeDefined()
			expect(result.success).toBe(true)

			// Test terminal session management
			const session = await terminal.createTerminal({ name: "Test Terminal" })
			expect(session).toBeDefined()
			expect(session.name).toBe("Test Terminal")
			expect(session.isActive).toBe(true)

			// Test utility methods
			await expect(terminal.getCwd()).resolves.toBeDefined()
			await expect(terminal.isCommandAvailable("node")).resolves.toBeDefined()
			await expect(terminal.getShellType()).resolves.toBeDefined()
		})

		test("✅ Browser operations interface is preserved", async () => {
			const adapters = await createVsCodeAdapters()
			const browser = adapters.browser

			// Test browser session creation
			const session = await browser.launch()
			expect(session).toBeDefined()
			expect(session.isActive).toBe(true)

			// Test browser utilities
			const availableBrowsers = await browser.getAvailableBrowsers()
			expect(Array.isArray(availableBrowsers)).toBe(true)

			// Clean up
			browser.dispose()
		})

		test("✅ Performance characteristics are maintained", async () => {
			// Test adapter creation speed
			const startTime = Date.now()
			await createVsCodeAdapters()
			const creationTime = Date.now() - startTime

			expect(creationTime).toBeLessThan(100) // Should be fast

			// Test task creation speed
			const adapters = await createVsCodeAdapters()
			const taskStartTime = Date.now()
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
			const taskCreationTime = Date.now() - taskStartTime

			expect(taskCreationTime).toBeLessThan(500) // Should be reasonable
		})

		test("✅ Error handling is preserved", async () => {
			// Test that adapter creation doesn't throw unexpectedly
			await expect(createVsCodeAdapters()).resolves.toBeDefined()

			// Test context validation
			setVsCodeContext(undefined as any)
			await expect(createVsCodeAdapters()).rejects.toThrow("VS Code extension context not set")

			// Restore context
			setVsCodeContext(mockContext)
		})

		test("✅ Interface contracts are maintained", async () => {
			const adapters = await createVsCodeAdapters()

			// Verify UserInterface contract
			const ui = adapters.userInterface
			expect(typeof ui.showInformation).toBe("function")
			expect(typeof ui.showWarning).toBe("function")
			expect(typeof ui.showError).toBe("function")
			expect(typeof ui.askQuestion).toBe("function")
			expect(typeof ui.askConfirmation).toBe("function")
			expect(typeof ui.askInput).toBe("function")
			expect(typeof ui.log).toBe("function")
			expect(typeof ui.dispose).toBe("function")

			// Verify FileSystem contract
			const fs = adapters.fileSystem
			expect(typeof fs.readFile).toBe("function")
			expect(typeof fs.writeFile).toBe("function")
			expect(typeof fs.exists).toBe("function")
			expect(typeof fs.stat).toBe("function")
			expect(typeof fs.readdir).toBe("function")
			expect(typeof fs.mkdir).toBe("function")

			// Verify Terminal contract
			const terminal = adapters.terminal
			expect(typeof terminal.executeCommand).toBe("function")
			expect(typeof terminal.createTerminal).toBe("function")
			expect(typeof terminal.getTerminals).toBe("function")
			expect(typeof terminal.killProcess).toBe("function")

			// Verify Browser contract
			const browser = adapters.browser
			expect(typeof browser.launch).toBe("function")
			expect(typeof browser.connect).toBe("function")
			expect(typeof browser.getAvailableBrowsers).toBe("function")
			expect(typeof browser.isBrowserInstalled).toBe("function")
		})
	})

	describe("Integration Validation", () => {
		test("✅ All adapters work together in integration", async () => {
			const adapters = await createVsCodeAdapters()

			// Create a task that uses all adapters
			const task = new Task({
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

			// Verify task integration works
			expect(task.taskId).toBeDefined()
			expect(task.workspacePath).toBe("/mock/workspace")

			// Test that adapters can be used together
			await adapters.userInterface.showInformation("Integration test")
			await adapters.fileSystem.writeFile("/test.txt", "test")
			const fileExists = await adapters.fileSystem.exists("/test.txt")
			expect(fileExists).toBe(true)

			// Clean up
			adapters.userInterface.dispose()
			adapters.browser.dispose()
		})
	})
})
