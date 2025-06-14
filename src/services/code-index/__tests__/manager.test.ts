import * as vscode from "vscode"
import { CodeIndexManager } from "../manager"
import { ContextProxy } from "../../../core/config/ContextProxy"

// Mock vscode module explicitly
jest.mock("vscode", () => ({
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	env: {
		language: "en",
		shell: "/bin/zsh",
	},
	window: {
		showInformationMessage: jest.fn(),
		showErrorMessage: jest.fn(),
	},
}))

// Mock only the essential dependencies
jest.mock("../../../utils/path", () => ({
	getWorkspacePath: jest.fn(() => "/test/workspace"),
}))

jest.mock("../state-manager", () => ({
	CodeIndexStateManager: jest.fn().mockImplementation(() => ({
		onProgressUpdate: jest.fn(),
		getCurrentStatus: jest.fn(),
		dispose: jest.fn(),
	})),
}))

describe("CodeIndexManager - handleExternalSettingsChange regression", () => {
	let mockContext: jest.Mocked<vscode.ExtensionContext>
	let manager: CodeIndexManager

	beforeEach(() => {
		// Clear all instances before each test
		CodeIndexManager.disposeAll()

		mockContext = {
			subscriptions: [],
			workspaceState: {} as any,
			globalState: {} as any,
			extensionUri: {} as any,
			extensionPath: "/test/extension",
			asAbsolutePath: jest.fn(),
			storageUri: {} as any,
			storagePath: "/test/storage",
			globalStorageUri: {} as any,
			globalStoragePath: "/test/global-storage",
			logUri: {} as any,
			logPath: "/test/log",
			extensionMode: vscode.ExtensionMode.Test,
			secrets: {} as any,
			environmentVariableCollection: {} as any,
			extension: {} as any,
			languageModelAccessInformation: {} as any,
		}

		manager = CodeIndexManager.getInstance(mockContext)!
	})

	afterEach(() => {
		CodeIndexManager.disposeAll()
	})

	describe("handleExternalSettingsChange", () => {
		it("should not throw when called on uninitialized manager (regression test)", async () => {
			// This is the core regression test: handleExternalSettingsChange() should not throw
			// when called before the manager is initialized (during first-time configuration)

			// Ensure manager is not initialized
			expect(manager.isInitialized).toBe(false)

			// Mock a minimal config manager that simulates first-time configuration
			const mockConfigManager = {
				loadConfiguration: jest.fn().mockResolvedValue({ requiresRestart: true }),
			}
			;(manager as any)._configManager = mockConfigManager

			// Mock the feature state to simulate valid configuration that would normally trigger restart
			jest.spyOn(manager, "isFeatureEnabled", "get").mockReturnValue(true)
			jest.spyOn(manager, "isFeatureConfigured", "get").mockReturnValue(true)

			// The key test: this should NOT throw "CodeIndexManager not initialized" error
			await expect(manager.handleExternalSettingsChange()).resolves.not.toThrow()

			// Verify that loadConfiguration was called (the method should still work)
			expect(mockConfigManager.loadConfiguration).toHaveBeenCalled()
		})

		it("should work normally when manager is initialized", async () => {
			// Mock a minimal config manager
			const mockConfigManager = {
				loadConfiguration: jest.fn().mockResolvedValue({ requiresRestart: true }),
			}
			;(manager as any)._configManager = mockConfigManager

			// Simulate an initialized manager by setting the required properties
			;(manager as any)._orchestrator = { stopWatcher: jest.fn() }
			;(manager as any)._searchService = {}
			;(manager as any)._cacheManager = {}

			// Verify manager is considered initialized
			expect(manager.isInitialized).toBe(true)

			// Mock the methods that would be called during restart
			const stopWatcherSpy = jest.spyOn(manager, "stopWatcher").mockImplementation()
			const startIndexingSpy = jest.spyOn(manager, "startIndexing").mockResolvedValue()

			// Mock the feature state
			jest.spyOn(manager, "isFeatureEnabled", "get").mockReturnValue(true)
			jest.spyOn(manager, "isFeatureConfigured", "get").mockReturnValue(true)

			await manager.handleExternalSettingsChange()

			// Verify that the restart sequence was called
			expect(mockConfigManager.loadConfiguration).toHaveBeenCalled()
			expect(stopWatcherSpy).toHaveBeenCalled()
			expect(startIndexingSpy).toHaveBeenCalled()
		})

		it("should handle case when config manager is not set", async () => {
			// Ensure config manager is not set (edge case)
			;(manager as any)._configManager = undefined

			// This should not throw an error
			await expect(manager.handleExternalSettingsChange()).resolves.not.toThrow()
		})
	})
})
