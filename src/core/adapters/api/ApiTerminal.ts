import { spawn, exec, ChildProcess } from "child_process"
import { promisify } from "util"
import {
	ITerminal,
	ITerminalSession,
	ExecuteCommandOptions,
	CommandResult,
	TerminalOptions,
	ProcessInfo,
} from "../../interfaces"

const execAsync = promisify(exec)

/**
 * Options for API Terminal adapter
 */
export interface ApiTerminalOptions {
	verbose?: boolean
	defaultCwd?: string
}

/**
 * API implementation of terminal session
 */
export class ApiTerminalSession implements ITerminalSession {
	private process: ChildProcess | null = null
	private options: ApiTerminalOptions
	private _sessionId: string
	private _isRunning = false
	private _name: string

	constructor(sessionId: string, options: ApiTerminalOptions = {}) {
		this._sessionId = sessionId
		this._name = `API Terminal ${sessionId}`
		this.options = options
	}

	private log(message: string): void {
		if (this.options.verbose) {
			console.log(`[API Terminal Session] ${message}`)
		}
	}

	get id(): string {
		return this._sessionId
	}

	get name(): string {
		return this._name
	}

	get isActive(): boolean {
		return this._isRunning
	}

	async sendText(text: string, addNewLine: boolean = true): Promise<void> {
		if (this.process && this.process.stdin) {
			const textToSend = addNewLine ? text + "\n" : text
			this.process.stdin.write(textToSend)
		}
	}

	async show(): Promise<void> {
		// In API context, showing terminal is not applicable
		this.log(`Show terminal: ${this._sessionId}`)
	}

	async hide(): Promise<void> {
		// In API context, hiding terminal is not applicable
		this.log(`Hide terminal: ${this._sessionId}`)
	}

	async getCwd(): Promise<string> {
		return this.options.defaultCwd || process.cwd()
	}

	async dispose(): Promise<void> {
		if (this.process) {
			this.process.kill()
			this._isRunning = false
		}
		this.process = null
	}

	async getProcessId(): Promise<number | undefined> {
		return this.process?.pid
	}

	onOutput(callback: (output: string) => void): void {
		if (this.process) {
			this.process.stdout?.on("data", (data) => callback(data.toString()))
			this.process.stderr?.on("data", (data) => callback(data.toString()))
		}
	}

	onClose(callback: (exitCode: number | undefined) => void): void {
		if (this.process) {
			this.process.on("exit", callback)
		}
	}
}

/**
 * API implementation of the ITerminal interface
 * Provides command execution capabilities for API requests
 */
export class ApiTerminal implements ITerminal {
	private options: ApiTerminalOptions
	private sessions: Map<string, ApiTerminalSession> = new Map()
	private sessionCounter = 0
	private currentCwd: string

	constructor(options: ApiTerminalOptions = {}) {
		this.options = {
			verbose: false,
			defaultCwd: process.cwd(),
			...options,
		}
		this.currentCwd = this.options.defaultCwd || process.cwd()
	}

	private log(message: string): void {
		if (this.options.verbose) {
			console.log(`[API Terminal] ${message}`)
		}
	}

	async executeCommand(command: string, options?: ExecuteCommandOptions): Promise<CommandResult> {
		this.log(`Executing command: ${command}`)

		const startTime = Date.now()

		try {
			const cwd = options?.cwd || this.currentCwd
			const timeout = options?.timeout || 30000
			const env = { ...process.env, ...options?.env }

			const { stdout, stderr } = await execAsync(command, {
				cwd,
				timeout,
				env,
				maxBuffer: 1024 * 1024, // 1MB buffer
			})

			const duration = Date.now() - startTime

			const result: CommandResult = {
				stdout: stdout || "",
				stderr: stderr || "",
				exitCode: 0,
				command,
				executionTime: duration,
				success: true,
				cwd,
			}

			this.log(`Command completed successfully in ${duration}ms`)
			return result
		} catch (error: any) {
			const duration = Date.now() - startTime

			const result: CommandResult = {
				stdout: error.stdout || "",
				stderr: error.stderr || error.message,
				exitCode: error.code || 1,
				command,
				executionTime: duration,
				success: false,
				error: new Error(error.message),
				cwd: options?.cwd || this.currentCwd,
			}

			this.log(`Command failed after ${duration}ms: ${error.message}`)
			return result
		}
	}

