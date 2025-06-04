import { PlainTextFormatter } from "../PlainTextFormatter"
import { FormattedOutput, OutputFormat, ProgressData, TableData } from "../../../types/output-types"

describe("PlainTextFormatter", () => {
	let formatter: PlainTextFormatter
	let formatterNoColors: PlainTextFormatter

	beforeEach(() => {
		formatter = new PlainTextFormatter(true)
		formatterNoColors = new PlainTextFormatter(false)
	})

	describe("format", () => {
		it("should format simple data correctly", () => {
			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.PLAIN,
					command: "test",
					duration: 100,
					exitCode: 0,
				},
				data: { message: "Hello, World!" },
			}

			const result = formatter.format(data)

			expect(result).toContain("message:")
			expect(result).toContain("Hello, World!")
			expect(result).toContain("Command completed in 100ms")
		})

		it("should format errors and warnings", () => {
			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.PLAIN,
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

			expect(result).toContain("Errors:")
			expect(result).toContain("❌")
			expect(result).toContain("Test error message")
			expect(result).toContain("Warnings:")
			expect(result).toContain("⚠️")
			expect(result).toContain("Test warning message")
		})

		it("should work without colors", () => {
			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.PLAIN,
					command: "test",
					duration: 100,
					exitCode: 0,
				},
				data: { message: "Hello, World!" },
			}

			const result = formatterNoColors.format(data)

			expect(result).toContain("Hello, World!")
			expect(result).toContain("Command completed in 100ms")
			// Should not contain ANSI escape codes
			expect(result.includes("\u001b[")).toBe(false)
		})

		it("should handle null/undefined data", () => {
			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.PLAIN,
					command: "test",
					duration: 100,
					exitCode: 0,
				},
				data: null,
			}

			const result = formatter.format(data)
			expect(result).toContain("No data")
		})

		it("should format arrays", () => {
			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.PLAIN,
					command: "test",
					duration: 100,
					exitCode: 0,
				},
				data: ["item1", "item2", "item3"],
			}

			const result = formatter.format(data)

			expect(result).toContain("1. item1")
			expect(result).toContain("2. item2")
			expect(result).toContain("3. item3")
		})
	})

	describe("formatError", () => {
		it("should format basic error", () => {
			const error = new Error("Test error")
			const result = formatter.formatError(error)

			expect(result).toContain("❌ Error:")
			expect(result).toContain("Test error")
		})

		it("should include stack trace in development", () => {
			const originalEnv = process.env.NODE_ENV
			process.env.NODE_ENV = "development"

			const error = new Error("Test error")
			const result = formatter.formatError(error)

			expect(result).toContain("Stack trace:")

			process.env.NODE_ENV = originalEnv
		})

		it("should not include stack trace in production", () => {
			const originalEnv = process.env.NODE_ENV
			process.env.NODE_ENV = "production"

			const error = new Error("Test error")
			const result = formatter.formatError(error)

			expect(result).not.toContain("Stack trace:")

			process.env.NODE_ENV = originalEnv
		})
	})

	describe("formatProgress", () => {
		it("should format progress with bar", () => {
			const progress: ProgressData = {
				current: 50,
				total: 100,
				percentage: 50,
				message: "Processing...",
			}

			const result = formatter.formatProgress(progress)

			expect(result).toContain("Progress:")
			expect(result).toContain("50%")
			expect(result).toContain("Processing...")
			expect(result).toContain("[")
			expect(result).toContain("]")
		})

		it("should handle 0% progress", () => {
			const progress: ProgressData = {
				current: 0,
				total: 100,
				percentage: 0,
				message: "Starting...",
			}

			const result = formatter.formatProgress(progress)
			expect(result).toContain("0%")
		})

		it("should handle 100% progress", () => {
			const progress: ProgressData = {
				current: 100,
				total: 100,
				percentage: 100,
				message: "Complete!",
			}

			const result = formatter.formatProgress(progress)
			expect(result).toContain("100%")
		})
	})

	describe("formatTable", () => {
		it("should format table with headers and rows", () => {
			const table: TableData = {
				headers: ["Name", "Age", "City"],
				rows: [
					["John", 30, "New York"],
					["Jane", 25, "Los Angeles"],
				],
			}

			const result = formatter.formatTable(table)

			expect(result).toContain("Name")
			expect(result).toContain("Age")
			expect(result).toContain("City")
			expect(result).toContain("John")
			expect(result).toContain("Jane")
			expect(result).toContain("│")
			expect(result).toContain("─")
		})

		it("should handle empty table", () => {
			const table: TableData = {
				headers: ["Name"],
				rows: [],
			}

			const result = formatter.formatTable(table)
			expect(result).toContain("No data to display")
		})

		it("should handle null values in table", () => {
			const table: TableData = {
				headers: ["Name", "Value"],
				rows: [
					["Test", null],
					["Test2", null],
				],
			}

			const result = formatter.formatTable(table)
			expect(result).toContain("Test")
			expect(result).toContain("Test2")
		})

		it("should calculate column widths correctly", () => {
			const table: TableData = {
				headers: ["Short", "Very Long Header Name"],
				rows: [
					["A", "B"],
					["Long Value", "C"],
				],
			}

			const result = formatter.formatTable(table)

			// Should align columns properly
			expect(result).toContain("Short")
			expect(result).toContain("Very Long Header Name")
			expect(result).toContain("Long Value")
		})
	})

	describe("value formatting", () => {
		it("should format different value types with colors", () => {
			const data: FormattedOutput = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.PLAIN,
					command: "test",
					duration: 100,
					exitCode: 0,
				},
				data: {
					string: "hello",
					number: 42,
					boolean: true,
					falseBool: false,
					nullValue: null,
					arrayValue: [1, 2, 3],
					objectValue: { key: "value" },
				},
			}

			const result = formatter.format(data)

			expect(result).toContain("hello")
			expect(result).toContain("42")
			expect(result).toContain("true")
			expect(result).toContain("false")
			expect(result).toContain("[3 items]")
			expect(result).toContain("{1 properties}")
		})
	})
})
