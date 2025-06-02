import { Task, TaskOptions } from "../Task"
import { IFileSystem } from "../../interfaces/IFileSystem"
import { ITerminal } from "../../interfaces/ITerminal"
import { IBrowser } from "../../interfaces/IBrowser"
import { ProviderSettings } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

// Mock vscode module explicitly
jest.mock("vscode", () => ({
	window: {
		showInformationMessage: jest.fn(),
		showErrorMessage: jest.fn(),
		createTextEditorDecorationType: jest.fn().mockReturnValue({
			dispose: jest.fn(),
		}),
		tabGroups: {
			all: [],
		},
	},
	workspace: {
		workspaceFolders: [],
		getWorkspaceFolder: jest.fn(),
	},
	env: {
		language: "en",
		shell: "/bin/zsh",
	},
}))

// Mock implementations for testing
class MockFileSystem implements IFileSystem {
	async readFile(filePath: string, encoding?: any): Promise<string> {
		return "mock file content"
	}

	async writeFile(filePath: string, content: string, encoding?: any): Promise<void> {
		// Mock implementation
	}

	async appendFile(filePath: string, content: string, encoding?: any): Promise<void> {
		// Mock implementation
	}

	async exists(path: string): Promise<boolean> {
		return true
	}

	async stat(path: string): Promise<any> {
		return {
			size: 100,
			isFile: true,
			isDirectory: false,
			isSymbolicLink: false,
			birthtime: new Date(),
			mtime: new Date(),
			atime: new Date(),
			ctime: new Date(),
			mode: 0o644,
		}
	}

	async mkdir(dirPath: string, options?: any): Promise<void> {
		// Mock implementation
	}

	async unlink(filePath: string): Promise<void> {
		// Mock implementation
	}

	async rmdir(dirPath: string, options?: any): Promise<void> {
		// Mock implementation
	}

	async readdir(dirPath: string, options?: any): Promise<any[]> {
		return []
	}

	async copy(source: string, destination: string, options?: any): Promise<void> {
		// Mock implementation
	}

	async move(source: string, destination: string): Promise<void> {
		// Mock implementation
	}

	watch(path: string, options?: any): any {
		return {
			onChange: () => {},
			onError: () => {},
			close: () => {},
		}
	}

	resolve(relativePath: string): string {
		return `/mock/path/${relativePath}`
	}

	join(...paths: string[]): string {
		return paths.join("/")
	}

	dirname(path: string): string {
		return path.split("/").slice(0, -1).join("/")
	}

	basename(path: string, ext?: string): string {
		const base = path.split("/").pop() || ""
		return ext ? base.replace(ext, "") : base
	}

	extname(path: string): string {
		const parts = path.split(".")
		return parts.length > 1 ? `.${parts.pop()}` : ""
	}

	normalize(path: string): string {
		return path
	}

	isAbsolute(path: string): boolean {
		return path.startsWith("/")
	}

	relative(from: string, to: string): string {
		return to
	}

	async createDirectoriesForFile(filePath: string): Promise<string[]> {
		return []
	}

	cwd(): string {
		return "/mock/cwd"
	}

	chdir(path: string): void {
		// Mock implementation
	}
}

class MockTerminal implements ITerminal {
	async executeCommand(command: string, options?: any): Promise<any> {
		return {
			exitCode: 0,
			stdout: "mock output",
			stderr: "",
			success: true,
			command,
			executionTime: 100,
		}
	}

	async executeCommandStreaming(command: string, options?: any, onOutput?: any): Promise<any> {
		return this.executeCommand(command, options)
	}

	async createTerminal(options?: any): Promise<any> {
		return {
			id: "mock-terminal",
			name: "Mock Terminal",
			isActive: true,
			sendText: async () => {},
			show: async () => {},
			hide: async () => {},
			dispose: async () => {},
			getCwd: async () => "/mock/cwd",
			onOutput: () => {},
			onClose: () => {},
			getProcessId: async () => 1234,
		}
	}

	async getTerminals(): Promise<any[]> {
		return []
	}

	async getCwd(): Promise<string> {
		return "/mock/cwd"
	}

	async setCwd(path: string): Promise<void> {
		// Mock implementation
	}

	async getEnvironment(): Promise<Record<string, string>> {
		return { PATH: "/usr/bin" }
	}

	async setEnvironmentVariable(name: string, value: string): Promise<void> {
		// Mock implementation
	}

