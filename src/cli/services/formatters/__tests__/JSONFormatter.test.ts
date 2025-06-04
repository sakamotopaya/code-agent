import { JSONFormatter } from "../JSONFormatter"
import { FormattedOutput, OutputFormat, ProgressData, TableData } from "../../../types/output-types"

describe("JSONFormatter", () => {
	let formatter: JSONFormatter

	beforeEach(() => {
		formatter = new JSONFormatter()
	})

	describe("format", () => {
		it("should format simple data correctly", () => {
			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.JSON,
					command: "test",
					duration: 100,
					exitCode: 0,
				},
				data: { message: "Hello, World!" },
			}

			const result = formatter.format(data)
			const parsed = JSON.parse(result)

			expect(parsed.metadata.timestamp).toBe("2024-01-01T00:00:00Z")
			expect(parsed.data.message).toBe("Hello, World!")
		})

		it("should handle circular references", () => {
			const circularData: any = { name: "test" }
			circularData.self = circularData

			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.JSON,
					command: "test",
					duration: 100,
					exitCode: 0,
				},
				data: circularData,
			}

			const result = formatter.format(data)
			expect(() => JSON.parse(result)).not.toThrow()

			const parsed = JSON.parse(result)
			expect(parsed.data.self).toBe("[Circular Reference]")
		})

		it("should format errors and warnings", () => {
			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.JSON,
					command: "test",
					duration: 100,
					exitCode: 1,
				},
				data: null,
				errors: [
					{
						code: "TEST_ERROR",
						message: "Test error message",
						details: { extra: "info" },
					},
				],
				warnings: [
					{
						code: "TEST_WARNING",
						message: "Test warning message",
					},
				],
			}

			const result = formatter.format(data)
			const parsed = JSON.parse(result)

			expect(parsed.errors).toHaveLength(1)
			expect(parsed.errors[0].code).toBe("TEST_ERROR")
			expect(parsed.warnings).toHaveLength(1)
			expect(parsed.warnings[0].code).toBe("TEST_WARNING")
		})
	})

	describe("formatError", () => {
		it("should format basic error", () => {
			const error = new Error("Test error")
			const result = formatter.formatError(error)
			const parsed = JSON.parse(result)

			expect(parsed.error.message).toBe("Test error")
			expect(parsed.error.name).toBe("Error")
			expect(parsed.metadata.format).toBe("json")
		})

		it("should include error code if available", () => {
			const error = new Error("Test error") as any
			error.code = "ENOENT"

			const result = formatter.formatError(error)
			const parsed = JSON.parse(result)

			expect(parsed.error.code).toBe("ENOENT")
		})
	})

	describe("formatProgress", () => {
		it("should format progress data", () => {
			const progress: ProgressData = {
				current: 50,
				total: 100,
				percentage: 50,
				message: "Processing...",
			}

			const result = formatter.formatProgress(progress)
			const parsed = JSON.parse(result)

			expect(parsed.progress.current).toBe(50)
			expect(parsed.progress.total).toBe(100)
			expect(parsed.progress.percentage).toBe(50)
			expect(parsed.progress.message).toBe("Processing...")
		})
	})

	describe("formatTable", () => {
		it("should format table data", () => {
			const table: TableData = {
				headers: ["Name", "Age", "City"],
				rows: [
					["John", 30, "New York"],
					["Jane", 25, "Los Angeles"],
				],
			}

			const result = formatter.formatTable(table)
			const parsed = JSON.parse(result)

			expect(parsed.table.headers).toEqual(["Name", "Age", "City"])
			expect(parsed.table.rows).toHaveLength(2)
			expect(parsed.table.rowCount).toBe(2)
			expect(parsed.table.columnCount).toBe(3)
		})

		it("should handle empty table", () => {
			const table: TableData = {
				headers: ["Name"],
				rows: [],
			}

			const result = formatter.formatTable(table)
			const parsed = JSON.parse(result)

			expect(parsed.table.rowCount).toBe(0)
			expect(parsed.table.columnCount).toBe(1)
		})
	})

	describe("removeCircularReferences", () => {
		it("should handle nested circular references", () => {
			const obj1: any = { name: "obj1" }
			const obj2: any = { name: "obj2", ref: obj1 }
			obj1.ref = obj2

			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.JSON,
					command: "test",
					duration: 100,
					exitCode: 0,
				},
				data: { complex: obj1 },
			}

			const result = formatter.format(data)
			expect(() => JSON.parse(result)).not.toThrow()

			const parsed = JSON.parse(result)
			expect(parsed.data.complex.ref.ref).toBe("[Circular Reference]")
		})

		it("should handle arrays with circular references", () => {
			const arr: any[] = []
			arr.push(arr)

			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.JSON,
					command: "test",
					duration: 100,
					exitCode: 0,
				},
				data: arr,
			}

			const result = formatter.format(data)
			expect(() => JSON.parse(result)).not.toThrow()

			const parsed = JSON.parse(result)
			expect(parsed.data[0]).toBe("[Circular Reference]")
		})
	})
})
