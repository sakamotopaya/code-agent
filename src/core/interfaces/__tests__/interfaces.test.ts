/**
 * Unit tests for core interface definitions.
 * These tests validate that the interfaces are properly defined and can be implemented.
 */

import type {
	IUserInterface,
	IFileSystem,
	ITerminal,
	IBrowser,
	ITelemetryService,
	IStorageService,
	CoreInterfaces,
	InterfaceFactory,
	InterfaceConfig,
	MessageOptions,
	QuestionOptions,
	ConfirmationOptions,
	InputOptions,
	WebviewContent,
	WebviewOptions,
	FileStats,
	MkdirOptions,
	RmdirOptions,
	ReaddirOptions,
	DirectoryEntry,
	CopyOptions,
	WatchOptions,
	FileWatcher,
	ITerminalSession,
	ExecuteCommandOptions,
	CommandResult,
	TerminalOptions,
	ProcessInfo,
	IBrowserSession,
	BrowserLaunchOptions,
	BrowserConnectOptions,
	BrowserInstallOptions,
	NavigationOptions,
	ClickOptions,
	TypeOptions,
	HoverOptions,
	ScrollOptions,
	ResizeOptions,
	ScreenshotOptions,
	ScriptOptions,
	WaitOptions,
	LogOptions,
	BrowserActionResult,
	ScreenshotResult,
	ConsoleLog,
	LogLocation,
	ViewportSize,
	ClipArea,
} from "../index"

// Import enums as values
import { LogLevel } from "../IUserInterface"
import {
	BrowserType,
	ScrollDirection,
	BrowserEvent,
	ConsoleLogType,
	MouseButton,
	ModifierKey,
	WaitCondition,
} from "../IBrowser"

