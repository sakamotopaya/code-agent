import * as vscode from "vscode"
import { spawn, exec, ChildProcess } from "child_process"
import * as os from "os"
import * as path from "path"
import {
	ITerminal,
	ITerminalSession,
	ExecuteCommandOptions,
	CommandResult,
	TerminalOptions,
	ProcessInfo,
	BufferEncoding,
} from "../../interfaces/ITerminal"

/**
 * VS Code implementation of a terminal session
 */
class VsCodeTerminalSession implements ITerminalSession {
	public readonly id: string
	public readonly name: string
	public isActive: boolean = true

	private outputCallback?: (output: string) => void
	private closeCallback?: (exitCode: number | undefined) => void

	constructor(private terminal: vscode.Terminal) {
		this.id = Math.random().toString(36).substr(2, 9)
		this.name = terminal.name
	}

	async sendText(text: string, addNewLine: boolean = true): Promise<void> {
		this.terminal.sendText(text, addNewLine)
	}

	async show(): Promise<void> {
		this.terminal.show()
	}

	async hide(): Promise<void> {
		this.terminal.hide()
	}

	async dispose(): Promise<void> {
		this.terminal.dispose()
		this.isActive = false
		this.closeCallback?.(0)
	}

	async getCwd(): Promise<string> {
		// VS Code doesn't provide direct access to terminal CWD
		// We'll return the workspace root as a fallback
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders && workspaceFolders.length > 0) {
			return workspaceFolders[0].uri.fsPath
		}
		return process.cwd()
	}

	onOutput(callback: (output: string) => void): void {
		this.outputCallback = callback
		// Note: VS Code doesn't provide direct terminal output access
		// This would need to be implemented with a custom terminal provider
	}

	onClose(callback: (exitCode: number | undefined) => void): void {
		this.closeCallback = callback
		// Listen for terminal disposal
		vscode.window.onDidCloseTerminal((closedTerminal) => {
			if (closedTerminal === this.terminal) {
				this.isActive = false
				callback(undefined)
			}
		})
	}

	async getProcessId(): Promise<number | undefined> {
		return this.terminal.processId
	}
}

/**
 * VS Code implementation of the ITerminal interface.
 * Provides terminal operations using VS Code's integrated terminal and Node.js child_process.
 */
export class VsCodeTerminal implements ITerminal {
	private terminals: Map<string, VsCodeTerminalSession> = new Map()
	private currentCwd: string

	constructor(private context: vscode.ExtensionContext) {
		this.currentCwd = this.getWorkspaceRoot()

		// Clean up disposed terminals
		vscode.window.onDidCloseTerminal((terminal) => {
			for (const [id, session] of this.terminals.entries()) {
				if (session.name === terminal.name) {
					session.isActive = false
					this.terminals.delete(id)
					break
				}
			}
		})
	}

	async executeCommand(command: string, options?: ExecuteCommandOptions): Promise<CommandResult> {
		const startTime = Date.now()

		return new Promise((resolve) => {
			const execOptions = {
				cwd: options?.cwd || this.currentCwd,
				env: { ...process.env, ...options?.env },
				timeout: options?.timeout || 30000,
				maxBuffer: options?.maxBuffer || 1024 * 1024,
				encoding: (options?.encoding || "utf8") as BufferEncoding,
				shell: typeof options?.shell === "string" ? options.shell : options?.shell ? "/bin/sh" : undefined,
			}

			exec(command, execOptions, (error: any, stdout: any, stderr: any) => {
				const executionTime = Date.now() - startTime
				const exitCode = error?.code || 0

				const result: CommandResult = {
					exitCode,
					stdout: stdout || "",
					stderr: stderr || "",
					success: exitCode === 0,
					error,
					command,
					cwd: execOptions.cwd,
					executionTime,
					killed: error?.killed,
					signal: error?.signal,
				}

				resolve(result)
			})
		})
	}

