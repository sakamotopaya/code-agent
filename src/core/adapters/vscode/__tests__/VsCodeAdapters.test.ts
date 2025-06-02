import * as vscode from "vscode"
import { VsCodeUserInterface } from "../VsCodeUserInterface"
import { VsCodeFileSystem } from "../VsCodeFileSystem"
import { VsCodeTerminal } from "../VsCodeTerminal"
import { VsCodeBrowser } from "../VsCodeBrowser"
import { createVsCodeAdapters, setVsCodeContext } from "../index"
import { LogLevel } from "../../../interfaces/IUserInterface"
import { BrowserType } from "../../../interfaces/IBrowser"

// Mock VS Code API
jest.mock("vscode", () => ({
	window: {
		showInformationMessage: jest.fn(),
		showWarningMessage: jest.fn(),
		showErrorMessage: jest.fn(),
		showQuickPick: jest.fn(),
		showInputBox: jest.fn(),
		setStatusBarMessage: jest.fn(),
		createOutputChannel: jest.fn(() => ({
			appendLine: jest.fn(),
			show: jest.fn(),
			dispose: jest.fn(),
		})),
		createWebviewPanel: jest.fn(() => ({
			webview: {
				html: "",
				postMessage: jest.fn(),
				onDidReceiveMessage: jest.fn(),
			},
			dispose: jest.fn(),
		})),
		createTerminal: jest.fn(() => ({
			name: "Test Terminal",
			sendText: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
			processId: 12345,
		})),
		onDidCloseTerminal: jest.fn(),
	},
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/test/workspace" },
			},
		],
		getWorkspaceFolder: jest.fn(() => ({
			uri: { fsPath: "/test/workspace" },
		})),
		openTextDocument: jest.fn(() => ({
			getText: jest.fn(() => "file content"),
		})),
		applyEdit: jest.fn(),
		createFileSystemWatcher: jest.fn(() => ({
			onDidChange: jest.fn(),
			onDidCreate: jest.fn(),
			onDidDelete: jest.fn(),
			dispose: jest.fn(),
		})),
	},
	Uri: {
		file: jest.fn((path) => ({ fsPath: path })),
	},
	WorkspaceEdit: jest.fn(() => ({
		createFile: jest.fn(),
		deleteFile: jest.fn(),
		renameFile: jest.fn(),
	})),
	RelativePattern: jest.fn(),
	ViewColumn: {
		One: 1,
	},
	ThemeColor: jest.fn(),
}))

// Mock fs/promises
jest.mock("fs/promises", () => ({
	readFile: jest.fn(),
	writeFile: jest.fn(),
	appendFile: jest.fn(),
	access: jest.fn(),
	stat: jest.fn(() => ({
		isFile: () => true,
		isDirectory: () => false,
		isSymbolicLink: () => false,
		size: 1024,
		mtime: new Date(),
		ctime: new Date(),
		atime: new Date(),
		birthtime: new Date(),
		mode: 0o644,
	})),
	mkdir: jest.fn(),
	rmdir: jest.fn(),
	readdir: jest.fn(() => []),
	unlink: jest.fn(),
	copyFile: jest.fn(),
	rename: jest.fn(),
}))

// Mock child_process
jest.mock("child_process", () => ({
	exec: jest.fn((command, options, callback) => {
		callback(null, "stdout", "stderr")
	}),
	spawn: jest.fn(() => ({
		stdout: {
			on: jest.fn(),
		},
		stderr: {
			on: jest.fn(),
		},
		stdin: {
			write: jest.fn(),
			end: jest.fn(),
		},
		on: jest.fn((event, callback) => {
			if (event === "close") {
				setTimeout(() => callback(0, null), 10)
			}
		}),
		pid: 12345,
		killed: false,
	})),
}))