describe("Core Interfaces", () => {
	describe("IUserInterface", () => {
		it("should define all required methods", () => {
			const mockUserInterface: IUserInterface = {
				showInformation: jest.fn(),
				showWarning: jest.fn(),
				showError: jest.fn(),
				askQuestion: jest.fn(),
				askConfirmation: jest.fn(),
				askInput: jest.fn(),
				showProgress: jest.fn(),
				clearProgress: jest.fn(),
				log: jest.fn(),
				showWebview: jest.fn(),
				sendWebviewMessage: jest.fn(),
				onWebviewMessage: jest.fn(),
			}

			expect(mockUserInterface).toBeDefined()
			expect(typeof mockUserInterface.showInformation).toBe("function")
			expect(typeof mockUserInterface.showWarning).toBe("function")
			expect(typeof mockUserInterface.showError).toBe("function")
			expect(typeof mockUserInterface.askQuestion).toBe("function")
			expect(typeof mockUserInterface.askConfirmation).toBe("function")
			expect(typeof mockUserInterface.askInput).toBe("function")
			expect(typeof mockUserInterface.showProgress).toBe("function")
			expect(typeof mockUserInterface.clearProgress).toBe("function")
			expect(typeof mockUserInterface.log).toBe("function")
			expect(typeof mockUserInterface.showWebview).toBe("function")
			expect(typeof mockUserInterface.sendWebviewMessage).toBe("function")
			expect(typeof mockUserInterface.onWebviewMessage).toBe("function")
		})

		it("should support LogLevel enum values", () => {
			expect(LogLevel.DEBUG).toBe("debug")
			expect(LogLevel.INFO).toBe("info")
			expect(LogLevel.WARN).toBe("warn")
			expect(LogLevel.ERROR).toBe("error")
		})

		it("should validate MessageOptions interface", () => {
			const options: MessageOptions = {
				modal: true,
				actions: ["OK", "Cancel"],
			}
			expect(options.modal).toBe(true)
			expect(options.actions).toEqual(["OK", "Cancel"])
		})

		it("should validate QuestionOptions interface", () => {
			const options: QuestionOptions = {
				choices: ["Yes", "No", "Maybe"],
				defaultChoice: "Yes",
				modal: false,
			}
			expect(options.choices).toEqual(["Yes", "No", "Maybe"])
			expect(options.defaultChoice).toBe("Yes")
			expect(options.modal).toBe(false)
		})
	})

	describe("IFileSystem", () => {
		it("should define all required methods", () => {
			const mockFileSystem: IFileSystem = {
				readFile: jest.fn(),
				writeFile: jest.fn(),
				appendFile: jest.fn(),
				exists: jest.fn(),
				stat: jest.fn(),
				mkdir: jest.fn(),
				unlink: jest.fn(),
				rmdir: jest.fn(),
				readdir: jest.fn(),
				copy: jest.fn(),
				move: jest.fn(),
				watch: jest.fn(),
				resolve: jest.fn(),
				join: jest.fn(),
				dirname: jest.fn(),
				basename: jest.fn(),
				extname: jest.fn(),
				normalize: jest.fn(),
				isAbsolute: jest.fn(),
				relative: jest.fn(),
				createDirectoriesForFile: jest.fn(),
				cwd: jest.fn(),
				chdir: jest.fn(),
			}

			expect(mockFileSystem).toBeDefined()
			expect(typeof mockFileSystem.readFile).toBe("function")
			expect(typeof mockFileSystem.writeFile).toBe("function")
			expect(typeof mockFileSystem.exists).toBe("function")
			expect(typeof mockFileSystem.stat).toBe("function")
			expect(typeof mockFileSystem.mkdir).toBe("function")
		})

		it("should validate FileStats interface", () => {
			const stats: FileStats = {
				size: 1024,
				isFile: true,
				isDirectory: false,
				isSymbolicLink: false,
				birthtime: new Date(),
				mtime: new Date(),
				atime: new Date(),
				ctime: new Date(),
				mode: 0o644,
			}
			expect(stats.size).toBe(1024)
			expect(stats.isFile).toBe(true)
			expect(stats.isDirectory).toBe(false)
		})

		it("should validate DirectoryEntry interface", () => {
			const entry: DirectoryEntry = {
				name: "test.txt",
				isFile: true,
				isDirectory: false,
				isSymbolicLink: false,
			}
			expect(entry.name).toBe("test.txt")
			expect(entry.isFile).toBe(true)
		})
	})

	describe("ITerminal", () => {
		it("should define all required methods", () => {
			const mockTerminal: ITerminal = {
				executeCommand: jest.fn(),
				executeCommandStreaming: jest.fn(),
				createTerminal: jest.fn(),
				getTerminals: jest.fn(),
				getCwd: jest.fn(),
				setCwd: jest.fn(),
				getEnvironment: jest.fn(),
				setEnvironmentVariable: jest.fn(),
				isCommandAvailable: jest.fn(),
				getShellType: jest.fn(),
				killProcess: jest.fn(),
				getProcesses: jest.fn(),
			}

			expect(mockTerminal).toBeDefined()
			expect(typeof mockTerminal.executeCommand).toBe("function")
			expect(typeof mockTerminal.executeCommandStreaming).toBe("function")
			expect(typeof mockTerminal.createTerminal).toBe("function")
			expect(typeof mockTerminal.getTerminals).toBe("function")
		})

		it("should validate CommandResult interface", () => {
			const result: CommandResult = {
				exitCode: 0,
				stdout: "Hello World",
				stderr: "",
				success: true,
				command: "echo 'Hello World'",
				executionTime: 100,
			}
			expect(result.exitCode).toBe(0)
			expect(result.stdout).toBe("Hello World")
			expect(result.success).toBe(true)
		})

		it("should validate ProcessInfo interface", () => {
			const process: ProcessInfo = {
				pid: 1234,
				name: "node",
				cmd: "node app.js",
				cpu: 5.5,
				memory: 1024000,
				ppid: 1,
				user: "testuser",
				startTime: new Date(),
			}
			expect(process.pid).toBe(1234)
			expect(process.name).toBe("node")
		})
	})

	describe("IBrowser", () => {
		it("should define all required methods", () => {
			const mockBrowser: IBrowser = {
				launch: jest.fn(),
				connect: jest.fn(),
				getAvailableBrowsers: jest.fn(),
				isBrowserInstalled: jest.fn(),
				getBrowserExecutablePath: jest.fn(),
				installBrowser: jest.fn(),
			}

			expect(mockBrowser).toBeDefined()
			expect(typeof mockBrowser.launch).toBe("function")
			expect(typeof mockBrowser.connect).toBe("function")
			expect(typeof mockBrowser.getAvailableBrowsers).toBe("function")
		})

		it("should validate BrowserType enum values", () => {
			expect(BrowserType.CHROME).toBe("chrome")
			expect(BrowserType.FIREFOX).toBe("firefox")
			expect(BrowserType.SAFARI).toBe("safari")
			expect(BrowserType.EDGE).toBe("edge")
			expect(BrowserType.CHROMIUM).toBe("chromium")
		})

		it("should validate ScrollDirection enum values", () => {
			expect(ScrollDirection.UP).toBe("up")
			expect(ScrollDirection.DOWN).toBe("down")
			expect(ScrollDirection.LEFT).toBe("left")
			expect(ScrollDirection.RIGHT).toBe("right")
		})

		it("should validate BrowserEvent enum values", () => {
			expect(BrowserEvent.CONSOLE).toBe("console")
			expect(BrowserEvent.PAGE_ERROR).toBe("pageerror")
			expect(BrowserEvent.REQUEST).toBe("request")
			expect(BrowserEvent.RESPONSE).toBe("response")
		})

		it("should validate ViewportSize interface", () => {
			const viewport: ViewportSize = {
				width: 1920,
				height: 1080,
				deviceScaleFactor: 1,
				isMobile: false,
				hasTouch: false,
				isLandscape: true,
			}
			expect(viewport.width).toBe(1920)
			expect(viewport.height).toBe(1080)
			expect(viewport.isMobile).toBe(false)
		})

		it("should validate ConsoleLogType enum values", () => {
			expect(ConsoleLogType.LOG).toBe("log")
			expect(ConsoleLogType.INFO).toBe("info")
			expect(ConsoleLogType.WARN).toBe("warn")
			expect(ConsoleLogType.ERROR).toBe("error")
			expect(ConsoleLogType.DEBUG).toBe("debug")
			expect(ConsoleLogType.TRACE).toBe("trace")
		})
	})

	describe("CoreInterfaces", () => {
		it("should define the complete interface structure", () => {
			const mockCoreInterfaces: CoreInterfaces = {
				userInterface: {} as IUserInterface,
				fileSystem: {} as IFileSystem,
				terminal: {} as ITerminal,
				browser: {} as IBrowser,
				telemetry: {} as ITelemetryService,
				storage: {} as IStorageService,
			}

			expect(mockCoreInterfaces).toBeDefined()
			expect(mockCoreInterfaces.userInterface).toBeDefined()
			expect(mockCoreInterfaces.fileSystem).toBeDefined()
			expect(mockCoreInterfaces.terminal).toBeDefined()
			expect(mockCoreInterfaces.browser).toBeDefined()
			expect(mockCoreInterfaces.telemetry).toBeDefined()
			expect(mockCoreInterfaces.storage).toBeDefined()
		})
	})

	describe("InterfaceFactory", () => {
		it("should define the factory function type", () => {
			const mockFactory: InterfaceFactory = async () => {
				return {
					userInterface: {} as IUserInterface,
					fileSystem: {} as IFileSystem,
					terminal: {} as ITerminal,
					browser: {} as IBrowser,
					telemetry: {} as ITelemetryService,
					storage: {} as IStorageService,
				}
			}

			expect(typeof mockFactory).toBe("function")
		})
	})

	describe("InterfaceConfig", () => {
		it("should validate configuration options", () => {
			const config: InterfaceConfig = {
				debug: true,
				timeouts: {
					command: 30000,
					browser: 10000,
					fileSystem: 5000,
				},
				platform: {
					vscodeContext: null,
					cliOptions: {
						interactive: true,
						verbose: false,
						outputFormat: "json",
					},
				},
			}

			expect(config.debug).toBe(true)
			expect(config.timeouts?.command).toBe(30000)
			expect(config.platform?.cliOptions?.outputFormat).toBe("json")
		})
	})

	describe("Interface Method Signatures", () => {
		it("should validate IUserInterface method signatures", async () => {
			const mockUserInterface: IUserInterface = {
				showInformation: jest.fn().mockResolvedValue(undefined),
				showWarning: jest.fn().mockResolvedValue(undefined),
				showError: jest.fn().mockResolvedValue(undefined),
				askQuestion: jest.fn().mockResolvedValue("answer"),
				askConfirmation: jest.fn().mockResolvedValue(true),
				askInput: jest.fn().mockResolvedValue("input"),
				showProgress: jest.fn().mockResolvedValue(undefined),
				clearProgress: jest.fn().mockResolvedValue(undefined),
				log: jest.fn().mockResolvedValue(undefined),
				showWebview: jest.fn().mockResolvedValue(undefined),
				sendWebviewMessage: jest.fn().mockResolvedValue(undefined),
				onWebviewMessage: jest.fn(),
			}

			// Test method calls
			await mockUserInterface.showInformation("Test message")
			await mockUserInterface.askQuestion("Test question?", { choices: ["Yes", "No"] })
			await mockUserInterface.askConfirmation("Confirm?")

			expect(mockUserInterface.showInformation).toHaveBeenCalledWith("Test message")
			expect(mockUserInterface.askQuestion).toHaveBeenCalledWith("Test question?", { choices: ["Yes", "No"] })
			expect(mockUserInterface.askConfirmation).toHaveBeenCalledWith("Confirm?")
		})

		it("should validate IFileSystem method signatures", async () => {
			const mockFileSystem: IFileSystem = {
				readFile: jest.fn().mockResolvedValue("file content"),
				writeFile: jest.fn().mockResolvedValue(undefined),
				appendFile: jest.fn().mockResolvedValue(undefined),
				exists: jest.fn().mockResolvedValue(true),
				stat: jest.fn().mockResolvedValue({} as FileStats),
				mkdir: jest.fn().mockResolvedValue(undefined),
				unlink: jest.fn().mockResolvedValue(undefined),
				rmdir: jest.fn().mockResolvedValue(undefined),
				readdir: jest.fn().mockResolvedValue([]),
				copy: jest.fn().mockResolvedValue(undefined),
				move: jest.fn().mockResolvedValue(undefined),
				watch: jest.fn().mockReturnValue({} as FileWatcher),
				resolve: jest.fn().mockReturnValue("/absolute/path"),
				join: jest.fn().mockReturnValue("joined/path"),
				dirname: jest.fn().mockReturnValue("/dir"),
				basename: jest.fn().mockReturnValue("file.txt"),
				extname: jest.fn().mockReturnValue(".txt"),
				normalize: jest.fn().mockReturnValue("normalized/path"),
				isAbsolute: jest.fn().mockReturnValue(true),
				relative: jest.fn().mockReturnValue("relative/path"),
				createDirectoriesForFile: jest.fn().mockResolvedValue([]),
				cwd: jest.fn().mockReturnValue("/current/dir"),
				chdir: jest.fn(),
			}

			// Test method calls
			const content = await mockFileSystem.readFile("/test/file.txt")
			await mockFileSystem.writeFile("/test/file.txt", "content")
			const exists = await mockFileSystem.exists("/test/file.txt")

			expect(content).toBe("file content")
			expect(exists).toBe(true)
			expect(mockFileSystem.readFile).toHaveBeenCalledWith("/test/file.txt")
			expect(mockFileSystem.writeFile).toHaveBeenCalledWith("/test/file.txt", "content")
		})
	})

	describe("Interface Compatibility", () => {
		it("should ensure interfaces can be implemented", () => {
			// This test validates that the interfaces are properly structured
			// and can be implemented without TypeScript errors

			class MockUserInterface implements IUserInterface {
				async showInformation(message: string, options?: MessageOptions): Promise<void> {
					// Mock implementation
				}

				async showWarning(message: string, options?: MessageOptions): Promise<void> {
					// Mock implementation
				}

				async showError(message: string, options?: MessageOptions): Promise<void> {
					// Mock implementation
				}

				async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
					return options.choices[0]
				}

				async askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean> {
					return true
				}

				async askInput(prompt: string, options?: InputOptions): Promise<string | undefined> {
					return "test input"
				}

				async showProgress(message: string, progress?: number): Promise<void> {
					// Mock implementation
				}

				async clearProgress(): Promise<void> {
					// Mock implementation
				}

				async log(message: string, level?: LogLevel): Promise<void> {
					// Mock implementation
				}

				async showWebview(content: WebviewContent, options?: WebviewOptions): Promise<void> {
					// Mock implementation
				}

				async sendWebviewMessage(message: any): Promise<void> {
					// Mock implementation
				}

				onWebviewMessage(callback: (message: any) => void): void {
					// Mock implementation
				}
			}

			const userInterface = new MockUserInterface()
			expect(userInterface).toBeInstanceOf(MockUserInterface)
		})
	})
})
