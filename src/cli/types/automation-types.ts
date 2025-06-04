/**
 * Automation types for non-interactive mode
 */

export interface NonInteractiveOptions {
	batch?: string // batch file path
	stdin?: boolean // read from stdin
	yes?: boolean // assume yes for all prompts
	no?: boolean // assume no for all prompts
	timeout?: number // global timeout
	parallel?: boolean // parallel execution
	continueOnError?: boolean
	dryRun?: boolean
	quiet?: boolean
	verbose?: boolean
}

export interface NonInteractiveLogging {
	level: LogLevel
	format: LogFormat
	destination: LogDestination
	includeTimestamps: boolean
	includeMetrics: boolean
	structuredOutput: boolean
}

export enum LogLevel {
	ERROR = "error",
	WARN = "warn",
	INFO = "info",
	DEBUG = "debug",
	TRACE = "trace",
}

export enum LogFormat {
	JSON = "json",
	TEXT = "text",
	CSV = "csv",
}

export enum LogDestination {
	CONSOLE = "console",
	FILE = "file",
	BOTH = "both",
}

export interface AutomationContext {
	isInteractive: boolean
	defaults: NonInteractiveDefaults
	timeout: number
	retryCount: number
	continueOnError: boolean
	dryRun: boolean
}

export interface NonInteractiveDefaults {
	confirmations: boolean
	fileOverwrite: boolean
	createDirectories: boolean
	timeout: number
	retryCount: number
}

export interface PromptResponse {
	type: "confirmation" | "input" | "selection"
	question: string
	defaultValue?: string | boolean
	response: string | boolean
	timestamp: Date
}

export interface AutomationSession {
	id: string
	startTime: Date
	endTime?: Date
	batchFile?: string
	stdinInput?: string
	responses: PromptResponse[]
	results: any[]
	status: "running" | "completed" | "failed" | "aborted"
}

export interface InputSource {
	type: "file" | "stdin" | "direct"
	path?: string
	content?: string
	format?: "json" | "yaml" | "text"
}

export interface TemplateVariable {
	name: string
	value: string
	source: "environment" | "config" | "runtime"
}

export interface TemplateContext {
	variables: Record<string, string>
	functions: Record<string, (...args: any[]) => any>
	environment: Record<string, string>
}
