/**
 * Core interfaces for abstracting platform-specific functionality.
 * These interfaces enable the same core logic to work in both VS Code extension
 * and CLI environments by providing abstraction layers for:
 * - User interface interactions
 * - File system operations
 * - Terminal/command execution
 * - Browser automation
 */

// Re-export all types and interfaces
export type {
	IUserInterface,
	MessageOptions,
	QuestionOptions,
	ConfirmationOptions,
	InputOptions,
	LogLevel,
	WebviewContent,
	WebviewOptions,
} from "./IUserInterface"

export type {
	IFileSystem,
	BufferEncoding as FileSystemBufferEncoding,
	FileStats,
	MkdirOptions,
	RmdirOptions,
	ReaddirOptions,
	DirectoryEntry,
	CopyOptions,
	WatchOptions,
	FileWatcher,
} from "./IFileSystem"

export type {
	ITerminal,
	ITerminalSession,
	ExecuteCommandOptions,
	CommandResult,
	TerminalOptions,
	ProcessInfo,
	BufferEncoding as TerminalBufferEncoding,
} from "./ITerminal"

export type {
	IBrowser,
	IBrowserSession,
	BrowserType,
	ScrollDirection,
	BrowserEvent,
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
	ConsoleLogType,
	LogLocation,
	ViewportSize,
	ClipArea,
	MouseButton,
	ModifierKey,
	WaitCondition,
} from "./IBrowser"

// Import the interfaces for use in CoreInterfaces
import type { IUserInterface } from "./IUserInterface"
import type { IFileSystem } from "./IFileSystem"
import type { ITerminal } from "./ITerminal"
import type { IBrowser } from "./IBrowser"

/**
 * Core abstraction interfaces that separate platform-specific functionality
 * from business logic, enabling the same core agent logic to work in both
 * VS Code extension and CLI environments.
 */
export interface CoreInterfaces {
	/** User interface abstraction for displaying information and getting user input */
	userInterface: IUserInterface

	/** File system abstraction for file and directory operations */
	fileSystem: IFileSystem

	/** Terminal abstraction for command execution and process management */
	terminal: ITerminal

	/** Browser abstraction for web automation and interaction */
	browser: IBrowser
}

/**
 * Factory function type for creating platform-specific implementations
 * of the core interfaces.
 */
export type InterfaceFactory = () => Promise<CoreInterfaces>

/**
 * Configuration options for interface implementations
 */
export interface InterfaceConfig {
	/** Whether to enable debug logging */
	debug?: boolean

	/** Timeout values for various operations */
	timeouts?: {
		command?: number
		browser?: number
		fileSystem?: number
	}

	/** Platform-specific configuration */
	platform?: {
		/** VS Code extension context (when running in VS Code) */
		vscodeContext?: any

		/** CLI-specific options (when running in CLI) */
		cliOptions?: {
			interactive?: boolean
			verbose?: boolean
			outputFormat?: "json" | "text" | "markdown"
		}
	}
}
