import { OutputFormat, FormattedOutput, ErrorInfo, ProgressData, TableData } from "./output-types"

export interface IFormatter {
	format(data: FormattedOutput): string
	formatError(error: Error): string
	formatProgress(progress: ProgressData): string
	formatTable(data: TableData): string
}

export interface IOutputFormatterService {
	format(data: any, format: OutputFormat): string
	setDefaultFormat(format: OutputFormat): void
	getDefaultFormat(): OutputFormat
	getAvailableFormats(): OutputFormat[]
	validateFormat(format: string): boolean

	// Specialized formatters
	formatError(error: Error, format: OutputFormat): string
	formatProgress(progress: ProgressData, format: OutputFormat): string
	formatTable(data: TableData, format: OutputFormat): string
}
