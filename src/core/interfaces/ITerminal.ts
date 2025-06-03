/**
 * Interface for terminal operations abstraction.
 * Provides methods for executing commands and managing terminal sessions
 * in both VS Code extension and CLI environments.
 */
export interface ITerminal {
	/**
	 * Execute a command in the terminal
	 * @param command The command to execute
	 * @param options Execution options
	 * @returns The command execution result
	 */
	executeCommand(command: string, options?: ExecuteCommandOptions): Promise<CommandResult>

	/**
	 * Execute a command and stream the output
	 * @param command The command to execute
	 * @param options Execution options
	 * @param onOutput Callback for streaming output
	 * @returns The command execution result
	 */
	executeCommandStreaming(
		command: string,
		options?: ExecuteCommandOptions,
		onOutput?: (output: string, isError: boolean) => void,
	): Promise<CommandResult>

	/**
	 * Create a new terminal session
	 * @param options Terminal creation options
	 * @returns A terminal session instance
	 */
	createTerminal(options?: TerminalOptions): Promise<ITerminalSession>

	/**
	 * Get all active terminal sessions
	 * @returns Array of active terminal sessions
	 */
	getTerminals(): Promise<ITerminalSession[]>

	/**
	 * Get the current working directory
	 * @returns The current working directory
	 */
	getCwd(): Promise<string>

	/**
	 * Change the current working directory
	 * @param path The new working directory
	 */
	setCwd(path: string): Promise<void>

	/**
	 * Get environment variables
	 * @returns Object containing environment variables
	 */
	getEnvironment(): Promise<Record<string, string>>

	/**
	 * Set an environment variable
	 * @param name The variable name
	 * @param value The variable value
	 */
	setEnvironmentVariable(name: string, value: string): Promise<void>

	/**
	 * Check if a command is available in the system PATH
	 * @param command The command to check
	 * @returns True if the command is available
	 */
	isCommandAvailable(command: string): Promise<boolean>

	/**
	 * Get the shell type (bash, zsh, cmd, powershell, etc.)
	 * @returns The shell type
	 */
	getShellType(): Promise<string>

	/**
	 * Kill a running process by PID
	 * @param pid The process ID to kill
	 * @param signal The signal to send (default: SIGTERM)
	 */
	killProcess(pid: number, signal?: string): Promise<void>

	/**
	 * Get running processes
	 * @param filter Optional filter for process names
	 * @returns Array of running processes
	 */
	getProcesses(filter?: string): Promise<ProcessInfo[]>
}

/**
 * Interface for individual terminal sessions
 */
export interface ITerminalSession {
	/** Unique identifier for the terminal session */
	id: string

	/** Name of the terminal session */
	name: string

	/** Whether the terminal is active */
	isActive: boolean

	/**
	 * Send text to the terminal
	 * @param text The text to send
	 * @param addNewLine Whether to add a newline (default: true)
	 */
	sendText(text: string, addNewLine?: boolean): Promise<void>

	/**
	 * Show the terminal (bring to front)
	 */
	show(): Promise<void>

	/**
	 * Hide the terminal
	 */
	hide(): Promise<void>

	/**
	 * Dispose/close the terminal
	 */
	dispose(): Promise<void>

	/**
	 * Get the current working directory of this terminal
	 * @returns The current working directory
	 */
	getCwd(): Promise<string>

	/**
	 * Listen for output from the terminal
	 * @param callback The callback to handle output
	 */
	onOutput(callback: (output: string) => void): void

	/**
	 * Listen for terminal close events
	 * @param callback The callback to handle close events
	 */
	onClose(callback: (exitCode: number | undefined) => void): void

	/**
	 * Get the process ID of the terminal
	 * @returns The process ID
	 */
	getProcessId(): Promise<number | undefined>
}

/**
 * Options for executing commands
 */
export interface ExecuteCommandOptions {
	/** Working directory for the command */
	cwd?: string

	/** Environment variables for the command */
	env?: Record<string, string>

	/** Timeout in milliseconds */
	timeout?: number

	/** Whether to capture stdout */
	captureStdout?: boolean

	/** Whether to capture stderr */
	captureStderr?: boolean

	/** Input to send to the command */
	input?: string

	/** Shell to use for execution */
	shell?: string | boolean

	/** Whether to run the command in the background */
	detached?: boolean

	/** Signal to use for killing the process */
	killSignal?: string

	/** Maximum buffer size for output */
	maxBuffer?: number

	/** Encoding for the output */
	encoding?: BufferEncoding
}

/**
 * Result of command execution
 */
export interface CommandResult {
	/** Exit code of the command */
	exitCode: number

	/** Standard output */
	stdout: string

	/** Standard error */
	stderr: string

	/** Whether the command was successful (exitCode === 0) */
	success: boolean

	/** Error object if execution failed */
	error?: Error

	/** Process ID of the executed command */
	pid?: number

	/** Signal that terminated the process */
	signal?: string

	/** Whether the process was killed */
	killed?: boolean

	/** Command that was executed */
	command: string

	/** Working directory where command was executed */
	cwd?: string

	/** Execution time in milliseconds */
	executionTime: number
}

/**
 * Options for creating terminals
 */
export interface TerminalOptions {
	/** Name for the terminal */
	name?: string

	/** Working directory for the terminal */
	cwd?: string

	/** Environment variables for the terminal */
	env?: Record<string, string>

	/** Shell path to use */
	shellPath?: string

	/** Shell arguments */
	shellArgs?: string[]

	/** Whether the terminal should be hidden initially */
	hideFromUser?: boolean

	/** Icon for the terminal */
	iconPath?: string

	/** Color for the terminal */
	color?: string

	/** Whether to clear the terminal on creation */
	clear?: boolean
}

/**
 * Information about a running process
 */
export interface ProcessInfo {
	/** Process ID */
	pid: number

	/** Process name */
	name: string

	/** Command line */
	cmd?: string

	/** CPU usage percentage */
	cpu?: number

	/** Memory usage in bytes */
	memory?: number

	/** Parent process ID */
	ppid?: number

	/** User running the process */
	user?: string

	/** Process start time */
	startTime?: Date
}

/**
 * Buffer encoding types
 */
export type BufferEncoding =
	| "ascii"
	| "utf8"
	| "utf-8"
	| "utf16le"
	| "ucs2"
	| "ucs-2"
	| "base64"
	| "base64url"
	| "latin1"
	| "binary"
	| "hex"
