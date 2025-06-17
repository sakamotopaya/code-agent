import EventEmitter from "events"
import { spawn, ChildProcess } from "child_process"
import { ITerminal, CommandResult, ExecuteCommandOptions } from "../../interfaces/ITerminal"
import {
	RooTerminal,
	RooTerminalCallbacks,
	RooTerminalProcess,
	RooTerminalProcessResultPromise,
	RooTerminalProcessEvents,
	ExitCodeDetails,
} from "../../../integrations/terminal/types"

/**
 * Adapter that bridges the CLI ITerminal interface to the RooTerminal interface
 * expected by executeCommandTool. This allows the execute_command tool to work
 * in CLI context using the existing CLI terminal infrastructure.
 */
export class CLITerminalAdapter implements RooTerminal {
	public readonly provider = "execa" as const
	public readonly id: number
	public busy = false
	public running = false
	public taskId?: string
	public process?: RooTerminalProcess

	private _cwd: string

	constructor(
		private readonly cliTerminal: ITerminal,
		initialCwd: string,
		id: number = Date.now(),
		taskId?: string,
		private readonly verbose: boolean = false,
	) {
		this.id = id
		this.taskId = taskId
		this._cwd = initialCwd
	}

	getCurrentWorkingDirectory(): string {
		return this._cwd
	}

	isClosed(): boolean {
		// CLI terminals are never considered "closed" in the same way as VSCode terminals
		return false
	}

	runCommand(command: string, callbacks: RooTerminalCallbacks): RooTerminalProcessResultPromise {
		this.busy = true
		this.running = true

		const process = new CLITerminalProcess(command, this.cliTerminal, this._cwd, this.verbose)
		this.process = process

		// Set up event listeners to bridge to callbacks
		process.on("line", (line) => callbacks.onLine(line, process))
		process.on("completed", (output) => callbacks.onCompleted(output, process))
		process.on("shell_execution_started", (pid) => callbacks.onShellExecutionStarted(pid, process))
		process.on("shell_execution_complete", (details) => callbacks.onShellExecutionComplete(details, process))

		// Start command execution
		const promise = process.run(command).finally(() => {
			this.busy = false
			this.running = false
		})

		// Create merged object that implements both RooTerminalProcess and Promise<void>
		return Object.assign(process, promise) as RooTerminalProcessResultPromise
	}

	setActiveStream(stream: AsyncIterable<string> | undefined, pid?: number): void {
		// CLI terminals don't use VSCode's shell integration streams
		// This is a no-op for CLI context
	}

	shellExecutionComplete(exitDetails: ExitCodeDetails): void {
		if (this.process) {
			this.process.emit("shell_execution_complete", exitDetails)
		}
		this.running = false
	}

	getProcessesWithOutput(): RooTerminalProcess[] {
		// CLI adapter maintains single process at a time
		return this.process && this.process.hasUnretrievedOutput() ? [this.process] : []
	}

	getUnretrievedOutput(): string {
		return this.process?.getUnretrievedOutput() || ""
	}

	getLastCommand(): string {
		return this.process?.command || ""
	}

	cleanCompletedProcessQueue(): void {
		// CLI adapter doesn't maintain a process queue
		// This is a no-op for CLI context
	}
}

/**
 * CLI implementation of RooTerminalProcess that bridges to ITerminal.executeCommand
 */
class CLITerminalProcess extends EventEmitter<RooTerminalProcessEvents> implements RooTerminalProcess {
	public command: string = ""
	public isHot = false

	private _output = ""
	private _retrieved = false

	constructor(
		command: string,
		private readonly cliTerminal: ITerminal,
		private readonly cwd: string,
		private readonly verbose: boolean = false,
	) {
		super()
		this.command = command
	}

	async run(command: string): Promise<void> {
		this.command = command
		this.isHot = true

		try {
			// Use spawn to get access to actual PID
			const childProcess: ChildProcess = spawn(command, [], {
				shell: true,
				cwd: this.cwd,
				stdio: ["pipe", "pipe", "pipe"],
				env: process.env,
			})

			// Signal execution started with actual PID
			if (this.verbose) {
				console.log(`[CLITerminalProcess] Process started with PID: ${childProcess.pid}`)
			}
			this.emit("shell_execution_started", childProcess.pid)

			let stdout = ""
			let stderr = ""

			// Capture stdout
			if (childProcess.stdout) {
				childProcess.stdout.on("data", (data: Buffer) => {
					const output = data.toString()
					stdout += output
					// Emit line-by-line output for real-time feedback
					const lines = output.split("\n")
					for (const line of lines) {
						if (line.trim()) {
							this.emit("line", line + "\n")
						}
					}
				})
			}

			// Capture stderr
			if (childProcess.stderr) {
				childProcess.stderr.on("data", (data: Buffer) => {
					const output = data.toString()
					stderr += output
					// Also emit stderr as lines
					const lines = output.split("\n")
					for (const line of lines) {
						if (line.trim()) {
							this.emit("line", line + "\n")
						}
					}
				})
			}

			// Wait for process completion
			await new Promise<void>((resolve, reject) => {
				childProcess.on("close", (code, signal) => {
					// Store output for retrieval
					this._output = stdout + stderr
					this._retrieved = false

					// Signal completion
					const exitDetails: ExitCodeDetails = {
						exitCode: code || 0,
						signal: signal ? parseInt(signal) : undefined,
						signalName: signal || undefined,
					}

					this.emit("shell_execution_complete", exitDetails)
					this.emit("completed", this._output)
					resolve()
				})

				childProcess.on("error", (error) => {
					this.emit("error", error)
					reject(error)
				})
			})
		} catch (error) {
			this.emit("error", error as Error)
		} finally {
			this.isHot = false
		}
	}

	continue(): void {
		this.emit("continue")
	}

	abort(): void {
		// For CLI context, we can't easily abort running commands
		// This would require process management improvements
		this.isHot = false
		this.emit("error", new Error("Command aborted"))
	}

	hasUnretrievedOutput(): boolean {
		return !this._retrieved && this._output.length > 0
	}

	getUnretrievedOutput(): string {
		if (!this._retrieved) {
			this._retrieved = true
			return this._output
		}
		return ""
	}
}
