import Table from "cli-table3"
import { TableData, TableOptions, TableColumn, ChalkColor } from "../types/ui-types"
import { ColorManager } from "./ColorManager"

type CliTable3 = InstanceType<typeof Table>

export class TableFormatter {
	private colorManager: ColorManager

	constructor(colorManager: ColorManager) {
		this.colorManager = colorManager
	}

	/**
	 * Create a formatted table from data
	 */
	formatTable(data: TableData, options: TableOptions = {}): string {
		if (!data || data.length === 0) {
			return this.colorManager.muted("No data to display")
		}

		const table = new Table(this.prepareTableOptions(options))

		// Handle array of objects
		if (this.isObjectArray(data)) {
			this.addObjectRows(table, data as Array<Record<string, any>>, options)
		} else {
			// Handle array of arrays
			this.addArrayRows(table, data as Array<Array<string | number>>)
		}

		return table.toString()
	}

	/**
	 * Create a simple two-column table (key-value pairs)
	 */
	formatKeyValueTable(data: Record<string, any>, options: Partial<TableOptions> = {}): string {
		const tableData = Object.entries(data).map(([key, value]) => [
			this.colorManager.highlight(key),
			this.formatValue(value),
		])

		const tableOptions: TableOptions = {
			head: ["Property", "Value"],
			...options,
		}

		return this.formatTable(tableData, tableOptions)
	}

	/**
	 * Create a table with custom columns
	 */
	formatColumnarTable(
		data: Array<Record<string, any>>,
		columns: TableColumn[],
		options: Partial<TableOptions> = {},
	): string {
		if (!data || data.length === 0) {
			return this.colorManager.muted("No data to display")
		}

		const tableOptions: TableOptions = {
			head: columns.map((col) => this.colorManager.bold(col.header)),
			colWidths: columns.map((col) => col.width).filter(Boolean) as number[],
			...options,
		}

		const tableData = data.map((row) =>
			columns.map((col) => {
				const value = row[col.key]
				const formatted = this.formatValue(value)

				// Apply alignment if specified
				if (col.alignment) {
					return this.applyAlignment(formatted, col.width || 0, col.alignment)
				}

				return formatted
			}),
		)

		return this.formatTable(tableData, tableOptions)
	}

	/**
	 * Create a summary table with totals
	 */
	formatSummaryTable(
		data: Array<Record<string, any>>,
		summaryColumns: string[],
		options: Partial<TableOptions> = {},
	): string {
		if (!data || data.length === 0) {
			return this.colorManager.muted("No data to display")
		}

		// Get all unique keys from the data
		const allKeys = Array.from(new Set(data.flatMap(Object.keys)))
		const table = new Table(this.prepareTableOptions(options))

		// Add data rows
		data.forEach((row) => {
			table.push(allKeys.map((key) => this.formatValue(row[key])))
		})

		// Add summary row if summaryColumns specified
		if (summaryColumns.length > 0) {
			const summaryRow = allKeys.map((key) => {
				if (summaryColumns.includes(key)) {
					const values = data.map((row) => row[key]).filter((val) => typeof val === "number")
					const sum = values.reduce((acc, val) => acc + val, 0)
					return this.colorManager.bold(this.formatValue(sum))
				}
				return key === allKeys[0] ? this.colorManager.bold("Total:") : ""
			})

			table.push(summaryRow)
		}

		return table.toString()
	}

