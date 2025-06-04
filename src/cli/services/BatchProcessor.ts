import { EventEmitter } from "events"
import {
	BatchConfig,
	BatchCommand,
	BatchResult,
	CommandResult,
	ExecutionSummary,
	ErrorHandlingStrategy,
	BatchSettings,
} from "../types/batch-types"
import { AutomationContext } from "../types/automation-types"
import { ExitCode } from "../types/exit-codes"
import { CommandExecutor } from "./CommandExecutor"

export class BatchProcessor extends EventEmitter {
	private context: AutomationContext
	private executor: CommandExecutor

	constructor(context: AutomationContext) {
		super()
		this.context = context
		this.executor = new CommandExecutor(context)
	}

	async executeBatch(config: BatchConfig): Promise<BatchResult> {
		const startTime = new Date()
		const results: CommandResult[] = []

		try {
			this.emit("batchStarted", config)

			if (config.settings.parallel) {
				const parallelResults = await this.executeParallel(config.commands, config.settings)
				results.push(...parallelResults)
			} else {
				const sequentialResults = await this.executeSequential(config.commands, config.settings)
				results.push(...sequentialResults)
			}

			const endTime = new Date()
			const duration = endTime.getTime() - startTime.getTime()

			const batchResult = this.generateBatchResult(results, config, startTime, endTime, duration)

			this.emit("batchCompleted", batchResult)
			return batchResult
		} catch (error) {
			this.emit("batchFailed", error)
			throw error
		}
	}

	private async executeSequential(commands: BatchCommand[], settings: BatchSettings): Promise<CommandResult[]> {
		const results: CommandResult[] = []

		for (const command of commands) {
			if (!this.shouldExecute(command, results)) {
				const skippedResult = this.createSkippedResult(command)
				results.push(skippedResult)
				this.emit("commandSkipped", command.id)
				continue
			}

			try {
				this.emit("commandStarted", command.id)
				const result = await this.executor.execute(command)
				results.push(result)
				this.emit("commandCompleted", result)

				// Update progress
				const progress = (results.length / commands.length) * 100
				this.emit("batchProgress", {
					completed: results.length,
					total: commands.length,
					progress: progress,
				})

				if (!result.success && !settings.continueOnError) {
					break
				}
			} catch (error) {
				const errorResult = this.createErrorResult(command, error as Error)
				results.push(errorResult)
				this.emit("commandFailed", command.id, error)

				if (!settings.continueOnError) {
					break
				}
			}
		}

		return results
	}

	private async executeParallel(commands: BatchCommand[], settings: BatchSettings): Promise<CommandResult[]> {
		const maxConcurrency = settings.maxConcurrency || 3
		const results: CommandResult[] = []
		let commandIndex = 0

		// Process commands in batches
		while (commandIndex < commands.length) {
			const currentBatch: Promise<CommandResult>[] = []

			// Start up to maxConcurrency commands
			while (currentBatch.length < maxConcurrency && commandIndex < commands.length) {
				const command = commands[commandIndex]

				if (!this.shouldExecute(command, results)) {
					const skippedResult = this.createSkippedResult(command)
					results.push(skippedResult)
					this.emit("commandSkipped", command.id)
					commandIndex++
					continue
				}

				this.emit("commandStarted", command.id)
				const promise = this.executor
					.execute(command)
					.then((result: CommandResult) => {
						this.emit("commandCompleted", result)
						return result
					})
					.catch((error: any) => {
						const errorResult = this.createErrorResult(command, error as Error)
						this.emit("commandFailed", command.id, error)
						return errorResult
					})

				currentBatch.push(promise)
				commandIndex++
			}

			// Wait for all commands in this batch to complete
			if (currentBatch.length > 0) {
				const batchResults = await Promise.allSettled(currentBatch)

				for (const settledResult of batchResults) {
					if (settledResult.status === "fulfilled") {
						const result = settledResult.value
						results.push(result)

						// Update progress
						const progress = (results.length / commands.length) * 100
						this.emit("batchProgress", {
							completed: results.length,
							total: commands.length,
							progress: progress,
						})

						// Check if we should stop on error
						if (!result.success && !settings.continueOnError) {
							return results
						}
					}
				}
			}
		}

		return results
	}

	private shouldExecute(command: BatchCommand, previousResults: CommandResult[]): boolean {
		// Check dependencies
		if (command.dependsOn && command.dependsOn.length > 0) {
			for (const dependencyId of command.dependsOn) {
				const dependencyResult = previousResults.find((r) => r.id === dependencyId)
				if (!dependencyResult || !dependencyResult.success) {
					return false
				}
			}
		}

		// Check conditions
		if (command.condition) {
			return this.evaluateCondition(command.condition, previousResults)
		}

		return true
	}

	private evaluateCondition(condition: any, previousResults: CommandResult[]): boolean {
		switch (condition.type) {
			case "always":
				return true
			case "never":
				return false
			case "file_exists":
				try {
					require("fs").accessSync(condition.value)
					return true
				} catch {
					return false
				}
			case "env_var":
				return !!process.env[condition.value]
			case "exit_code":
				if (condition.expectedExitCode !== undefined) {
					const lastResult = previousResults[previousResults.length - 1]
					return lastResult?.exitCode === condition.expectedExitCode
				}
				return false
			default:
				return true
		}
	}

	private createSkippedResult(command: BatchCommand): CommandResult {
		const now = new Date()
		return {
			id: command.id,
			command: command.command,
			success: true, // Skipped is considered successful
			exitCode: 0,
			duration: 0,
			startTime: now,
			endTime: now,
		}
	}

	private createErrorResult(command: BatchCommand, error: Error): CommandResult {
		const now = new Date()
		return {
			id: command.id,
			command: command.command,
			success: false,
			exitCode: 1,
			stderr: error.message,
			duration: 0,
			startTime: now,
			endTime: now,
			error: error,
		}
	}

	private generateBatchResult(
		results: CommandResult[],
		config: BatchConfig,
		startTime: Date,
		endTime: Date,
		duration: number,
	): BatchResult {
		const successfulCommands = results.filter((r) => r.success).length
		const failedCommands = results.filter((r) => !r.success).length
		const skippedCommands = config.commands.length - results.length

		const summary: ExecutionSummary = {
			totalTime: duration,
			averageCommandTime: results.length > 0 ? duration / results.length : 0,
			slowestCommand: results.reduce(
				(prev, current) => (prev.duration > current.duration ? prev : current),
				results[0],
			),
			fastestCommand: results.reduce(
				(prev, current) => (prev.duration < current.duration ? prev : current),
				results[0],
			),
			errors: results
				.filter((r) => !r.success)
				.map((r) => ({
					commandId: r.id,
					command: r.command,
					error: r.error?.message || r.stderr || "Unknown error",
					timestamp: r.endTime,
				})),
		}

		return {
			success: failedCommands === 0,
			totalCommands: config.commands.length,
			successfulCommands,
			failedCommands,
			skippedCommands,
			duration,
			startTime,
			endTime,
			results,
			summary,
		}
	}
}
