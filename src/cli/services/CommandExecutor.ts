import { BatchCommand, CommandResult } from "../types/batch-types"
import { AutomationContext } from "../types/automation-types"
import { ExitCode } from "../types/exit-codes"
import { spawn, ChildProcess } from "child_process"
import * as path from "path"

export class CommandExecutor {
	private context: AutomationContext

	constructor(context: AutomationContext) {
		this.context = context
	}

	async execute(command: BatchCommand): Promise<CommandResult> {
		const startTime = new Date()

		try {
			if (this.context.dryRun) {
				return this.createDryRunResult(command, startTime)
			}

			const result = await this.executeCommand(command)
			const endTime = new Date()
			const duration = endTime.getTime() - startTime.getTime()

			return {
				id: command.id,
				command: command.command,
				success: result.exitCode === 0,
				exitCode: result.exitCode,
				stdout: result.stdout,
				stderr: result.stderr,
				duration,
				startTime,
				endTime,
			}
		} catch (error) {
			const endTime = new Date()
			const duration = endTime.getTime() - startTime.getTime()

			return {
				id: command.id,
				command: command.command,
				success: false,
				exitCode: ExitCode.GENERAL_ERROR,
				stderr: error instanceof Error ? error.message : String(error),
				duration,
				startTime,
				endTime,
				error: error instanceof Error ? error : new Error(String(error)),
			}
		}
	}

	private async executeCommand(command: BatchCommand): Promise<{
		exitCode: number
		stdout: string
		stderr: string
	}> {
		return new Promise((resolve, reject) => {
			const timeout = command.timeout || this.context.timeout
			const workingDirectory = command.workingDirectory || process.cwd()
			const environment = {
				...process.env,
				...command.environment,
			}

			// Parse command and arguments
			const [cmd, ...args] = this.parseCommand(command.command, command.args)

			const childProcess: ChildProcess = spawn(cmd, args, {
				cwd: workingDirectory,
				env: environment,
				stdio: ["ignore", "pipe", "pipe"],
				shell: true,
			})

			let stdout = ""
			let stderr = ""
			let isTimedOut = false

			// Set up timeout
			const timeoutHandle = setTimeout(() => {
				isTimedOut = true
				childProcess.kill("SIGTERM")

				// Force kill after additional delay
				setTimeout(() => {
					if (!childProcess.killed) {
						childProcess.kill("SIGKILL")
					}
				}, 5000)
			}, timeout)

			// Collect stdout
			if (childProcess.stdout) {
				childProcess.stdout.on("data", (data: Buffer) => {
					stdout += data.toString()
				})
			}

			// Collect stderr
			if (childProcess.stderr) {
				childProcess.stderr.on("data", (data: Buffer) => {
					stderr += data.toString()
				})
			}

			// Handle process exit
			childProcess.on("exit", (code: number | null, signal: string | null) => {
				clearTimeout(timeoutHandle)

				if (isTimedOut) {
					reject(new Error(`Command timed out after ${timeout}ms: ${command.command}`))
					return
				}

				if (signal) {
					reject(new Error(`Command was killed with signal ${signal}: ${command.command}`))
					return
				}

				const exitCode = code !== null ? code : ExitCode.GENERAL_ERROR
				resolve({
					exitCode,
					stdout: stdout.trim(),
					stderr: stderr.trim(),
				})
			})

			// Handle process error
			childProcess.on("error", (error: Error) => {
				clearTimeout(timeoutHandle)
				reject(new Error(`Failed to start command: ${error.message}`))
			})
		})
	}

	private parseCommand(command: string, args: string[] = []): string[] {
		// If args are provided separately, use them
		if (args.length > 0) {
			return [command, ...args]
		}

		// Otherwise, parse the command string
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
				if (current) {
					parts.push(current)
					current = ""
				}
			} else {
				current += char
			}
		}

		if (current) {
			parts.push(current)
		}

		return parts
	}

	private createDryRunResult(command: BatchCommand, startTime: Date): CommandResult {
		const endTime = new Date()
		return {
			id: command.id,
			command: command.command,
			success: true,
			exitCode: 0,
			stdout: `[DRY RUN] Would execute: ${command.command}`,
			duration: endTime.getTime() - startTime.getTime(),
			startTime,
			endTime,
		}
	}

	async executeWithRetry(command: BatchCommand): Promise<CommandResult> {
		const maxRetries = command.retries || this.context.retryCount
		let lastResult: CommandResult

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			lastResult = await this.execute(command)

			if (lastResult.success) {
				return lastResult
			}

			if (attempt < maxRetries) {
				// Wait before retry (exponential backoff)
				const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
				await new Promise((resolve) => setTimeout(resolve, delay))
			}
		}

		return lastResult!
	}
}
