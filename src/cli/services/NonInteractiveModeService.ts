import {
	BatchConfig,
	BatchResult,
	NonInteractiveDefaults,
	ErrorHandlingStrategy,
	ExecutionStatus,
	ExecutionMetrics,
} from "../types/batch-types"
import {
	NonInteractiveOptions,
	AutomationContext,
	LogLevel,
	LogFormat,
	LogDestination,
} from "../types/automation-types"
import { ExitCode } from "../types/exit-codes"
import { BatchProcessor } from "./BatchProcessor"
import { AutomationLogger } from "./AutomationLogger"
import { BatchFileParser } from "../parsers/BatchFileParser"
import { EventEmitter } from "events"
import * as fs from "fs/promises"
import * as path from "path"

export interface INonInteractiveModeService {
	// Batch execution
	executeBatch(batchConfig: BatchConfig): Promise<BatchResult>
	executeFromFile(filePath: string): Promise<BatchResult>
	executeFromStdin(): Promise<BatchResult>

	// Configuration
	setNonInteractiveMode(enabled: boolean): void
	configureDefaults(defaults: NonInteractiveDefaults): void
	setErrorHandling(strategy: ErrorHandlingStrategy): void

	// Monitoring
	getExecutionStatus(): ExecutionStatus
	getMetrics(): ExecutionMetrics
}

export class NonInteractiveModeService extends EventEmitter implements INonInteractiveModeService {
	private isNonInteractive: boolean = false
	private defaults: NonInteractiveDefaults
	private errorHandling: ErrorHandlingStrategy = ErrorHandlingStrategy.FAIL_FAST
	private batchProcessor: BatchProcessor
	private logger: AutomationLogger
	private fileParser: BatchFileParser
	private currentExecution?: {
		status: ExecutionStatus
		metrics: ExecutionMetrics
		startTime: Date
	}

	constructor(options: NonInteractiveOptions = {}) {
		super()

		this.defaults = {
			confirmations: options.yes || false,
			fileOverwrite: !options.no,
			createDirectories: true,
			timeout: options.timeout || 300000, // 5 minutes default
			retryCount: 3,
		}

		this.logger = new AutomationLogger({
			level: options.verbose ? LogLevel.DEBUG : options.quiet ? LogLevel.ERROR : LogLevel.INFO,
			format: LogFormat.TEXT,
			destination: LogDestination.CONSOLE,
			includeTimestamps: true,
			includeMetrics: false,
			structuredOutput: false,
		})

		this.batchProcessor = new BatchProcessor(this.createAutomationContext(options))
		this.fileParser = new BatchFileParser()

		// Set up event forwarding
		this.batchProcessor.on("commandStarted", (commandId: string) => {
			this.emit("commandStarted", commandId)
		})

		this.batchProcessor.on("commandCompleted", (result: any) => {
			this.emit("commandCompleted", result)
		})

		this.batchProcessor.on("batchProgress", (progress: any) => {
			this.emit("batchProgress", progress)
		})
	}

	private createAutomationContext(options: NonInteractiveOptions): AutomationContext {
		return {
			isInteractive: false,
			defaults: this.defaults,
			timeout: this.defaults.timeout,
			retryCount: this.defaults.retryCount,
			continueOnError: options.continueOnError || false,
			dryRun: options.dryRun || false,
		}
	}

	setNonInteractiveMode(enabled: boolean): void {
		this.isNonInteractive = enabled
		this.logger.info(`Non-interactive mode ${enabled ? "enabled" : "disabled"}`)
	}

	configureDefaults(defaults: NonInteractiveDefaults): void {
		this.defaults = { ...this.defaults, ...defaults }
		this.logger.debug("Updated non-interactive defaults", defaults)
	}

	setErrorHandling(strategy: ErrorHandlingStrategy): void {
		this.errorHandling = strategy
		this.logger.debug(`Error handling strategy set to: ${strategy}`)
	}