	async executeCommandStreaming(
		command: string,
		options?: ExecuteCommandOptions,
		onOutput?: (output: string, isError: boolean) => void,
	): Promise<CommandResult> {
		this.log(`Executing command with streaming: ${command}`)

		return new Promise((resolve) => {
			const startTime = Date.now()
			const cwd = options?.cwd || this.currentCwd
			const env = { ...process.env, ...options?.env }

			const child = spawn(command, [], {
				shell: true,
				cwd,
				env,
				stdio: ["pipe", "pipe", "pipe"],
			})

			let stdout = ""
			let stderr = ""

			child.stdout?.on("data", (data) => {
				const output = data.toString()
				stdout += output
				onOutput?.(output, false)
			})

			child.stderr?.on("data", (data) => {
				const output = data.toString()
				stderr += output
				onOutput?.(output, true)
			})

			child.on("close", (exitCode) => {
				const duration = Date.now() - startTime
				resolve({
					stdout,
					stderr,
					exitCode: exitCode || 0,
					command,
					executionTime: duration,
					success: exitCode === 0,
					pid: child.pid,
					cwd,
				})
			})

			child.on("error", (error) => {
				const duration = Date.now() - startTime
				resolve({
					stdout,
					stderr: error.message,
					exitCode: 1,
					command,
					executionTime: duration,
					success: false,
					error,
					cwd,
				})
			})
		})
	}

	async createTerminal(options?: TerminalOptions): Promise<ITerminalSession> {
		const sessionId = `api-terminal-${++this.sessionCounter}`
		this.log(`Creating terminal session: ${sessionId}`)

		const session = new ApiTerminalSession(sessionId, {
			...this.options,
			defaultCwd: options?.cwd || this.currentCwd,
		})

		this.sessions.set(sessionId, session)
		return session
	}

	async getTerminals(): Promise<ITerminalSession[]> {
		return Array.from(this.sessions.values())
	}

	async getCwd(): Promise<string> {
		return this.currentCwd
	}

	async setCwd(path: string): Promise<void> {
		this.currentCwd = path
		this.log(`Changed working directory to: ${path}`)
	}

	async getEnvironment(): Promise<Record<string, string>> {
		return { ...process.env } as Record<string, string>
	}

	async setEnvironmentVariable(name: string, value: string): Promise<void> {
		process.env[name] = value
		this.log(`Set environment variable: ${name}=${value}`)
	}

	async isCommandAvailable(command: string): Promise<boolean> {
		try {
			const checkCommand = process.platform === "win32" ? "where" : "which"
			const result = await this.executeCommand(`${checkCommand} ${command}`)
			return result.success
		} catch {
			return false
		}
	}

	async getShellType(): Promise<string> {
		if (process.platform === "win32") {
			return process.env.COMSPEC || "cmd.exe"
		}
		return process.env.SHELL || "/bin/bash"
	}

	async killProcess(pid: number, signal?: string): Promise<void> {
		try {
			let command: string
			if (process.platform === "win32") {
				command = `taskkill /pid ${pid} /f`
			} else {
				command = `kill ${signal ? `-${signal}` : ""} ${pid}`
			}

			const result = await this.executeCommand(command)
			this.log(`Kill process ${pid}: ${result.success ? "success" : "failed"}`)

			if (!result.success) {
				throw new Error(`Failed to kill process ${pid}: ${result.stderr}`)
			}
		} catch (error) {
			this.log(`Failed to kill process ${pid}: ${error}`)
			throw error
		}
	}

	async getProcesses(filter?: string): Promise<ProcessInfo[]> {
		const processes: ProcessInfo[] = []

		try {
			let command: string
			if (process.platform === "win32") {
				command = "tasklist /fo csv"
			} else {
				command = "ps aux"
			}

			const result = await this.executeCommand(command)
			if (result.success && result.stdout) {
				// Parse process information (simplified implementation)
				const lines = result.stdout.split("\n").filter((line) => line.trim())

				for (let i = 1; i < lines.length && i < 50; i++) {
					// Limit to 50 processes
					const line = lines[i]
					if (line.trim() && (!filter || line.toLowerCase().includes(filter.toLowerCase()))) {
						processes.push({
							pid: i, // Simplified - would need proper parsing
							name: line.split(/\s+/)[0] || "unknown",
							cmd: line.trim(),
						})
					}
				}
			}
		} catch (error) {
			this.log(`Failed to list processes: ${error}`)
		}

		return processes
	}
}
