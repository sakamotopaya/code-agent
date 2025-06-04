import { IFormatter } from "../../types/formatter-types"
import { FormattedOutput, ProgressData, TableData } from "../../types/output-types"
import chalk from "chalk"

export class PlainTextFormatter implements IFormatter {
	private useColors: boolean

	constructor(useColors: boolean = true) {
		this.useColors = useColors
	}

	format(data: FormattedOutput): string {
		let output = ""

		// Format main data
		if (data.data) {
			output += this.formatData(data.data)
		}

		// Format errors
		if (data.errors && data.errors.length > 0) {
			output += "\n"
			output += this.colorize("Errors:", "red", true) + "\n"
			data.errors.forEach((err) => {
				output += `  ${this.colorize("❌", "red")} ${err.message}\n`
				if (err.details) {
					output += `     ${this.colorize("Details:", "gray")} ${this.formatValue(err.details)}\n`
				}
			})
		}

		// Format warnings
		if (data.warnings && data.warnings.length > 0) {
			output += "\n"
			output += this.colorize("Warnings:", "yellow", true) + "\n"
			data.warnings.forEach((warn) => {
				output += `  ${this.colorize("⚠️", "yellow")} ${warn.message}\n`
				if (warn.details) {
					output += `     ${this.colorize("Details:", "gray")} ${this.formatValue(warn.details)}\n`
				}
			})
		}

		// Add metadata footer
		if (data.metadata) {
			output += "\n"
			output += this.colorize("─".repeat(50), "gray") + "\n"
			output += this.colorize(`✅ Command completed in ${data.metadata.duration}ms`, "green") + "\n"
		}

		return output.trim()
	}

	formatError(error: Error): string {
		let output = this.colorize("❌ Error:", "red", true) + "\n"
		output += `${error.message}\n`

		if (error.stack && process.env.NODE_ENV === "development") {
			output += "\n"
			output += this.colorize("Stack trace:", "gray", true) + "\n"
			output += this.colorize(error.stack, "gray") + "\n"
		}

		return output
	}

	formatProgress(progress: ProgressData): string {
		const progressBar = this.createProgressBar(progress.percentage)
		const percentage = `${Math.round(progress.percentage)}%`

		return `${this.colorize("Progress:", "cyan")} ${progressBar} ${this.colorize(percentage, "cyan")} - ${progress.message}`
	}

	formatTable(data: TableData): string {
		if (data.rows.length === 0) {
			return this.colorize("No data to display", "gray")
		}

		const columnWidths = this.calculateColumnWidths(data)
		let output = ""

		// Header
		output += this.formatTableRow(data.headers, columnWidths, true) + "\n"
		output += this.colorize("─".repeat(columnWidths.reduce((sum, width) => sum + width + 3, -1)), "gray") + "\n"

		// Rows
		data.rows.forEach((row) => {
			output +=
				this.formatTableRow(
					row.map((cell) => String(cell ?? "")),
					columnWidths,
					false,
				) + "\n"
		})

		return output.trim()
	}

	private formatData(data: any): string {
		if (data === null || data === undefined) {
			return this.colorize("No data", "gray")
		}

		if (typeof data === "string") {
			return data
		}

		if (typeof data === "number" || typeof data === "boolean") {
			return String(data)
		}

		if (Array.isArray(data)) {
			return data.map((item, index) => `${index + 1}. ${this.formatValue(item)}`).join("\n")
		}

		if (typeof data === "object") {
			return Object.entries(data)
				.map(([key, value]) => `${this.colorize(key + ":", "cyan")} ${this.formatValue(value)}`)
				.join("\n")
		}

		return String(data)
	}

	private formatValue(value: any): string {
		if (value === null) return this.colorize("null", "gray")
		if (value === undefined) return this.colorize("undefined", "gray")
		if (typeof value === "string") return value
		if (typeof value === "number") return this.colorize(String(value), "yellow")
		if (typeof value === "boolean") return this.colorize(String(value), value ? "green" : "red")
		if (Array.isArray(value)) return `[${value.length} items]`
		if (typeof value === "object") return `{${Object.keys(value).length} properties}`
		return String(value)
	}

	private createProgressBar(percentage: number, width: number = 20): string {
		const filled = Math.round((percentage / 100) * width)
		const empty = width - filled
		const bar = "█".repeat(filled) + "░".repeat(empty)
		return this.colorize(`[${bar}]`, "cyan")
	}

	private calculateColumnWidths(data: TableData): number[] {
		const widths = data.headers.map((header) => header.length)

		data.rows.forEach((row) => {
			row.forEach((cell, index) => {
				const cellLength = String(cell ?? "").length
				if (cellLength > widths[index]) {
					widths[index] = cellLength
				}
			})
		})

		return widths
	}

	private formatTableRow(cells: string[], widths: number[], isHeader: boolean): string {
		const formattedCells = cells.map((cell, index) => {
			const paddedCell = cell.padEnd(widths[index])
			return isHeader ? this.colorize(paddedCell, "cyan", true) : paddedCell
		})

		return formattedCells.join(" │ ")
	}

	private colorize(text: string, color: string, bold: boolean = false): string {
		if (!this.useColors) {
			return text
		}

		let colorFunc = chalk[color as keyof typeof chalk] as any
		if (typeof colorFunc !== "function") {
			colorFunc = chalk.white
		}

		return bold ? colorFunc.bold(text) : colorFunc(text)
	}
}
