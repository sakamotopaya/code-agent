/**
 * Batch processing types for non-interactive mode
 */

export interface BatchConfig {
	commands: BatchCommand[]
	settings: BatchSettings
	defaults: NonInteractiveDefaults
	errorHandling: ErrorHandlingStrategy
}

export interface BatchCommand {
	id: string
	command: string
	args: string[]
	environment?: Record<string, string>
	workingDirectory?: string
	timeout?: number
	retries?: number
	dependsOn?: string[]
	condition?: CommandCondition
}

export interface BatchSettings {
	parallel: boolean
	maxConcurrency: number
	continueOnError: boolean
	verbose: boolean
	dryRun: boolean
	outputFormat: OutputFormat
}

export interface NonInteractiveDefaults {
	confirmations: boolean // default response to Y/N prompts
	fileOverwrite: boolean
	createDirectories: boolean
	timeout: number
	retryCount: number
}

export interface CommandCondition {
	type: "file_exists" | "env_var" | "exit_code" | "always" | "never"
	value?: string
	expectedExitCode?: number
}

export interface CommandResult {
	id: string
	command: string
	success: boolean
	exitCode: number
	stdout?: string
	stderr?: string
	duration: number
	startTime: Date
	endTime: Date
	error?: Error
}

export interface BatchResult {
	success: boolean
	totalCommands: number
	successfulCommands: number
	failedCommands: number
	skippedCommands: number
	duration: number
	startTime: Date
	endTime: Date
	results: CommandResult[]
	summary: ExecutionSummary
}

export interface ExecutionSummary {
	totalTime: number
	averageCommandTime: number
	slowestCommand?: CommandResult
	fastestCommand?: CommandResult
	errors: ExecutionError[]
}

export interface ExecutionError {
	commandId: string
	command: string
	error: string
	timestamp: Date
}

export enum ErrorHandlingStrategy {
	FAIL_FAST = "fail_fast",
	CONTINUE_ON_ERROR = "continue_on_error",
	COLLECT_ERRORS = "collect_errors",
	RETRY_FAILURES = "retry_failures",
}

export enum OutputFormat {
	JSON = "json",
	YAML = "yaml",
	TEXT = "text",
	CSV = "csv",
	MARKDOWN = "markdown",
}

export interface ExecutionStatus {
	isRunning: boolean
	currentCommand?: string
	completedCommands: number
	totalCommands: number
	progress: number
	estimatedTimeRemaining?: number
}

export interface ExecutionMetrics {
	totalExecutionTime: number
	averageCommandTime: number
	successRate: number
	failureRate: number
	concurrencyLevel: number
	memoryUsage?: number
	cpuUsage?: number
}

/**
 * File format interfaces for batch input
 */
export interface JSONBatchFile {
	version: string
	settings: BatchSettings
	defaults: NonInteractiveDefaults
	commands: BatchCommand[]
}

export interface YAMLBatchFile {
	version: string
	settings: BatchSettings
	defaults: NonInteractiveDefaults
	commands: BatchCommand[]
}

export interface TextBatchFile {
	lines: string[]
}
