/**
 * Performance benchmark tests for VS Code functionality preservation
 * These tests ensure that the abstraction layer doesn't significantly impact performance
 */

import { jest } from "@jest/globals"
import { createVsCodeAdapters, setVsCodeContext } from "../index"
import { Task } from "../../../task/Task"

// Mock VS Code API with minimal overhead
const mockContext = {
	subscriptions: [],
	workspaceState: { get: jest.fn(), update: jest.fn() },
	globalState: { get: jest.fn(), update: jest.fn() },
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
	secrets: { get: jest.fn(), store: jest.fn(), delete: jest.fn(), onDidChange: jest.fn() },
	languageModelAccessInformation: { onDidChange: jest.fn(), canSendRequest: jest.fn() },
} as any

jest.mock("vscode", () => ({
	window: {
		showInformationMessage: (jest.fn() as any).mockResolvedValue(undefined),
		showWarningMessage: (jest.fn() as any).mockResolvedValue(undefined),
		showErrorMessage: (jest.fn() as any).mockResolvedValue(undefined),
		showInputBox: (jest.fn() as any).mockResolvedValue(""),
		showQuickPick: (jest.fn() as any).mockResolvedValue(""),
		createOutputChannel: jest.fn(() => ({
			appendLine: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
		})),
		createTextEditorDecorationType: jest.fn(() => ({ dispose: jest.fn() })),
		showOpenDialog: (jest.fn() as any).mockResolvedValue([]),
		showSaveDialog: (jest.fn() as any).mockResolvedValue(undefined),
		withProgress: (jest.fn() as any).mockResolvedValue(undefined),
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
			readFile: (jest.fn() as any).mockResolvedValue(new Uint8Array()),
			writeFile: (jest.fn() as any).mockResolvedValue(undefined),
			stat: (jest.fn() as any).mockResolvedValue({}),
			readDirectory: (jest.fn() as any).mockResolvedValue([]),
			createDirectory: (jest.fn() as any).mockResolvedValue(undefined),
			delete: (jest.fn() as any).mockResolvedValue(undefined),
		},
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace" }, name: "test-workspace", index: 0 }],
		getConfiguration: jest.fn(() => ({ get: jest.fn(), update: jest.fn(), has: jest.fn(), inspect: jest.fn() })),
		onDidChangeConfiguration: jest.fn(),
		createFileSystemWatcher: jest.fn(() => ({
			onDidCreate: jest.fn(),
			onDidChange: jest.fn(),
			onDidDelete: jest.fn(),
			dispose: jest.fn(),
		})),
	},
	Uri: { file: jest.fn((path: string) => ({ fsPath: path, scheme: "file", path })), parse: jest.fn() },
	RelativePattern: jest.fn((base: any, pattern: string) => ({ base, pattern })),
	ViewColumn: { One: 1, Two: 2, Three: 3 },
	ProgressLocation: { Notification: 15, SourceControl: 1, Window: 10 },
	FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
	ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
}))

