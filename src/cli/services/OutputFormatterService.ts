import { IOutputFormatterService, IFormatter } from "../types/formatter-types"
import { OutputFormat, FormattedOutput, ProgressData, TableData, OutputMetadata } from "../types/output-types"
import { JSONFormatter } from "./formatters/JSONFormatter"
import { PlainTextFormatter } from "./formatters/PlainTextFormatter"
import { YAMLFormatter } from "./formatters/YAMLFormatter"
import { CSVFormatter } from "./formatters/CSVFormatter"
import { MarkdownFormatter } from "./formatters/MarkdownFormatter"
import { detectFormatFromFilename, getSuggestedFormat } from "../utils/format-detection"

export class OutputFormatterService implements IOutputFormatterService {
	private formatters: Map<OutputFormat, IFormatter>
	private defaultFormat: OutputFormat = OutputFormat.PLAIN
	private packageVersion: string

	constructor(packageVersion: string = "1.0.0", useColors: boolean = true) {
		this.packageVersion = packageVersion
		this.formatters = new Map<OutputFormat, IFormatter>([
			[OutputFormat.JSON, new JSONFormatter()],
			[OutputFormat.PLAIN, new PlainTextFormatter(useColors)],
			[OutputFormat.YAML, new YAMLFormatter()],
			[OutputFormat.CSV, new CSVFormatter()],
			[OutputFormat.MARKDOWN, new MarkdownFormatter()],
		])

		// Use centralized format detection logic
		this.defaultFormat = getSuggestedFormat()
	}

	format(data: any, format: OutputFormat = this.defaultFormat): string {
		const formatter = this.formatters.get(format)
		if (!formatter) {
			throw new Error(`Unsupported output format: ${format}`)
		}

		// If data is already a FormattedOutput, use it directly
		if (this.isFormattedOutput(data)) {
			return formatter.format(data)
		}

		// Otherwise, wrap it in FormattedOutput structure
		const formattedOutput: FormattedOutput = {
			metadata: this.createMetadata(format),
			data,
		}

		return formatter.format(formattedOutput)
	}

	setDefaultFormat(format: OutputFormat): void {
		if (!this.validateFormat(format)) {
			throw new Error(`Invalid format: ${format}`)
		}
		this.defaultFormat = format
	}

	getDefaultFormat(): OutputFormat {
		return this.defaultFormat
	}

	getAvailableFormats(): OutputFormat[] {
		return Array.from(this.formatters.keys())
	}

	validateFormat(format: string): boolean {
		return Object.values(OutputFormat).includes(format as OutputFormat)
	}

	formatError(error: Error, format: OutputFormat = this.defaultFormat): string {
		const formatter = this.formatters.get(format)
		if (!formatter) {
			throw new Error(`Unsupported output format: ${format}`)
		}

		return formatter.formatError(error)
	}

	formatProgress(progress: ProgressData, format: OutputFormat = this.defaultFormat): string {
		const formatter = this.formatters.get(format)
		if (!formatter) {
			throw new Error(`Unsupported output format: ${format}`)
		}

		return formatter.formatProgress(progress)
	}

	formatTable(data: TableData, format: OutputFormat = this.defaultFormat): string {
		const formatter = this.formatters.get(format)
		if (!formatter) {
			throw new Error(`Unsupported output format: ${format}`)
		}

		return formatter.formatTable(data)
	}

	/**
	 * Format data with complete metadata and error/warning information
	 */
	formatComplete(
		data: any,
		command: string,
		duration: number,
		exitCode: number = 0,
		errors?: any[],
		warnings?: any[],
		format: OutputFormat = this.defaultFormat,
	): string {
		const formattedOutput: FormattedOutput = {
			metadata: {
				timestamp: new Date().toISOString(),
				version: this.packageVersion,
				format,
				command,
				duration,
				exitCode,
			},
			data,
			errors: errors?.map((err) => this.normalizeError(err)),
			warnings: warnings?.map((warn) => this.normalizeWarning(warn)),
		}

		const formatter = this.formatters.get(format)
		if (!formatter) {
			throw new Error(`Unsupported output format: ${format}`)
		}

		return formatter.format(formattedOutput)
	}

	/**
	 * Get format from various sources with priority:
	 * 1. Explicit format parameter
	 * 2. Environment variable
	 * 3. Auto-detection
	 * 4. Default format
	 */
	resolveFormat(explicitFormat?: string): OutputFormat {
		// 1. Explicit format parameter
		if (explicitFormat) {
			const normalizedFormat = explicitFormat.toLowerCase()
			if (this.validateFormat(normalizedFormat)) {
				return normalizedFormat as OutputFormat
			}
		}

		// 2. Use centralized format detection for environment variable and auto-detection
		return getSuggestedFormat()
	}

	private createMetadata(format: OutputFormat): OutputMetadata {
		return {
			timestamp: new Date().toISOString(),
			version: this.packageVersion,
			format,
			command: process.argv.slice(2).join(" ") || "unknown",
			duration: 0, // Will be updated by caller
			exitCode: 0,
		}
	}

	private isFormattedOutput(data: any): data is FormattedOutput {
		return data && typeof data === "object" && "metadata" in data && "data" in data
	}

	private normalizeError(error: any): any {
		if (error instanceof Error) {
			return {
				code: (error as any).code || "UNKNOWN_ERROR",
				message: error.message,
				details: (error as any).details,
				stack: error.stack,
			}
		}

		if (typeof error === "string") {
			return {
				code: "STRING_ERROR",
				message: error,
			}
		}

		if (error && typeof error === "object") {
			return {
				code: error.code || "OBJECT_ERROR",
				message: error.message || String(error),
				details: error.details,
				stack: error.stack,
			}
		}

		return {
			code: "UNKNOWN_ERROR",
			message: String(error),
		}
	}

	private normalizeWarning(warning: any): any {
		if (typeof warning === "string") {
			return {
				code: "STRING_WARNING",
				message: warning,
			}
		}

		if (warning && typeof warning === "object") {
			return {
				code: warning.code || "OBJECT_WARNING",
				message: warning.message || String(warning),
				details: warning.details,
			}
		}

		return {
			code: "UNKNOWN_WARNING",
			message: String(warning),
		}
	}
}