	async executeCommandStreaming(
		command: string,
		options?: ExecuteCommandOptions,
		onOutput?: (output: string, isError: boolean) => void,
	): Promise<CommandResult> {
		const startTime = Date.now()

		return new Promise((resolve) => {
			const spawnOptions = {
				cwd: options?.cwd || this.currentCwd,
				env: { ...process.env, ...options?.env },
				shell: options?.shell || true,
				detached: options?.detached || false,
			}

			let child: ChildProcess

			if (spawnOptions.shell) {
				// When using shell mode, pass command as string to first argument
				// This allows complex shell features like pipes, redirections, etc.
				child = spawn(command, [], spawnOptions)
			} else {
				// When not using shell, properly parse command and arguments
				// This is more secure and doesn't rely on shell parsing
				const parsedCommand = this.parseCommand(command)
				child = spawn(parsedCommand.executable, parsedCommand.args, spawnOptions)
			}
			let stdout = ""
			let stderr = ""

			child.stdout?.on("data", (data: Buffer) => {
				const output = data.toString()
				stdout += output
				onOutput?.(output, false)
			})

			child.stderr?.on("data", (data: Buffer) => {
				const output = data.toString()
				stderr += output
				onOutput?.(output, true)
			})

			if (options?.input) {
				child.stdin?.write(options.input)
				child.stdin?.end()
			}

			child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
				const executionTime = Date.now() - startTime

				const result: CommandResult = {
					exitCode: code || 0,
					stdout,
					stderr,
					success: (code || 0) === 0,
					command,
					cwd: spawnOptions.cwd,
					executionTime,
					pid: child.pid,
					signal: signal || undefined,
					killed: child.killed,
				}

				resolve(result)
			})

			child.on("error", (error: Error) => {
				const executionTime = Date.now() - startTime

				const result: CommandResult = {
					exitCode: 1,
					stdout,
					stderr,
					success: false,
					error,
					command,
					cwd: spawnOptions.cwd,
					executionTime,
					pid: child.pid,
				}

				resolve(result)
			})
		})
	}

	async createTerminal(options?: TerminalOptions): Promise<ITerminalSession> {
		const terminalOptions: vscode.TerminalOptions = {
			name: options?.name || `Terminal ${this.terminals.size + 1}`,
			cwd: options?.cwd || this.currentCwd,
			env: options?.env,
			shellPath: options?.shellPath,
			shellArgs: options?.shellArgs,
			hideFromUser: options?.hideFromUser,
			iconPath: options?.iconPath ? vscode.Uri.file(options.iconPath) : undefined,
			color: options?.color ? new vscode.ThemeColor(options.color) : undefined,
		}

		const terminal = vscode.window.createTerminal(terminalOptions)
		const session = new VsCodeTerminalSession(terminal)

		this.terminals.set(session.id, session)

		if (options?.clear) {
			await session.sendText("clear", true)
		}

		return session
	}

	async getTerminals(): Promise<ITerminalSession[]> {
		return Array.from(this.terminals.values()).filter((t) => t.isActive)
	}

	async getCwd(): Promise<string> {
		return this.currentCwd
	}

	async setCwd(path: string): Promise<void> {
		this.currentCwd = path
	}

	async getEnvironment(): Promise<Record<string, string>> {
		return { ...process.env } as Record<string, string>
	}

	async setEnvironmentVariable(name: string, value: string): Promise<void> {
		process.env[name] = value
	}

	async isCommandAvailable(command: string): Promise<boolean> {
		try {
			const result = await this.executeCommand(
				os.platform() === "win32" ? `where ${command}` : `which ${command}`,
				{ timeout: 5000 },
			)
			return result.success
		} catch {
			return false
		}
	}

	async getShellType(): Promise<string> {
		const shell = process.env.SHELL || process.env.ComSpec || ""

		if (shell.includes("bash")) return "bash"
		if (shell.includes("zsh")) return "zsh"
		if (shell.includes("fish")) return "fish"
		if (shell.includes("cmd")) return "cmd"
		if (shell.includes("powershell") || shell.includes("pwsh")) return "powershell"

		return path.basename(shell) || "unknown"
	}

	async killProcess(pid: number, signal: string = "SIGTERM"): Promise<void> {
		try {
			process.kill(pid, signal as NodeJS.Signals)
		} catch (error) {
			throw new Error(`Failed to kill process ${pid}: ${error}`)
		}
	}

	async getProcesses(filter?: string): Promise<ProcessInfo[]> {
		try {
			const command = os.platform() === "win32" ? "tasklist /fo csv" : "ps aux"

			const result = await this.executeCommand(command, { timeout: 10000 })

			if (!result.success) {
				return []
			}

			const processes: ProcessInfo[] = []
			const lines = result.stdout.split("\n").slice(1) // Skip header

			for (const line of lines) {
				if (!line.trim()) continue

				if (os.platform() === "win32") {
					// Parse Windows tasklist output
					const parts = line.split('","').map((p) => p.replace(/"/g, ""))
					if (parts.length >= 2) {
						const name = parts[0]
						const pid = parseInt(parts[1])

						if (!isNaN(pid) && (!filter || name.toLowerCase().includes(filter.toLowerCase()))) {
							processes.push({
								pid,
								name,
								cmd: name,
							})
						}
					}
				} else {
					// Parse Unix ps output
					const parts = line.trim().split(/\s+/)
					if (parts.length >= 11) {
						const pid = parseInt(parts[1])
						const name = parts[10]
						const cmd = parts.slice(10).join(" ")

						if (!isNaN(pid) && (!filter || name.toLowerCase().includes(filter.toLowerCase()))) {
							processes.push({
								pid,
								name,
								cmd,
								user: parts[0],
								cpu: parseFloat(parts[2]) || undefined,
								memory: parseFloat(parts[3]) || undefined,
								ppid: parseInt(parts[2]) || undefined,
							})
						}
					}
				}
			}

			return processes
		} catch {
			return []
		}
	}

	/**
	 * Parse a command string into executable and arguments.
	 * This is a simple implementation that handles basic cases.
	 * For complex shell features, use shell mode instead.
	 */
	private parseCommand(command: string): { executable: string; args: string[] } {
		// Simple parsing - split on spaces but respect quoted strings
		const parts: string[] = []
		let current = ""
		let inQuotes = false
		let quoteChar = ""

		for (let i = 0; i < command.length; i++) {
			const char = command[i]

			if ((char === '"' || char === "'") && !inQuotes) {
				inQuotes = true
				quoteChar = char
			} else if (char === quoteChar && inQuotes) {
				inQuotes = false
				quoteChar = ""
			} else if (char === " " && !inQuotes) {
				if (current.trim()) {
					parts.push(current.trim())
					current = ""
				}
			} else {
				current += char
			}
		}

		if (current.trim()) {
			parts.push(current.trim())
		}

		return {
			executable: parts[0] || command,
			args: parts.slice(1),
		}
	}

	private getWorkspaceRoot(): string {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders && workspaceFolders.length > 0) {
			return workspaceFolders[0].uri.fsPath
		}
		return process.cwd()
	}
}
