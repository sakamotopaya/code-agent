import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { setVsCodeContext } from "../../adapters/vscode"

// Mock VS Code
jest.mock("vscode", () => ({
	ExtensionContext: jest.fn(),
	Uri: {
		file: jest.fn(),
		parse: jest.fn(),
	},
	workspace: {
		onDidChangeConfiguration: jest.fn(),
	},
	commands: {
		executeCommand: jest.fn(),
	},
	window: {
		createOutputChannel: jest.fn(() => ({
			appendLine: jest.fn(),
			show: jest.fn(),
		})),
	},
	ExtensionMode: {
		Development: 1,
		Production: 2,
		Test: 3,
	},
}))

// Mock other dependencies
jest.mock("../../config/ContextProxy")
jest.mock("../../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: jest.fn().mockResolvedValue({}),
		unregisterProvider: jest.fn(),
	},
}))

describe("ClineProvider Adapter Caching", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockContextProxy: ContextProxy

	beforeEach(() => {
		// Create mock context
		mockContext = {
			globalStorageUri: { fsPath: "/mock/path" },
			extensionUri: { fsPath: "/mock/extension" },
		} as any

		// Set the VS Code context for the adapters
		setVsCodeContext(mockContext)

		// Create mock output channel
		mockOutputChannel = {
			appendLine: jest.fn(),
			show: jest.fn(),
		} as any

		// Create mock context proxy
		mockContextProxy = {
			extensionUri: mockContext.extensionUri,
			extensionMode: vscode.ExtensionMode.Test,
		} as any

		// Create provider instance
		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", mockContextProxy)
	})

	afterEach(async () => {
		await provider.dispose()
	})

	it("should cache adapters and return the same instance on multiple calls", async () => {
		// Access the private method using bracket notation for testing
		const getOrCreateAdapters = (provider as any).getOrCreateAdapters.bind(provider)

		// First call should create adapters
		const adapters1 = await getOrCreateAdapters()

		// Second call should return the same cached instance
		const adapters2 = await getOrCreateAdapters()

		// Should be the exact same object reference
		expect(adapters1).toBe(adapters2)
		expect(adapters1.userInterface).toBe(adapters2.userInterface)
		expect(adapters1.fileSystem).toBe(adapters2.fileSystem)
		expect(adapters1.terminal).toBe(adapters2.terminal)
		expect(adapters1.browser).toBe(adapters2.browser)
	})

	it("should clear adapters on dispose", async () => {
		// Access the private method and property using bracket notation for testing
		const getOrCreateAdapters = (provider as any).getOrCreateAdapters.bind(provider)

		// Create adapters
		await getOrCreateAdapters()

		// Verify adapters are cached
		expect((provider as any).adapters).toBeDefined()

		// Dispose the provider
		await provider.dispose()

		// Verify adapters are cleared
		expect((provider as any).adapters).toBeUndefined()
	})
})
