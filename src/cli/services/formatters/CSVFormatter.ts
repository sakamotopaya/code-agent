import { IFormatter } from "../../types/formatter-types"
import { FormattedOutput, ProgressData, TableData } from "../../types/output-types"
import { stringify } from "csv-stringify/sync"

export class CSVFormatter implements IFormatter {
	format(data: FormattedOutput): string {
		// For CSV format, we'll convert the data to a tabular format
		const csvData = this.convertToCSV(data)

		try {
			return stringify(csvData, {
				header: true,
				quoted: true,
				escape: '"',
				record_delimiter: "\n",
			})
		} catch (error) {
			// Fallback to simple string representation
			return this.fallbackCSV(data)
		}
	}

	formatError(error: Error): string {
		const errorData = [
			["Type", "Message", "Code", "Timestamp"],
			["Error", error.message, (error as any).code || "UNKNOWN_ERROR", new Date().toISOString()],
		]

		return stringify(errorData, {
			header: false,
			quoted: true,
			escape: '"',
		})
	}

	formatProgress(progress: ProgressData): string {
		const progressData = [
			["Current", "Total", "Percentage", "Message", "Timestamp"],
			[
				progress.current.toString(),
				progress.total.toString(),
				`${progress.percentage}%`,
				progress.message,
				new Date().toISOString(),
			],
		]

		return stringify(progressData, {
			header: false,
			quoted: true,
			escape: '"',
		})
	}

	formatTable(data: TableData): string {
		const csvData = [data.headers, ...data.rows.map((row) => row.map((cell) => String(cell ?? "")))]

		return stringify(csvData, {
			header: false,
			quoted: true,
			escape: '"',
		})
	}

	private convertToCSV(data: FormattedOutput): any[] {
		const result: any[] = []

		// Add metadata as first rows
		if (data.metadata) {
			result.push(["Metadata", "Value"])
			result.push(["Timestamp", data.metadata.timestamp])
			result.push(["Version", data.metadata.version])
			result.push(["Format", data.metadata.format])
			result.push(["Command", data.metadata.command])
			result.push(["Duration (ms)", data.metadata.duration.toString()])
			result.push(["Exit Code", data.metadata.exitCode.toString()])
			result.push(["", ""]) // Empty row separator
		}

		// Add main data
		if (data.data) {
			result.push(["Data Type", "Data Value"])
			this.flattenObject(data.data, result)
			result.push(["", ""]) // Empty row separator
		}

		// Add errors
		if (data.errors && data.errors.length > 0) {
			result.push(["Error Code", "Error Message", "Error Details"])
			data.errors.forEach((error) => {
				result.push([error.code, error.message, error.details ? JSON.stringify(error.details) : ""])
			})
			result.push(["", "", ""]) // Empty row separator
		}

		// Add warnings
		if (data.warnings && data.warnings.length > 0) {
			result.push(["Warning Code", "Warning Message", "Warning Details"])
			data.warnings.forEach((warning) => {
				result.push([warning.code, warning.message, warning.details ? JSON.stringify(warning.details) : ""])
			})
		}

		return result
	}

	private flattenObject(obj: any, result: any[], prefix: string = ""): void {
		if (obj === null || obj === undefined) {
			result.push([prefix || "value", "null"])
			return
		}

		if (typeof obj !== "object") {
			result.push([prefix || "value", String(obj)])
			return
		}

		if (Array.isArray(obj)) {
			obj.forEach((item, index) => {
				const key = prefix ? `${prefix}[${index}]` : `item_${index}`
				this.flattenObject(item, result, key)
			})
			return
		}

		Object.entries(obj).forEach(([key, value]) => {
			const fullKey = prefix ? `${prefix}.${key}` : key
			this.flattenObject(value, result, fullKey)
		})
	}

	private fallbackCSV(data: FormattedOutput): string {
		const fallbackData = [
			["Field", "Value"],
			["Raw Data", JSON.stringify(data)],
		]

		return stringify(fallbackData, {
			header: false,
			quoted: true,
			escape: '"',
		})
	}
}
