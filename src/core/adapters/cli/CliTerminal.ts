import { spawn, exec, ChildProcess } from "child_process"
import { promisify } from "util"
import * as path from "path"
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
 * CLI implementation of the ITerminal interface
 * Uses Node.js child_process for command execution
 */
export class CliTerminal implements ITerminal {
	private activeSessions: Map<string, ITerminalSession> = new Map()
	private currentWorkingDirectory: string = process.cwd()
	private environmentVariables: Record<string, string> = Object.fromEntries(
		Object.entries(process.env).filter(([_, value]) => value !== undefined),
	) as Record<string, string>

	async executeCommand(command: string, options?: ExecuteCommandOptions): Promise<CommandResult> {
		const startTime = Date.now()
		const workingDir = options?.cwd || this.currentWorkingDirectory
		const env = { ...this.environmentVariables, ...options?.env }

		try {
			const result = await execAsync(command, {
				cwd: workingDir,
				env,
				timeout: options?.timeout,
				maxBuffer: options?.maxBuffer || 1024 * 1024 * 10, // 10MB default
				encoding: options?.encoding || "utf8",
				killSignal: (options?.killSignal || "SIGTERM") as NodeJS.Signals,
			})

			const executionTime = Date.now() - startTime

			return {
				exitCode: 0,
				stdout: result.stdout,
				stderr: result.stderr,
				success: true,
				command,
				cwd: workingDir,
				executionTime,
			}
		} catch (error: any) {
			const executionTime = Date.now() - startTime

			return {
				exitCode: error.code || 1,
				stdout: error.stdout || "",
				stderr: error.stderr || error.message,
				success: false,
				error,
				command,
				cwd: workingDir,
				executionTime,
				killed: error.killed,
				signal: error.signal,
			}
		}
	}

	async executeCommandStreaming(
		command: string,
		options?: ExecuteCommandOptions,
		onOutput?: (output: string, isError: boolean) => void,
	): Promise<CommandResult> {
		return new Promise((resolve) => {
			const startTime = Date.now()
			const workingDir = options?.cwd || this.currentWorkingDirectory
			const env = { ...this.environmentVariables, ...options?.env }

			const childProcess = spawn(command, [], {
				shell: true,
				cwd: workingDir,
				env,
				stdio: ["pipe", "pipe", "pipe"],
				detached: options?.detached,
			})

			let stdout = ""
			let stderr = ""

			// Handle stdout
			childProcess.stdout?.on("data", (data) => {
				const output = data.toString()
				stdout += output
				onOutput?.(output, false)
			})

			// Handle stderr
			childProcess.stderr?.on("data", (data) => {
				const output = data.toString()
				stderr += output
				onOutput?.(output, true)
			})

			// Handle input if provided
			if (options?.input) {
				childProcess.stdin?.write(options.input)
				childProcess.stdin?.end()
			}

			// Handle process completion
			childProcess.on("close", (code, signal) => {
				const executionTime = Date.now() - startTime

				resolve({
					exitCode: code || 0,
					stdout,
					stderr,
					success: code === 0,
					command,
					cwd: workingDir,
					executionTime,
					pid: childProcess.pid,
					signal: signal || undefined,
					killed: childProcess.killed,
				})
			})

			// Handle process errors
			childProcess.on("error", (error) => {
				const executionTime = Date.now() - startTime

				resolve({
					exitCode: 1,
					stdout,
					stderr: stderr + error.message,
					success: false,
					error,
					command,
					cwd: workingDir,
					executionTime,
					pid: childProcess.pid,
				})
			})

			// Handle timeout
			if (options?.timeout) {
				setTimeout(() => {
					if (!childProcess.killed) {
						childProcess.kill((options.killSignal || "SIGTERM") as NodeJS.Signals)
					}
				}, options.timeout)
			}
		})
	}

	async createTerminal(options?: TerminalOptions): Promise<ITerminalSession> {
		const session = new CliTerminalSession(options || {})
		this.activeSessions.set(session.id, session)

		// Clean up when session is disposed
		session.onClose(() => {
			this.activeSessions.delete(session.id)
		})

		return session
	}

	async getTerminals(): Promise<ITerminalSession[]> {
		return Array.from(this.activeSessions.values())
	}

	async getCwd(): Promise<string> {
		return this.currentWorkingDirectory
	}

	async setCwd(path: string): Promise<void> {
		this.currentWorkingDirectory = path
		process.chdir(path)
	}

	async getEnvironment(): Promise<Record<string, string>> {
		return { ...this.environmentVariables }
	}

	async setEnvironmentVariable(name: string, value: string): Promise<void> {
		this.environmentVariables[name] = value
		process.env[name] = value
	}

	async isCommandAvailable(command: string): Promise<boolean> {
		try {
			const result = await this.executeCommand(`which ${command}`)
			return result.success
		} catch {
			// Try Windows 'where' command as fallback
			try {
				const result = await this.executeCommand(`where ${command}`)
				return result.success
			} catch {
				return false
			}
		}
	}