	/**
	 * Create a comparison table
	 */
	formatComparisonTable(
		before: Record<string, any>,
		after: Record<string, any>,
		options: Partial<TableOptions> = {},
	): string {
		const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))

		const tableData = allKeys.map((key) => [
			this.colorManager.highlight(key),
			this.formatValue(before[key]),
			this.formatValue(after[key]),
			this.getChangeIndicator(before[key], after[key]),
		])

		const tableOptions: TableOptions = {
			head: ["Property", "Before", "After", "Change"],
			...options,
		}

		return this.formatTable(tableData, tableOptions)
	}

	/**
	 * Prepare table options with defaults and color support
	 */
	private prepareTableOptions(options: TableOptions): any {
		const defaultOptions = {
			style: {
				"padding-left": 1,
				"padding-right": 1,
				head: this.colorManager.isColorsEnabled() ? ["cyan"] : [],
				border: this.colorManager.isColorsEnabled() ? ["gray"] : [],
				compact: false,
			},
			chars: {
				top: "─",
				"top-mid": "┬",
				"top-left": "┌",
				"top-right": "┐",
				bottom: "─",
				"bottom-mid": "┴",
				"bottom-left": "└",
				"bottom-right": "┘",
				left: "│",
				"left-mid": "├",
				mid: "─",
				"mid-mid": "┼",
				right: "│",
				"right-mid": "┤",
				middle: "│",
			},
		}

		return {
			...defaultOptions,
			...options,
			style: {
				...defaultOptions.style,
				...(options.style || {}),
			},
		}
	}

	/**
	 * Check if data is an array of objects
	 */
	private isObjectArray(data: TableData): boolean {
		return data.length > 0 && typeof data[0] === "object" && !Array.isArray(data[0])
	}

	/**
	 * Add rows from object array
	 */
	private addObjectRows(table: CliTable3, data: Array<Record<string, any>>, options: TableOptions): void {
		if (!options.head && data.length > 0) {
			// Auto-generate headers from first object
			const headers = Object.keys(data[0])
			const tableWithOptions = table as any
			tableWithOptions.options = tableWithOptions.options || {}
			tableWithOptions.options.head = headers.map((h) => this.colorManager.bold(h))
		}

		data.forEach((row) => {
			const values = options.head
				? (options.head as string[]).map((header) => {
						// Remove ANSI escape codes from header
						// eslint-disable-next-line no-control-regex
						const cleanHeader = header.replace(/\u001B\[[0-9;]*m/g, "")
						return this.formatValue(row[cleanHeader])
					})
				: Object.values(row).map((val) => this.formatValue(val))
			table.push(values)
		})
	}

	/**
	 * Add rows from array of arrays
	 */
	private addArrayRows(table: CliTable3, data: Array<Array<string | number>>): void {
		data.forEach((row) => {
			table.push(row.map((val) => this.formatValue(val)))
		})
	}

	/**
	 * Format a value for display
	 */
	private formatValue(value: any): string {
		if (value === null || value === undefined) {
			return this.colorManager.muted("—")
		}

		if (typeof value === "boolean") {
			return value ? this.colorManager.success("✓") : this.colorManager.error("✗")
		}

		if (typeof value === "number") {
			return this.colorManager.primary(value.toLocaleString())
		}

		if (typeof value === "string") {
			// Truncate very long strings
			if (value.length > 50) {
				return this.colorManager.primary(value.substring(0, 47) + "...")
			}
			return this.colorManager.primary(value)
		}

		if (typeof value === "object") {
			return this.colorManager.muted("[Object]")
		}

		return String(value)
	}

	/**
	 * Apply text alignment
	 */
	private applyAlignment(text: string, width: number, alignment: "left" | "center" | "right"): string {
		if (!width || width <= text.length) {
			return text
		}

		const padding = width - text.length

		switch (alignment) {
			case "center": {
				const leftPad = Math.floor(padding / 2)
				const rightPad = padding - leftPad
				return " ".repeat(leftPad) + text + " ".repeat(rightPad)
			}
			case "right":
				return " ".repeat(padding) + text
			case "left":
			default:
				return text + " ".repeat(padding)
		}
	}

	/**
	 * Get change indicator for comparison tables
	 */
	private getChangeIndicator(before: any, after: any): string {
		if (before === after) {
			return this.colorManager.muted("—")
		}

		if (typeof before === "number" && typeof after === "number") {
			const diff = after - before
			const symbol = diff > 0 ? "↑" : "↓"
			const color = diff > 0 ? "success" : "error"
			return this.colorManager[color](`${symbol} ${Math.abs(diff)}`)
		}

		return this.colorManager.warning("Changed")
	}
}
