import EventEmitter from "events"
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

		const process = new CLITerminalProcess(command, this.cliTerminal, this._cwd)
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
	) {
		super()
		this.command = command
	}

	async run(command: string): Promise<void> {
		this.command = command
		this.isHot = true

		try {
			// Signal execution started
			this.emit("shell_execution_started", undefined)

			// Execute command using CLI terminal
			const options: ExecuteCommandOptions = {
				cwd: this.cwd,
				captureStdout: true,
				captureStderr: true,
			}

			const result: CommandResult = await this.cliTerminal.executeCommand(command, options)

			// Store output for retrieval
			this._output = result.stdout + result.stderr
			this._retrieved = false

			// Emit line-by-line output for real-time feedback
			if (this._output) {
				const lines = this._output.split("\n")
				for (const line of lines) {
					if (line.trim()) {
						this.emit("line", line + "\n")
					}
				}
			}

			// Signal completion
			const exitDetails: ExitCodeDetails = {
				exitCode: result.exitCode,
				signal: result.signal ? parseInt(result.signal) : undefined,
				signalName: result.signal,
			}

			this.emit("shell_execution_complete", exitDetails)
			this.emit("completed", this._output)
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
