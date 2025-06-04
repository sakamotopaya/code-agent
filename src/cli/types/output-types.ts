export enum OutputFormat {
	JSON = "json",
	PLAIN = "plain",
	YAML = "yaml",
	CSV = "csv",
	MARKDOWN = "markdown",
}

export interface OutputMetadata {
	timestamp: string
	version: string
	format: OutputFormat
	command: string
	duration: number
	exitCode: number
}

export interface ErrorInfo {
	code: string
	message: string
	details?: any
	stack?: string
}

export interface WarningInfo {
	code: string
	message: string
	details?: any
}

export interface FormattedOutput {
	metadata: OutputMetadata
	data: any
	errors?: ErrorInfo[]
	warnings?: WarningInfo[]
}

export interface ProgressData {
	current: number
	total: number
	message: string
	percentage: number
}

export interface TableData {
	headers: string[]
	rows: (string | number | boolean | null)[][]
}