	async isCommandAvailable(command: string): Promise<boolean> {
		return true
	}

	async getShellType(): Promise<string> {
		return "bash"
	}

	async killProcess(pid: number, signal?: string): Promise<void> {
		// Mock implementation
	}

	async getProcesses(filter?: string): Promise<any[]> {
		return []
	}
}

class MockBrowser implements IBrowser {
	async launch(options?: any): Promise<any> {
		return {
			id: "mock-browser",
			isActive: true,
			navigateToUrl: async () => ({ success: true }),
			click: async () => ({ success: true }),
			type: async () => ({ success: true }),
			hover: async () => ({ success: true }),
			scroll: async () => ({ success: true }),
			resize: async () => ({ success: true }),
			screenshot: async () => ({ data: "mock-screenshot", format: "png", width: 800, height: 600 }),
			executeScript: async () => "mock result",
			waitForElement: async () => true,
			waitForNavigation: async () => true,
			getCurrentUrl: async () => "https://mock.com",
			getTitle: async () => "Mock Title",
			getContent: async () => "<html>mock</html>",
			getConsoleLogs: async () => [],
			clearConsoleLogs: async () => {},
			setViewport: async () => {},
			getViewport: async () => ({ width: 800, height: 600 }),
			close: async () => {},
			on: () => {},
			off: () => {},
		}
	}

	async connect(options: any): Promise<any> {
		return this.launch()
	}

	async getAvailableBrowsers(): Promise<any[]> {
		return ["chrome", "firefox"]
	}

	async isBrowserInstalled(browserType: any): Promise<boolean> {
		return true
	}

	async getBrowserExecutablePath(browserType: any): Promise<string | undefined> {
		return "/usr/bin/chrome"
	}

	async installBrowser(browserType: any, options?: any): Promise<void> {
		// Mock implementation
	}
}