describe("VS Code Performance Benchmarks", () => {
	beforeAll(() => {
		setVsCodeContext(mockContext)
	})

	beforeEach(() => {
		jest.clearAllMocks()
	})

	const API_CONFIG = {
		apiProvider: "anthropic" as const,
		apiKey: "test-key",
		apiModelId: "claude-3-sonnet-20240229",
	}

	test("Adapter creation performance", async () => {
		const iterations = 100
		const times: number[] = []

		for (let i = 0; i < iterations; i++) {
			const start = performance.now()
			await createVsCodeAdapters()
			const end = performance.now()
			times.push(end - start)
		}

		const avgTime = times.reduce((a, b) => a + b, 0) / times.length
		const maxTime = Math.max(...times)

		// Average adapter creation should be under 5ms
		expect(avgTime).toBeLessThan(5)
		// Maximum adapter creation should be under 20ms
		expect(maxTime).toBeLessThan(20)

		console.log(`Adapter creation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
	})

	test("Task creation performance with adapters", async () => {
		const adapters = await createVsCodeAdapters()
		const iterations = 50
		const times: number[] = []

		for (let i = 0; i < iterations; i++) {
			const start = performance.now()
			new Task({
				apiConfiguration: API_CONFIG,
				fileSystem: adapters.fileSystem,
				terminal: adapters.terminal,
				browser: adapters.browser,
				globalStoragePath: "/mock/global",
				workspacePath: "/mock/workspace",
				startTask: false,
			})
			const end = performance.now()
			times.push(end - start)
		}

		const avgTime = times.reduce((a, b) => a + b, 0) / times.length
		const maxTime = Math.max(...times)

		// Average task creation should be under 50ms
		expect(avgTime).toBeLessThan(50)
		// Maximum task creation should be under 200ms
		expect(maxTime).toBeLessThan(200)

		console.log(`Task creation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
	})

	test("Task creation performance with provider (VS Code mode)", async () => {
		const mockProvider = {
			context: mockContext,
			postMessageToWebview: jest.fn(),
			getTaskWithId: jest.fn(),
			getStateManager: jest.fn(),
		} as any

		const iterations = 50
		const times: number[] = []

		for (let i = 0; i < iterations; i++) {
			const start = performance.now()
			new Task({
				provider: mockProvider,
				apiConfiguration: API_CONFIG,
				startTask: false,
			})
			const end = performance.now()
			times.push(end - start)
		}

		const avgTime = times.reduce((a, b) => a + b, 0) / times.length
		const maxTime = Math.max(...times)

		// VS Code mode task creation should be similar to adapter mode
		expect(avgTime).toBeLessThan(60)
		expect(maxTime).toBeLessThan(250)

		console.log(`VS Code Task creation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
	})

	test("Interface method call performance", async () => {
		const adapters = await createVsCodeAdapters()
		const iterations = 1000

		// Test UserInterface performance
		const uiStart = performance.now()
		for (let i = 0; i < iterations; i++) {
			await adapters.userInterface.showInformation("test")
		}
		const uiTime = performance.now() - uiStart
		const avgUiTime = uiTime / iterations

		expect(avgUiTime).toBeLessThan(1) // Should be under 1ms per call
		console.log(`UI method calls - Avg: ${avgUiTime.toFixed(3)}ms per call`)

		// Test FileSystem performance
		const fsStart = performance.now()
		for (let i = 0; i < iterations; i++) {
			await adapters.fileSystem.exists("/test/path")
		}
		const fsTime = performance.now() - fsStart
		const avgFsTime = fsTime / iterations

		expect(avgFsTime).toBeLessThan(1) // Should be under 1ms per call
		console.log(`FS method calls - Avg: ${avgFsTime.toFixed(3)}ms per call`)
	})

	test("Memory usage during adapter operations", async () => {
		const initialMemory = process.memoryUsage().heapUsed

		// Perform many adapter operations
		for (let i = 0; i < 100; i++) {
			const adapters = await createVsCodeAdapters()
			await adapters.userInterface.showInformation("test")
			await adapters.fileSystem.exists("/test")
		}

		// Force garbage collection if available
		if (global.gc) {
			global.gc()
		}

		const finalMemory = process.memoryUsage().heapUsed
		const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // Convert to MB

		// Memory increase should be reasonable (less than 5MB)
		expect(memoryIncrease).toBeLessThan(5)
		console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`)
	})

	test("Concurrent adapter usage performance", async () => {
		const adapters = await createVsCodeAdapters()
		const concurrentTasks = 10
		const operationsPerTask = 50

		const start = performance.now()

		// Run concurrent operations
		const promises = Array.from({ length: concurrentTasks }, async () => {
			for (let i = 0; i < operationsPerTask; i++) {
				await Promise.all([adapters.userInterface.showInformation("test"), adapters.fileSystem.exists("/test")])
			}
		})

		await Promise.all(promises)
		const totalTime = performance.now() - start
		const avgTimePerOperation = totalTime / (concurrentTasks * operationsPerTask * 2)

		expect(avgTimePerOperation).toBeLessThan(2) // Should be under 2ms per operation
		console.log(`Concurrent operations - Avg: ${avgTimePerOperation.toFixed(3)}ms per operation`)
	})

	test("Adapter overhead compared to direct calls", async () => {
		const adapters = await createVsCodeAdapters()
		const iterations = 1000

		// Measure adapter calls
		const adapterStart = performance.now()
		for (let i = 0; i < iterations; i++) {
			await adapters.userInterface.showInformation("test")
		}
		const adapterTime = performance.now() - adapterStart

		// Measure direct VS Code calls (mocked)
		const vscode = require("vscode")
		const directStart = performance.now()
		for (let i = 0; i < iterations; i++) {
			await vscode.window.showInformationMessage("test")
		}
		const directTime = performance.now() - directStart

		const overhead = ((adapterTime - directTime) / directTime) * 100

		// Overhead should be less than 50%
		expect(overhead).toBeLessThan(50)
		console.log(`Adapter overhead: ${overhead.toFixed(1)}%`)
	})
})
