import { OutputFormatterService } from "../services/OutputFormatterService"
import { OutputFormat } from "../types/output-types"
import { detectFormatFromFilename, getSuggestedFormat } from "../utils/format-detection"

describe("Output Formatting Integration", () => {
	let formatter: OutputFormatterService

	beforeEach(() => {
		formatter = new OutputFormatterService("1.0.0", false) // No colors for testing
		// Clear environment variables
		delete process.env.ROO_OUTPUT_FORMAT
		delete process.env.ROO_OUTPUT_FILE
	})

	afterEach(() => {
		// Clean up
		delete process.env.ROO_OUTPUT_FORMAT
		delete process.env.ROO_OUTPUT_FILE
	})

	describe("End-to-end formatting scenarios", () => {
		const sampleData = {
			files: [
				{ name: "app.js", size: 1024, modified: "2024-01-15T09:00:00Z" },
				{ name: "package.json", size: 512, modified: "2024-01-14T15:30:00Z" },
			],
			totalFiles: 2,
			totalSize: 1536,
		}

		it("should format as JSON when explicitly requested", () => {
			const result = formatter.formatComplete(sampleData, "list files", 150, 0, [], [], OutputFormat.JSON)

			expect(() => JSON.parse(result)).not.toThrow()
			const parsed = JSON.parse(result)
			expect(parsed.data.files).toHaveLength(2)
			expect(parsed.metadata.command).toBe("list files")
			expect(parsed.metadata.format).toBe("json")
		})

		it("should format as plain text with proper structure", () => {
			const result = formatter.formatComplete(sampleData, "list files", 150, 0, [], [], OutputFormat.PLAIN)

			expect(result).toContain("files:")
			expect(result).toContain("app.js")
			expect(result).toContain("package.json")
			expect(result).toContain("Command completed in 150ms")
		})

		it("should format as YAML with proper structure", () => {
			const result = formatter.formatComplete(sampleData, "list files", 150, 0, [], [], OutputFormat.YAML)

			expect(result).toContain("metadata:")
			expect(result).toContain("data:")
			expect(result).toContain("files:")
			expect(result).toContain("- name: app.js")
		})

		it("should format as CSV with tabular structure", () => {
			const result = formatter.formatComplete(sampleData, "list files", 150, 0, [], [], OutputFormat.CSV)

			expect(result).toContain("Metadata,Value")
			expect(result).toContain("list files")
			expect(result).toContain("150")
		})

		it("should format as Markdown with proper headers", () => {
			const result = formatter.formatComplete(sampleData, "list files", 150, 0, [], [], OutputFormat.MARKDOWN)

			expect(result).toContain("# 📋 Command Results")
			expect(result).toContain("## Data")
			expect(result).toContain("**files:**")
			expect(result).toContain("app.js")
		})
	})

	describe("Error and warning formatting", () => {
		it("should format errors consistently across formats", () => {
			const error = new Error("Test error")
			const formats = [OutputFormat.JSON, OutputFormat.PLAIN, OutputFormat.YAML, OutputFormat.MARKDOWN]

			formats.forEach((format) => {
				const result = formatter.formatError(error, format)
				expect(result).toContain("Test error")
				expect(result.length).toBeGreaterThan(0)
			})
		})

		it("should include errors and warnings in complete output", () => {
			const errors = [{ code: "TEST_ERROR", message: "Something went wrong" }]
			const warnings = ["This is a warning"]

			const result = formatter.formatComplete(
				{ message: "Done" },
				"test command",
				100,
				1,
				errors,
				warnings,
				OutputFormat.JSON,
			)

			const parsed = JSON.parse(result)
			expect(parsed.errors).toHaveLength(1)
			expect(parsed.warnings).toHaveLength(1)
			expect(parsed.metadata.exitCode).toBe(1)
		})
	})

	describe("Environment variable integration", () => {
		it("should respect ROO_OUTPUT_FORMAT environment variable", () => {
			process.env.ROO_OUTPUT_FORMAT = "yaml"
			const newFormatter = new OutputFormatterService("1.0.0", false)

			expect(newFormatter.getDefaultFormat()).toBe(OutputFormat.YAML)
		})

		it("should resolve format with proper priority", () => {
			process.env.ROO_OUTPUT_FORMAT = "yaml"

			// Explicit format should override environment
			expect(formatter.resolveFormat("json")).toBe(OutputFormat.JSON)

			// Environment should be used when no explicit format
			expect(formatter.resolveFormat()).toBe(OutputFormat.YAML)
		})
	})

	describe("File extension detection", () => {
		it("should detect format from file extensions", () => {
			expect(detectFormatFromFilename("output.json")).toBe(OutputFormat.JSON)
			expect(detectFormatFromFilename("config.yaml")).toBe(OutputFormat.YAML)
			expect(detectFormatFromFilename("data.csv")).toBe(OutputFormat.CSV)
			expect(detectFormatFromFilename("readme.md")).toBe(OutputFormat.MARKDOWN)
		})

		it("should suggest appropriate format based on context", () => {
			// Mock TTY for interactive mode
			const originalIsTTY = process.stdout.isTTY

			process.stdout.isTTY = true
			expect(getSuggestedFormat()).toBe(OutputFormat.PLAIN)

			process.stdout.isTTY = false
			expect(getSuggestedFormat()).toBe(OutputFormat.JSON)

			// Restore original
			process.stdout.isTTY = originalIsTTY
		})
	})

	describe("Data validation and transformation", () => {
		it("should handle circular references in JSON", () => {
			const circularData: any = { name: "test" }
			circularData.self = circularData

			expect(() => {
				formatter.format(circularData, OutputFormat.JSON)
			}).not.toThrow()
		})

		it("should handle complex nested data structures", () => {
			const complexData = {
				users: [
					{ id: 1, name: "John", profile: { age: 30, city: "NYC" } },
					{ id: 2, name: "Jane", profile: { age: 25, city: "LA" } },
				],
				metadata: {
					total: 2,
					lastUpdated: new Date().toISOString(),
				},
			}

			const formats = [OutputFormat.JSON, OutputFormat.YAML, OutputFormat.PLAIN]
			formats.forEach((format) => {
				expect(() => {
					formatter.format(complexData, format)
				}).not.toThrow()
			})
		})
	})

	describe("Table formatting", () => {
		it("should format table data consistently", () => {
			const tableData = {
				headers: ["Name", "Age", "City"],
				rows: [
					["John", 30, "New York"],
					["Jane", 25, "Los Angeles"],
				],
			}

			const formats = [OutputFormat.PLAIN, OutputFormat.CSV, OutputFormat.MARKDOWN]
			formats.forEach((format) => {
				const result = formatter.formatTable(tableData, format)
				expect(result).toContain("Name")
				expect(result).toContain("John")
				expect(result).toContain("Jane")
			})
		})
	})

	describe("Progress formatting", () => {
		it("should format progress data across formats", () => {
			const progressData = {
				current: 75,
				total: 100,
				percentage: 75,
				message: "Processing files...",
			}

			const formats = Object.values(OutputFormat)
			formats.forEach((format) => {
				const result = formatter.formatProgress(progressData, format)
				expect(result).toContain("75")
				expect(result).toContain("Processing files...")
			})
		})
	})
})
