import { OutputFormatterService } from "../OutputFormatterService"
import { OutputFormat, ProgressData, TableData } from "../../types/output-types"

describe("OutputFormatterService", () => {
	let service: OutputFormatterService

	beforeEach(() => {
		service = new OutputFormatterService("1.0.0", true)
		// Clear environment variables
		delete process.env.ROO_OUTPUT_FORMAT
		delete process.env.ROO_OUTPUT_FILE
	})

	afterEach(() => {
		// Clean up environment variables
		delete process.env.ROO_OUTPUT_FORMAT
		delete process.env.ROO_OUTPUT_FILE
	})

	describe("format", () => {
		it("should format data with default format", () => {
			const data = { message: "Hello, World!" }
			const result = service.format(data)

			expect(typeof result).toBe("string")
			expect(result).toContain("Hello, World!")
		})

		it("should format data with specified format", () => {
			const data = { message: "Hello, World!" }
			const result = service.format(data, OutputFormat.JSON)

			expect(() => JSON.parse(result)).not.toThrow()
			const parsed = JSON.parse(result)
			expect(parsed.data.message).toBe("Hello, World!")
		})

		it("should handle FormattedOutput directly", () => {
			const formattedData = {
				metadata: {
					timestamp: "2024-01-01T00:00:00Z",
					version: "1.0.0",
					format: OutputFormat.JSON,
					command: "test",
					duration: 100,
					exitCode: 0,
				},
				data: { message: "Hello!" },
			}

			const result = service.format(formattedData, OutputFormat.JSON)
			const parsed = JSON.parse(result)
			expect(parsed.metadata.version).toBe("1.0.0")
			expect(parsed.data.message).toBe("Hello!")
		})

		it("should throw error for unsupported format", () => {
			const data = { message: "Hello!" }
			expect(() => service.format(data, "unsupported" as OutputFormat)).toThrow()
		})
	})

	describe("format validation", () => {
		it("should validate known formats", () => {
			expect(service.validateFormat("json")).toBe(true)
			expect(service.validateFormat("plain")).toBe(true)
			expect(service.validateFormat("yaml")).toBe(true)
			expect(service.validateFormat("csv")).toBe(true)
			expect(service.validateFormat("markdown")).toBe(true)
		})

		it("should reject unknown formats", () => {
			expect(service.validateFormat("xml")).toBe(false)
			expect(service.validateFormat("invalid")).toBe(false)
			expect(service.validateFormat("")).toBe(false)
		})
	})

	describe("default format management", () => {
		it("should get and set default format", () => {
			expect(service.getDefaultFormat()).toBe(OutputFormat.PLAIN)

			service.setDefaultFormat(OutputFormat.JSON)
			expect(service.getDefaultFormat()).toBe(OutputFormat.JSON)
		})

		it("should throw error for invalid default format", () => {
			expect(() => service.setDefaultFormat("invalid" as OutputFormat)).toThrow()
		})

		it("should respect environment variable", () => {
			process.env.ROO_OUTPUT_FORMAT = "json"
			const newService = new OutputFormatterService("1.0.0", true)
			expect(newService.getDefaultFormat()).toBe(OutputFormat.JSON)
		})
	})

	describe("available formats", () => {
		it("should return all available formats", () => {
			const formats = service.getAvailableFormats()
			expect(formats).toContain(OutputFormat.JSON)
			expect(formats).toContain(OutputFormat.PLAIN)
			expect(formats).toContain(OutputFormat.YAML)
			expect(formats).toContain(OutputFormat.CSV)
			expect(formats).toContain(OutputFormat.MARKDOWN)
		})
	})

	describe("formatError", () => {
		it("should format error with default format", () => {
			const error = new Error("Test error")
			const result = service.formatError(error)

			expect(result).toContain("Test error")
		})

		it("should format error with JSON format", () => {
			const error = new Error("Test error")
			const result = service.formatError(error, OutputFormat.JSON)

			expect(() => JSON.parse(result)).not.toThrow()
			const parsed = JSON.parse(result)
			expect(parsed.error.message).toBe("Test error")
		})
	})

	describe("formatProgress", () => {
		it("should format progress with default format", () => {
			const progress: ProgressData = {
				current: 50,
				total: 100,
				percentage: 50,
				message: "Processing...",
			}

			const result = service.formatProgress(progress)
			expect(result).toContain("50%")
			expect(result).toContain("Processing...")
		})

		it("should format progress with JSON format", () => {
			const progress: ProgressData = {
				current: 25,
				total: 100,
				percentage: 25,
				message: "Quarter done",
			}

			const result = service.formatProgress(progress, OutputFormat.JSON)
			const parsed = JSON.parse(result)
			expect(parsed.progress.percentage).toBe(25)
		})
	})

	describe("formatTable", () => {
		it("should format table with default format", () => {
			const table: TableData = {
				headers: ["Name", "Age"],
				rows: [
					["John", 30],
					["Jane", 25],
				],
			}

			const result = service.formatTable(table)
			expect(result).toContain("Name")
			expect(result).toContain("John")
		})

		it("should format table with CSV format", () => {
			const table: TableData = {
				headers: ["Name", "Age"],
				rows: [
					["John", 30],
					["Jane", 25],
				],
			}

			const result = service.formatTable(table, OutputFormat.CSV)
			expect(result).toContain("Name,Age")
			expect(result).toContain("John,30")
		})
	})

	describe("formatComplete", () => {
		it("should format complete output with all metadata", () => {
			const data = { message: "Success!" }
			const command = "test-command"
			const duration = 150
			const exitCode = 0

			const result = service.formatComplete(data, command, duration, exitCode)

			expect(result).toContain("Success!")
			expect(result).toContain("150ms")
		})

		it("should include errors and warnings", () => {
			const data = { message: "Done" }
			const errors = [new Error("Test error")]
			const warnings = ["Test warning"]

			const result = service.formatComplete(data, "test", 100, 1, errors, warnings, OutputFormat.JSON)

			const parsed = JSON.parse(result)
			expect(parsed.errors).toHaveLength(1)
			expect(parsed.warnings).toHaveLength(1)
			expect(parsed.metadata.exitCode).toBe(1)
		})
	})

	describe("resolveFormat", () => {
		it("should prioritize explicit format", () => {
			process.env.ROO_OUTPUT_FORMAT = "yaml"
			const format = service.resolveFormat("json")
			expect(format).toBe(OutputFormat.JSON)
		})

		it("should fall back to environment variable", () => {
			process.env.ROO_OUTPUT_FORMAT = "yaml"
			const format = service.resolveFormat()
			expect(format).toBe(OutputFormat.YAML)
		})

		it("should fall back to default format", () => {
			const format = service.resolveFormat()
			expect(format).toBe(service.getDefaultFormat())
		})

		it("should ignore invalid explicit format", () => {
			process.env.ROO_OUTPUT_FORMAT = "yaml"
			const format = service.resolveFormat("invalid")
			expect(format).toBe(OutputFormat.YAML)
		})
	})

	describe("error normalization", () => {
		it("should normalize Error objects", () => {
			const error = new Error("Test error")
			;(error as any).code = "TEST_CODE"

			const result = service.formatComplete({}, "test", 100, 1, [error], [], OutputFormat.JSON)

			const parsed = JSON.parse(result)
			expect(parsed.errors[0].code).toBe("TEST_CODE")
			expect(parsed.errors[0].message).toBe("Test error")
		})

		it("should normalize string errors", () => {
			const result = service.formatComplete({}, "test", 100, 1, ["String error"], [], OutputFormat.JSON)

			const parsed = JSON.parse(result)
			expect(parsed.errors[0].code).toBe("STRING_ERROR")
			expect(parsed.errors[0].message).toBe("String error")
		})

		it("should normalize object errors", () => {
			const errorObj = { code: "CUSTOM", message: "Custom error", details: { info: "extra" } }

			const result = service.formatComplete({}, "test", 100, 1, [errorObj], [], OutputFormat.JSON)

			const parsed = JSON.parse(result)
			expect(parsed.errors[0].code).toBe("CUSTOM")
			expect(parsed.errors[0].message).toBe("Custom error")
		})
	})

	describe("warning normalization", () => {
		it("should normalize string warnings", () => {
			const result = service.formatComplete({}, "test", 100, 0, [], ["String warning"], OutputFormat.JSON)

			const parsed = JSON.parse(result)
			expect(parsed.warnings[0].code).toBe("STRING_WARNING")
			expect(parsed.warnings[0].message).toBe("String warning")
		})

		it("should normalize object warnings", () => {
			const warningObj = { code: "CUSTOM_WARN", message: "Custom warning" }

			const result = service.formatComplete({}, "test", 100, 0, [], [warningObj], OutputFormat.JSON)

			const parsed = JSON.parse(result)
			expect(parsed.warnings[0].code).toBe("CUSTOM_WARN")
			expect(parsed.warnings[0].message).toBe("Custom warning")
		})
	})
})
