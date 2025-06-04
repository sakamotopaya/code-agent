import { IFormatter } from "../../types/formatter-types"
import { FormattedOutput, ProgressData, TableData } from "../../types/output-types"

export class MarkdownFormatter implements IFormatter {
	format(data: FormattedOutput): string {
		let output = ""

		// Add metadata header
		if (data.metadata) {
			output += this.formatMetadata(data.metadata)
			output += "\n\n"
		}

		// Format main data
		if (data.data) {
			output += "## Data\n\n"
			output += this.formatData(data.data)
			output += "\n\n"
		}

		// Format errors
		if (data.errors && data.errors.length > 0) {
			output += "## ❌ Errors\n\n"
			data.errors.forEach((error, index) => {
				output += `### Error ${index + 1}: ${error.code}\n\n`
				output += `**Message:** ${error.message}\n\n`
				if (error.details) {
					output += `**Details:**\n\n`
					output += "```json\n"
					output += JSON.stringify(error.details, null, 2)
					output += "\n```\n\n"
				}
				if (error.stack) {
					output += `<details>\n<summary>Stack Trace</summary>\n\n`
					output += "```\n"
					output += error.stack
					output += "\n```\n\n"
					output += "</details>\n\n"
				}
			})
		}

		// Format warnings
		if (data.warnings && data.warnings.length > 0) {
			output += "## ⚠️ Warnings\n\n"
			data.warnings.forEach((warning, index) => {
				output += `### Warning ${index + 1}: ${warning.code}\n\n`
				output += `**Message:** ${warning.message}\n\n`
				if (warning.details) {
					output += `**Details:**\n\n`
					output += "```json\n"
					output += JSON.stringify(warning.details, null, 2)
					output += "\n```\n\n"
				}
			})
		}

		return output.trim()
	}

	formatError(error: Error): string {
		let output = "# ❌ Error\n\n"
		output += `**Message:** ${error.message}\n\n`
		output += `**Type:** ${error.name}\n\n`

		if ((error as any).code) {
			output += `**Code:** ${(error as any).code}\n\n`
		}

		if (error.stack) {
			output += `<details>\n<summary>Stack Trace</summary>\n\n`
			output += "```\n"
			output += error.stack
			output += "\n```\n\n"
			output += "</details>\n\n"
		}

		output += `**Timestamp:** ${new Date().toISOString()}\n`

		return output
	}

	formatProgress(progress: ProgressData): string {
		let output = "# 📊 Progress\n\n"

		// Create a visual progress bar
		const progressBar = this.createMarkdownProgressBar(progress.percentage)
		output += `${progressBar} **${Math.round(progress.percentage)}%**\n\n`

		output += `**Current:** ${progress.current} / ${progress.total}\n\n`
		output += `**Message:** ${progress.message}\n\n`
		output += `**Timestamp:** ${new Date().toISOString()}\n`

		return output
	}

	formatTable(data: TableData): string {
		if (data.rows.length === 0) {
			return "# 📋 Table\n\n*No data to display*\n"
		}

		let output = "# 📋 Table\n\n"

		// Create markdown table
		output += "| " + data.headers.join(" | ") + " |\n"
		output += "| " + data.headers.map(() => "---").join(" | ") + " |\n"

		data.rows.forEach((row) => {
			const escapedRow = row.map((cell) => this.escapeMarkdown(String(cell ?? "")))
			output += "| " + escapedRow.join(" | ") + " |\n"
		})

		output += `\n**Summary:** ${data.rows.length} rows, ${data.headers.length} columns\n`

		return output
	}

	private formatMetadata(metadata: any): string {
		let output = "# 📋 Command Results\n\n"

		output += "| Property | Value |\n"
		output += "| --- | --- |\n"
		output += `| **Timestamp** | ${metadata.timestamp} |\n`
		output += `| **Version** | ${metadata.version} |\n`
		output += `| **Format** | ${metadata.format} |\n`
		output += `| **Command** | \`${metadata.command}\` |\n`
		output += `| **Duration** | ${metadata.duration}ms |\n`
		output += `| **Exit Code** | ${metadata.exitCode} |\n`

		return output
	}

	private formatData(data: any): string {
		if (data === null || data === undefined) {
			return "*No data available*"
		}

		if (typeof data === "string") {
			return data
		}

		if (typeof data === "number" || typeof data === "boolean") {
			return `\`${String(data)}\``
		}

		if (Array.isArray(data)) {
			if (data.length === 0) {
				return "*Empty array*"
			}

			let output = ""
			data.forEach((item, index) => {
				output += `${index + 1}. ${this.formatValue(item)}\n`
			})
			return output
		}

		if (typeof data === "object") {
			const entries = Object.entries(data)
			if (entries.length === 0) {
				return "*Empty object*"
			}

			// Check if this looks like tabular data
			if (this.isTabularData(data)) {
				return this.formatAsTable(data)
			}

			// Format as key-value pairs
			let output = ""
			entries.forEach(([key, value]) => {
				output += `**${key}:** ${this.formatValue(value)}\n\n`
			})
			return output.trim()
		}

		return `\`${String(data)}\``
	}

	private formatValue(value: any): string {
		if (value === null) return "*null*"
		if (value === undefined) return "*undefined*"
		if (typeof value === "string") return value
		if (typeof value === "number") return `\`${value}\``
		if (typeof value === "boolean") return `\`${value}\``
		if (Array.isArray(value)) return `*Array with ${value.length} items*`
		if (typeof value === "object") return `*Object with ${Object.keys(value).length} properties*`
		return `\`${String(value)}\``
	}

	private isTabularData(data: any): boolean {
		if (!Array.isArray(data)) return false
		if (data.length === 0) return false

		const firstItem = data[0]
		if (!firstItem || typeof firstItem !== "object") return false

		const keys = Object.keys(firstItem)
		return data.every(
			(item) =>
				item &&
				typeof item === "object" &&
				Object.keys(item).length === keys.length &&
				keys.every((key) => key in item),
		)
	}

	private formatAsTable(data: any[]): string {
		if (data.length === 0) return "*No data*"

		const headers = Object.keys(data[0])
		let output = "| " + headers.join(" | ") + " |\n"
		output += "| " + headers.map(() => "---").join(" | ") + " |\n"

		data.forEach((item) => {
			const row = headers.map((header) => this.escapeMarkdown(String(item[header] ?? "")))
			output += "| " + row.join(" | ") + " |\n"
		})

		return output
	}

	private createMarkdownProgressBar(percentage: number, width: number = 20): string {
		const filled = Math.round((percentage / 100) * width)
		const empty = width - filled
		return "`[" + "█".repeat(filled) + "░".repeat(empty) + "]`"
	}

	private escapeMarkdown(text: string): string {
		return text.replace(/\|/g, "\\|").replace(/\n/g, "<br>").replace(/\r/g, "")
	}
}
