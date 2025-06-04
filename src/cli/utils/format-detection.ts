import { OutputFormat } from "../types/output-types"

/**
 * Detect output format from file extension
 */
export function detectFormatFromFilename(filename: string): OutputFormat | null {
	const extension = filename.split(".").pop()?.toLowerCase()

	switch (extension) {
		case "json":
			return OutputFormat.JSON
		case "yaml":
		case "yml":
			return OutputFormat.YAML
		case "csv":
			return OutputFormat.CSV
		case "md":
		case "markdown":
			return OutputFormat.MARKDOWN
		case "txt":
		case "text":
			return OutputFormat.PLAIN
		default:
			return null
	}
}

/**
 * Detect if output is being redirected (not a TTY)
 */
export function isOutputRedirected(): boolean {
	return !process.stdout.isTTY
}

/**
 * Get suggested format based on environment and output context
 */
export function getSuggestedFormat(): OutputFormat {
	// Check environment variable first
	const envFormat = process.env.ROO_OUTPUT_FORMAT?.toLowerCase()
	if (envFormat && isValidFormat(envFormat)) {
		return envFormat as OutputFormat
	}

	// Check if output is redirected
	if (isOutputRedirected()) {
		// Check for output file hint
		const outputFile = process.env.ROO_OUTPUT_FILE
		if (outputFile) {
			const detectedFormat = detectFormatFromFilename(outputFile)
			if (detectedFormat) {
				return detectedFormat
			}
		}
		// Default to JSON for redirected output
		return OutputFormat.JSON
	}

	// Default to plain text for interactive use
	return OutputFormat.PLAIN
}

/**
 * Validate if a string is a valid output format
 */
export function isValidFormat(format: string): boolean {
	return Object.values(OutputFormat).includes(format as OutputFormat)
}

/**
 * Get format display name for help text
 */
export function getFormatDisplayName(format: OutputFormat): string {
	switch (format) {
		case OutputFormat.JSON:
			return "JSON (JavaScript Object Notation)"
		case OutputFormat.PLAIN:
			return "Plain Text (Human readable)"
		case OutputFormat.YAML:
			return "YAML (YAML Ain't Markup Language)"
		case OutputFormat.CSV:
			return "CSV (Comma Separated Values)"
		case OutputFormat.MARKDOWN:
			return "Markdown (Documentation format)"
		default:
			return format
	}
}

/**
 * Get all available formats with descriptions
 */
export function getAvailableFormatsWithDescriptions(): Array<{ format: OutputFormat; description: string }> {
	return Object.values(OutputFormat).map((format) => ({
		format,
		description: getFormatDisplayName(format),
	}))
}

/**
 * Check if format is suitable for machine processing
 */
export function isMachineReadableFormat(format: OutputFormat): boolean {
	return [OutputFormat.JSON, OutputFormat.YAML, OutputFormat.CSV].includes(format)
}

/**
 * Check if format supports streaming output
 */
export function supportsStreamingOutput(format: OutputFormat): boolean {
	return [OutputFormat.JSON, OutputFormat.CSV].includes(format)
}