	async getShellType(): Promise<string> {
		if (process.platform === "win32") {
			return process.env.COMSPEC?.toLowerCase().includes("powershell") ? "powershell" : "cmd"
		} else {
			return path.basename(process.env.SHELL || "bash")
		}
	}

	async killProcess(pid: number, signal: string = "SIGTERM"): Promise<void> {
		try {
			process.kill(pid, signal as NodeJS.Signals)
		} catch (error) {
			throw new Error(`Failed to kill process ${pid}: ${error}`)
		}
	}

	async getProcesses(filter?: string): Promise<ProcessInfo[]> {
		const command = process.platform === "win32" ? "tasklist /FO CSV" : "ps aux"

		try {
			const result = await this.executeCommand(command)
			if (!result.success) {
				return []
			}

			const processes = this.parseProcessList(result.stdout, process.platform === "win32")

			if (filter) {
				return processes.filter(
					(proc) =>
						proc.name.toLowerCase().includes(filter.toLowerCase()) ||
						(proc.cmd && proc.cmd.toLowerCase().includes(filter.toLowerCase())),
				)
			}

			return processes
		} catch {
			return []
		}
	}

	private parseProcessList(output: string, isWindows: boolean): ProcessInfo[] {
		const lines = output.split("\n").filter((line) => line.trim())
		const processes: ProcessInfo[] = []

		if (isWindows) {
			// Parse Windows tasklist CSV output
			lines.slice(1).forEach((line) => {
				const parts = line.split(",").map((part) => part.replace(/"/g, ""))
				if (parts.length >= 2) {
					processes.push({
						pid: parseInt(parts[1]) || 0,
						name: parts[0] || "",
						memory: parseInt(parts[4]?.replace(/[^\d]/g, "")) || undefined,
					})
				}
			})
		} else {
			// Parse Unix ps output
			lines.slice(1).forEach((line) => {
				const parts = line.trim().split(/\s+/)
				if (parts.length >= 11) {
					processes.push({
						pid: parseInt(parts[1]) || 0,
						name: parts[10] || "",
						cmd: parts.slice(10).join(" "),
						cpu: parseFloat(parts[2]) || undefined,
						memory: parseInt(parts[5]) || undefined,
						ppid: parseInt(parts[2]) || undefined,
						user: parts[0] || undefined,
					})
				}
			})
		}

		return processes
	}
}

/**
 * CLI implementation of ITerminalSession
 */
class CliTerminalSession implements ITerminalSession {
	public readonly id: string
	public readonly name: string
	public isActive: boolean = true

	private childProcess: ChildProcess | null = null
	private outputCallbacks: ((output: string) => void)[] = []
	private closeCallbacks: ((exitCode: number | undefined) => void)[] = []
	private workingDirectory: string

	constructor(options: TerminalOptions) {
		this.id = `cli-terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		this.name = options.name || `Terminal ${this.id.slice(-6)}`
		this.workingDirectory = options.cwd || process.cwd()

		this.initializeSession(options)
	}

	private initializeSession(options: TerminalOptions): void {
		// For CLI, we don't start a persistent shell process by default
		// Commands will be executed on-demand via sendText
		if (options.clear) {
			this.sendOutput("\x1bc") // Clear screen
		}
	}

	async sendText(text: string, addNewLine: boolean = true): Promise<void> {
		const command = addNewLine ? text + "\n" : text

		// Execute the command and capture output
		try {
			const terminal = new CliTerminal()
			const result = await terminal.executeCommandStreaming(
				text,
				{ cwd: this.workingDirectory },
				(output, isError) => {
					this.sendOutput(output)
				},
			)

			// Update working directory if command was 'cd'
			if (text.trim().startsWith("cd ")) {
				const newDir = text.trim().substring(3).trim()
				if (newDir && result.success) {
					this.workingDirectory = path.resolve(this.workingDirectory, newDir)
				}
			}
		} catch (error) {
			this.sendOutput(`Error: ${error}\n`)
		}
	}

	async show(): Promise<void> {
		// In CLI mode, terminals are always "shown" in the console
		this.isActive = true
	}

	async hide(): Promise<void> {
		// In CLI mode, we can't really hide the terminal
		this.isActive = false
	}

	async dispose(): Promise<void> {
		this.isActive = false

		if (this.childProcess && !this.childProcess.killed) {
			this.childProcess.kill("SIGTERM")
		}

		this.closeCallbacks.forEach((callback) => callback(undefined))
	}

	async getCwd(): Promise<string> {
		return this.workingDirectory
	}

	onOutput(callback: (output: string) => void): void {
		this.outputCallbacks.push(callback)
	}

	onClose(callback: (exitCode: number | undefined) => void): void {
		this.closeCallbacks.push(callback)
	}

	async getProcessId(): Promise<number | undefined> {
		return this.childProcess?.pid
	}

	private sendOutput(output: string): void {
		this.outputCallbacks.forEach((callback) => callback(output))
		// Also log to console in CLI mode
		process.stdout.write(output)
	}
}