describe("Task", () => {
	let mockFileSystem: MockFileSystem
	let mockTerminal: MockTerminal
	let mockBrowser: MockBrowser
	let mockApiConfiguration: ProviderSettings

	beforeEach(() => {
		mockFileSystem = new MockFileSystem()
		mockTerminal = new MockTerminal()
		mockBrowser = new MockBrowser()
		mockApiConfiguration = {
			apiProvider: "anthropic",
			apiKey: "mock-key",
			apiModelId: "claude-3-sonnet-20240229",
		} as ProviderSettings

		// Initialize TelemetryService for tests
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}
	})

	afterEach(() => {
		// Clean up TelemetryService after each test
		if (TelemetryService.hasInstance()) {
			// Reset the instance by accessing the private field
			;(TelemetryService as any)._instance = null
		}
	})

	describe("constructor", () => {
		it("should create a Task instance with interface dependencies", () => {
			const options: TaskOptions = {
				apiConfiguration: mockApiConfiguration,
				fileSystem: mockFileSystem,
				terminal: mockTerminal,
				browser: mockBrowser,
				task: "Test task",
				startTask: false,
				globalStoragePath: "/mock/storage",
				workspacePath: "/mock/workspace",
			}

			const task = new Task(options)

			expect(task).toBeInstanceOf(Task)
			expect(task.taskId).toBeDefined()
			expect(task.instanceId).toBeDefined()
			expect(task.workspacePath).toBe("/mock/workspace")
		})

		it("should create a Task instance without provider (CLI mode)", () => {
			const options: TaskOptions = {
				apiConfiguration: mockApiConfiguration,
				fileSystem: mockFileSystem,
				terminal: mockTerminal,
				browser: mockBrowser,
				task: "Test task",
				startTask: false,
				globalStoragePath: "/mock/storage",
				workspacePath: "/mock/workspace",
			}

			const task = new Task(options)

			expect(task).toBeInstanceOf(Task)
			expect(task.providerRef).toBeUndefined()
		})

		it("should throw error if no task, images, or historyItem provided when startTask is true", () => {
			const options: TaskOptions = {
				apiConfiguration: mockApiConfiguration,
				fileSystem: mockFileSystem,
				terminal: mockTerminal,
				browser: mockBrowser,
				startTask: true,
			}

			expect(() => new Task(options)).toThrow("Either historyItem or task/images must be provided")
		})
	})

	describe("static create", () => {
		it("should create Task instance and return promise", () => {
			const options: TaskOptions = {
				apiConfiguration: mockApiConfiguration,
				fileSystem: mockFileSystem,
				terminal: mockTerminal,
				browser: mockBrowser,
				task: "Test task",
				globalStoragePath: "/mock/storage",
				workspacePath: "/mock/workspace",
			}

			const [task, promise] = Task.create(options)

			expect(task).toBeInstanceOf(Task)
			expect(promise).toBeInstanceOf(Promise)
		})
	})

	describe("messaging delegation", () => {
		let task: Task

		beforeEach(() => {
			const options: TaskOptions = {
				apiConfiguration: mockApiConfiguration,
				fileSystem: mockFileSystem,
				terminal: mockTerminal,
				browser: mockBrowser,
				task: "Test task",
				startTask: false,
				globalStoragePath: "/mock/storage",
				workspacePath: "/mock/workspace",
			}
			task = new Task(options)
		})

		it("should delegate say method to messaging component", async () => {
			// This test would need to mock the messaging component
			// For now, we'll just ensure the method exists and can be called
			expect(typeof task.say).toBe("function")
		})

		it("should delegate handleWebviewAskResponse method", () => {
			expect(typeof task.handleWebviewAskResponse).toBe("function")

			// Should not throw
			task.handleWebviewAskResponse("yesButtonClicked", "test", [])
		})
	})

	describe("lifecycle delegation", () => {
		let task: Task

		beforeEach(() => {
			const options: TaskOptions = {
				apiConfiguration: mockApiConfiguration,
				fileSystem: mockFileSystem,
				terminal: mockTerminal,
				browser: mockBrowser,
				task: "Test task",
				startTask: false,
				globalStoragePath: "/mock/storage",
				workspacePath: "/mock/workspace",
			}
			task = new Task(options)
		})

		it("should delegate resumePausedTask method", async () => {
			expect(typeof task.resumePausedTask).toBe("function")
		})

		it("should delegate abortTask method", async () => {
			expect(typeof task.abortTask).toBe("function")

			await task.abortTask()
			expect(task.abort).toBe(true)
		})
	})

	describe("tool usage tracking", () => {
		let task: Task

		beforeEach(() => {
			const options: TaskOptions = {
				apiConfiguration: mockApiConfiguration,
				fileSystem: mockFileSystem,
				terminal: mockTerminal,
				browser: mockBrowser,
				task: "Test task",
				startTask: false,
				globalStoragePath: "/mock/storage",
				workspacePath: "/mock/workspace",
			}
			task = new Task(options)
		})

		it("should record tool usage", () => {
			task.recordToolUsage("read_file")

			expect(task.toolUsage["read_file"]).toEqual({
				attempts: 1,
				failures: 0,
			})
		})

		it("should record tool errors", () => {
			task.recordToolError("read_file", "File not found")

			expect(task.toolUsage["read_file"]).toEqual({
				attempts: 0,
				failures: 1,
			})
		})
	})

	describe("getters", () => {
		let task: Task

		beforeEach(() => {
			const options: TaskOptions = {
				apiConfiguration: mockApiConfiguration,
				fileSystem: mockFileSystem,
				terminal: mockTerminal,
				browser: mockBrowser,
				task: "Test task",
				startTask: false,
				globalStoragePath: "/mock/storage",
				workspacePath: "/mock/workspace",
			}
			task = new Task(options)
		})

		it("should return correct cwd", () => {
			expect(task.cwd).toBe("/mock/workspace")
		})

		it("should return clineMessages from messaging component", () => {
			expect(Array.isArray(task.clineMessages)).toBe(true)
		})

		it("should return apiConversationHistory from messaging component", () => {
			expect(Array.isArray(task.apiConversationHistory)).toBe(true)
		})
	})

	describe("backward compatibility", () => {
		let task: Task

		beforeEach(() => {
			const options: TaskOptions = {
				apiConfiguration: mockApiConfiguration,
				fileSystem: mockFileSystem,
				terminal: mockTerminal,
				browser: mockBrowser,
				task: "Test task",
				startTask: false,
				globalStoragePath: "/mock/storage",
				workspacePath: "/mock/workspace",
			}
			task = new Task(options)
		})

		it("should provide overwriteClineMessages method", async () => {
			expect(typeof task.overwriteClineMessages).toBe("function")
		})

		it("should provide overwriteApiConversationHistory method", async () => {
			expect(typeof task.overwriteApiConversationHistory).toBe("function")
		})
	})
})
