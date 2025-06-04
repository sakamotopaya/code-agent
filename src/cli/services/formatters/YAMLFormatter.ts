import { IFormatter } from "../../types/formatter-types"
import { FormattedOutput, ProgressData, TableData, OutputFormat } from "../../types/output-types"
import * as yaml from "yaml"

export class YAMLFormatter implements IFormatter {
	format(data: FormattedOutput): string {
		try {
			return yaml.stringify(data, {
				lineWidth: 120,
				sortMapEntries: true,
			})
		} catch (error) {
			// Handle circular references by removing them
			const cleanData = this.removeCircularReferences(data)
			return yaml.stringify(cleanData, {
				lineWidth: 120,
				sortMapEntries: true,
			})
		}
	}

	formatError(error: Error): string {
		const errorObject = {
			error: {
				message: error.message,
				name: error.name,
				stack: error.stack,
				code: (error as any).code || "UNKNOWN_ERROR",
			},
			metadata: {
				timestamp: new Date().toISOString(),
				format: OutputFormat.YAML,
			},
		}

		return yaml.stringify(errorObject, {
			lineWidth: 120,
		})
	}

	formatProgress(progress: ProgressData): string {
		const progressObject = {
			progress: {
				current: progress.current,
				total: progress.total,
				percentage: progress.percentage,
				message: progress.message,
			},
			metadata: {
				timestamp: new Date().toISOString(),
				format: OutputFormat.YAML,
			},
		}

		return yaml.stringify(progressObject, {
			lineWidth: 120,
		})
	}

	formatTable(data: TableData): string {
		const tableObject = {
			table: {
				headers: data.headers,
				rows: data.rows,
				summary: {
					rowCount: data.rows.length,
					columnCount: data.headers.length,
				},
			},
			metadata: {
				timestamp: new Date().toISOString(),
				format: OutputFormat.YAML,
			},
		}

		return yaml.stringify(tableObject, {
			lineWidth: 120,
		})
	}

	private removeCircularReferences(obj: any, seen = new WeakSet()): any {
		if (obj === null || typeof obj !== "object") {
			return obj
		}

		if (seen.has(obj)) {
			return "[Circular Reference]"
		}

		seen.add(obj)

		if (Array.isArray(obj)) {
			return obj.map((item) => this.removeCircularReferences(item, seen))
		}

		const result: any = {}
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				result[key] = this.removeCircularReferences(obj[key], seen)
			}
		}

		seen.delete(obj)
		return result
	}
}