	async executeBatch(batchConfig: BatchConfig): Promise<BatchResult> {
		try {
			this.logger.info(`Starting batch execution with ${batchConfig.commands.length} commands`)

			this.currentExecution = {
				status: {
					isRunning: true,
					currentCommand: undefined,
					completedCommands: 0,
					totalCommands: batchConfig.commands.length,
					progress: 0,
				},
				metrics: {
					totalExecutionTime: 0,
					averageCommandTime: 0,
					successRate: 0,
					failureRate: 0,
					concurrencyLevel: batchConfig.settings.maxConcurrency || 1,
				},
				startTime: new Date(),
			}

			const result = await this.batchProcessor.executeBatch(batchConfig)

			this.currentExecution.status.isRunning = false
			this.currentExecution.status.progress = 100
			this.updateMetrics(result)

			this.logger.info(
				`Batch execution completed: ${result.successfulCommands}/${result.totalCommands} successful`,
			)

			return result
		} catch (error) {
			this.logger.error("Batch execution failed", error)
			if (this.currentExecution) {
				this.currentExecution.status.isRunning = false
			}
			throw error
		}
	}

	async executeFromFile(filePath: string): Promise<BatchResult> {
		try {
			this.logger.info(`Loading batch file: ${filePath}`)

			// Check if file exists
			try {
				await fs.access(filePath)
			} catch {
				throw new Error(`Batch file not found: ${filePath}`)
			}

			// Parse the batch file
			const batchConfig = await this.fileParser.parseFile(filePath)

			// Resolve relative paths in commands relative to batch file directory
			const batchDir = path.dirname(path.resolve(filePath))
			batchConfig.commands = batchConfig.commands.map((cmd: any) => ({
				...cmd,
				workingDirectory: cmd.workingDirectory ? path.resolve(batchDir, cmd.workingDirectory) : batchDir,
			}))

			this.logger.debug(`Parsed batch file with ${batchConfig.commands.length} commands`)

			return await this.executeBatch(batchConfig)
		} catch (error) {
			this.logger.error(`Failed to execute batch file: ${filePath}`, error)
			throw error
		}
	}

	async executeFromStdin(): Promise<BatchResult> {
		try {
			this.logger.info("Reading batch commands from stdin")

			const stdinData = await this.readStdin()
			if (!stdinData.trim()) {
				throw new Error("No input received from stdin")
			}

			// Try to parse as JSON first, then fall back to text format
			let batchConfig: BatchConfig
			try {
				const jsonData = JSON.parse(stdinData)
				batchConfig = this.fileParser.parseJSON(jsonData)
			} catch {
				// Fall back to text format (one command per line)
				batchConfig = this.fileParser.parseText(stdinData)
			}

			this.logger.debug(`Parsed stdin input with ${batchConfig.commands.length} commands`)

			return await this.executeBatch(batchConfig)
		} catch (error) {
			this.logger.error("Failed to execute commands from stdin", error)
			throw error
		}
	}

	private async readStdin(): Promise<string> {
		return new Promise((resolve, reject) => {
			let data = ""

			process.stdin.setEncoding("utf8")

			process.stdin.on("data", (chunk) => {
				data += chunk
			})

			process.stdin.on("end", () => {
				resolve(data)
			})

			process.stdin.on("error", (error) => {
				reject(error)
			})

			// Set a timeout for stdin reading
			const timeout = setTimeout(() => {
				reject(new Error("Timeout waiting for stdin input"))
			}, this.defaults.timeout)

			process.stdin.on("end", () => {
				clearTimeout(timeout)
			})
		})
	}

	getExecutionStatus(): ExecutionStatus {
		if (!this.currentExecution) {
			return {
				isRunning: false,
				completedCommands: 0,
				totalCommands: 0,
				progress: 0,
			}
		}

		return this.currentExecution.status
	}

	getMetrics(): ExecutionMetrics {
		if (!this.currentExecution) {
			return {
				totalExecutionTime: 0,
				averageCommandTime: 0,
				successRate: 0,
				failureRate: 0,
				concurrencyLevel: 1,
			}
		}

		return this.currentExecution.metrics
	}

	private updateMetrics(result: BatchResult): void {
		if (!this.currentExecution) return

		const metrics = this.currentExecution.metrics
		metrics.totalExecutionTime = result.duration
		metrics.averageCommandTime = result.results.length > 0 ? result.duration / result.results.length : 0
		metrics.successRate = result.totalCommands > 0 ? (result.successfulCommands / result.totalCommands) * 100 : 0
		metrics.failureRate = result.totalCommands > 0 ? (result.failedCommands / result.totalCommands) * 100 : 0
	}
}