// Mock BrowserSession
jest.mock("../../../../services/browser/BrowserSession", () => ({
	BrowserSession: jest.fn().mockImplementation(() => ({
		launchBrowser: jest.fn(),
		closeBrowser: jest.fn(),
		navigateToUrl: jest.fn(() => ({ success: true, screenshot: "base64screenshot" })),
		click: jest.fn(() => ({ success: true, screenshot: "base64screenshot" })),
		type: jest.fn(() => ({ success: true, screenshot: "base64screenshot" })),
		hover: jest.fn(() => ({ success: true, screenshot: "base64screenshot" })),
		scrollDown: jest.fn(() => ({ success: true, screenshot: "base64screenshot" })),
		scrollUp: jest.fn(() => ({ success: true, screenshot: "base64screenshot" })),
		resize: jest.fn(() => ({ success: true, screenshot: "base64screenshot" })),
		doAction: jest.fn(() => ({ success: true, screenshot: "base64screenshot" })),
	})),
}))

describe("VS Code Adapters", () => {
	let mockContext: vscode.ExtensionContext

	beforeEach(() => {
		mockContext = {
			extensionPath: "/test/extension",
			globalStorageUri: { fsPath: "/test/storage" },
			subscriptions: [],
			workspaceState: {
				get: jest.fn(),
				update: jest.fn(),
			},
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
				setKeysForSync: jest.fn(),
			},
		} as any

		setVsCodeContext(mockContext)
		jest.clearAllMocks()
	})

	describe("VsCodeUserInterface", () => {
		let userInterface: VsCodeUserInterface

		beforeEach(() => {
			userInterface = new VsCodeUserInterface(mockContext)
		})

		afterEach(() => {
			userInterface.dispose()
		})

		it("should show information messages", async () => {
			await userInterface.showInformation("Test message")
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Test message")
		})

		it("should show warning messages", async () => {
			await userInterface.showWarning("Warning message")
			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("Warning message")
		})

		it("should show error messages", async () => {
			await userInterface.showError("Error message")
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Error message")
		})

		it("should ask questions with options", async () => {
			const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock
			mockShowQuickPick.mockResolvedValue({ label: "Option 1" })

			const result = await userInterface.askQuestion("Choose an option", {
				choices: ["Option 1", "Option 2"],
			})

			expect(result).toBe("Option 1")
			expect(mockShowQuickPick).toHaveBeenCalled()
		})

		it("should ask for confirmation", async () => {
			const mockShowInformationMessage = vscode.window.showInformationMessage as jest.Mock
			mockShowInformationMessage.mockResolvedValue("Yes")

			const result = await userInterface.askConfirmation("Are you sure?")
			expect(result).toBe(true)
		})

		it("should ask for input", async () => {
			const mockShowInputBox = vscode.window.showInputBox as jest.Mock
			mockShowInputBox.mockResolvedValue("user input")

			const result = await userInterface.askInput("Enter something:")
			expect(result).toBe("user input")
		})

		it("should log messages", async () => {
			await userInterface.log("Test log message", LogLevel.INFO)
			// Verify that the output channel was used
			expect(vscode.window.createOutputChannel).toHaveBeenCalled()
		})
	})

	describe("VsCodeFileSystem", () => {
		let fileSystem: VsCodeFileSystem

		beforeEach(() => {
			fileSystem = new VsCodeFileSystem(mockContext)
		})

		it("should read files", async () => {
			const fs = require("fs/promises")
			fs.readFile.mockResolvedValue("file content")

			const content = await fileSystem.readFile("/test/file.txt")
			expect(content).toBe("file content")
		})

		it("should write files", async () => {
			const fs = require("fs/promises")
			fs.writeFile.mockResolvedValue(undefined)

			await fileSystem.writeFile("/test/file.txt", "content")
			expect(fs.writeFile).toHaveBeenCalledWith("/test/file.txt", "content", "utf8")
		})

		it("should check if files exist", async () => {
			const fs = require("fs/promises")
			fs.access.mockResolvedValue(undefined)

			const exists = await fileSystem.exists("/test/file.txt")
			expect(exists).toBe(true)
		})

		it("should get file stats", async () => {
			const stats = await fileSystem.stat("/test/file.txt")
			expect(stats.isFile).toBe(true)
			expect(stats.size).toBe(1024)
		})

		it("should create directories", async () => {
			const fs = require("fs/promises")
			fs.mkdir.mockResolvedValue(undefined)

			await fileSystem.mkdir("/test/dir", { recursive: true })
			expect(fs.mkdir).toHaveBeenCalledWith("/test/dir", { recursive: true })
		})

		it("should resolve paths", () => {
			const resolved = fileSystem.resolve("./test")
			expect(typeof resolved).toBe("string")
		})

		it("should join paths", () => {
			const joined = fileSystem.join("test", "path", "file.txt")
			expect(joined).toContain("test")
			expect(joined).toContain("file.txt")
		})
	})

	describe("VsCodeTerminal", () => {
		let terminal: VsCodeTerminal

		beforeEach(() => {
			terminal = new VsCodeTerminal(mockContext)
		})

		it("should execute commands", async () => {
			const result = await terminal.executeCommand("echo hello")
			expect(result.success).toBe(true)
			expect(result.stdout).toBe("stdout")
			expect(result.stderr).toBe("stderr")
		})

		it("should create terminal sessions", async () => {
			const session = await terminal.createTerminal({ name: "Test Terminal" })
			expect(session.name).toBe("Test Terminal")
			expect(session.isActive).toBe(true)
		})

		it("should get current working directory", async () => {
			const cwd = await terminal.getCwd()
			expect(typeof cwd).toBe("string")
		})

		it("should check if commands are available", async () => {
			const available = await terminal.isCommandAvailable("node")
			expect(typeof available).toBe("boolean")
		})

		it("should get shell type", async () => {
			const shellType = await terminal.getShellType()
			expect(typeof shellType).toBe("string")
		})
	})

	describe("VsCodeBrowser", () => {
		let browser: VsCodeBrowser

		beforeEach(() => {
			browser = new VsCodeBrowser(mockContext)
		})

		afterEach(() => {
			browser.dispose()
		})

		it("should launch browser sessions", async () => {
			const session = await browser.launch()
			expect(session.isActive).toBe(true)
			expect(typeof session.id).toBe("string")
		})

		it("should get available browsers", async () => {
			const browsers = await browser.getAvailableBrowsers()
			expect(browsers).toContain(BrowserType.CHROMIUM)
		})

		it("should check if browser is installed", async () => {
			const installed = await browser.isBrowserInstalled(BrowserType.CHROMIUM)
			expect(typeof installed).toBe("boolean")
		})

		it("should navigate to URLs", async () => {
			const session = await browser.launch()
			const result = await session.navigateToUrl("https://example.com")
			expect(result.success).toBe(true)
		})

		it("should perform click actions", async () => {
			const session = await browser.launch()
			const result = await session.click("100,100")
			expect(result.success).toBe(true)
		})

		it("should type text", async () => {
			const session = await browser.launch()
			const result = await session.type("Hello World")
			expect(result.success).toBe(true)
		})
	})

	describe("Adapter Factory", () => {
		it("should create all adapters", async () => {
			const adapters = await createVsCodeAdapters()

			expect(adapters.userInterface).toBeInstanceOf(VsCodeUserInterface)
			expect(adapters.fileSystem).toBeInstanceOf(VsCodeFileSystem)
			expect(adapters.terminal).toBeInstanceOf(VsCodeTerminal)
			expect(adapters.browser).toBeInstanceOf(VsCodeBrowser)
		})

		it("should throw error if context not set", () => {
			// Clear the context
			setVsCodeContext(undefined as any)

			expect(() => createVsCodeAdapters()).rejects.toThrow("VS Code extension context not set")
		})
	})
})
