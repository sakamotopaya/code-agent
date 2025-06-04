import {
	detectFormatFromFilename,
	isOutputRedirected,
	getSuggestedFormat,
	isValidFormat,
	getFormatDisplayName,
	getAvailableFormatsWithDescriptions,
	isMachineReadableFormat,
	supportsStreamingOutput,
} from "../format-detection"
import { OutputFormat } from "../../types/output-types"

describe("format-detection", () => {
	// Store original values to restore after tests
	const originalIsTTY = process.stdout.isTTY
	const originalEnv = { ...process.env }

	afterEach(() => {
		// Restore original state
		process.stdout.isTTY = originalIsTTY
		process.env = { ...originalEnv }
	})

	describe("detectFormatFromFilename", () => {
		it("should detect JSON format", () => {
			expect(detectFormatFromFilename("output.json")).toBe(OutputFormat.JSON)
			expect(detectFormatFromFilename("path/to/file.json")).toBe(OutputFormat.JSON)
		})

		it("should detect YAML format", () => {
			expect(detectFormatFromFilename("config.yaml")).toBe(OutputFormat.YAML)
			expect(detectFormatFromFilename("config.yml")).toBe(OutputFormat.YAML)
		})

		it("should detect CSV format", () => {
			expect(detectFormatFromFilename("data.csv")).toBe(OutputFormat.CSV)
		})

		it("should detect Markdown format", () => {
			expect(detectFormatFromFilename("readme.md")).toBe(OutputFormat.MARKDOWN)
			expect(detectFormatFromFilename("docs.markdown")).toBe(OutputFormat.MARKDOWN)
		})

		it("should detect plain text format", () => {
			expect(detectFormatFromFilename("output.txt")).toBe(OutputFormat.PLAIN)
			expect(detectFormatFromFilename("log.text")).toBe(OutputFormat.PLAIN)
		})

		it("should return null for unknown extensions", () => {
			expect(detectFormatFromFilename("file.xml")).toBeNull()
			expect(detectFormatFromFilename("file.pdf")).toBeNull()
			expect(detectFormatFromFilename("file")).toBeNull()
		})

		it("should handle case insensitive extensions", () => {
			expect(detectFormatFromFilename("FILE.JSON")).toBe(OutputFormat.JSON)
			expect(detectFormatFromFilename("file.Yaml")).toBe(OutputFormat.YAML)
		})
	})

	describe("isOutputRedirected", () => {
		it("should return false when output is TTY", () => {
			process.stdout.isTTY = true
			expect(isOutputRedirected()).toBe(false)
		})

		it("should return true when output is redirected", () => {
			process.stdout.isTTY = false
			expect(isOutputRedirected()).toBe(true)
		})

		it("should return true when isTTY is undefined", () => {
			;(process.stdout as any).isTTY = undefined
			expect(isOutputRedirected()).toBe(true)
		})
	})

	describe("getSuggestedFormat", () => {
		it("should return format from environment variable", () => {
			process.env.ROO_OUTPUT_FORMAT = "json"
			expect(getSuggestedFormat()).toBe(OutputFormat.JSON)
		})

		it("should handle uppercase environment variable format", () => {
			process.env.ROO_OUTPUT_FORMAT = "JSON"
			expect(getSuggestedFormat()).toBe(OutputFormat.JSON)

			process.env.ROO_OUTPUT_FORMAT = "YAML"
			expect(getSuggestedFormat()).toBe(OutputFormat.YAML)

			process.env.ROO_OUTPUT_FORMAT = "CSV"
			expect(getSuggestedFormat()).toBe(OutputFormat.CSV)
		})

		it("should ignore invalid environment variable format", () => {
			process.env.ROO_OUTPUT_FORMAT = "invalid"
			process.stdout.isTTY = true
			expect(getSuggestedFormat()).toBe(OutputFormat.PLAIN)
		})

		it("should return JSON for redirected output without file hint", () => {
			delete process.env.ROO_OUTPUT_FORMAT
			process.stdout.isTTY = false
			expect(getSuggestedFormat()).toBe(OutputFormat.JSON)
		})

		it("should detect format from output file hint", () => {
			delete process.env.ROO_OUTPUT_FORMAT
			process.stdout.isTTY = false
			process.env.ROO_OUTPUT_FILE = "output.yaml"
			expect(getSuggestedFormat()).toBe(OutputFormat.YAML)
		})

		it("should return plain text for interactive use", () => {
			delete process.env.ROO_OUTPUT_FORMAT
			process.stdout.isTTY = true
			expect(getSuggestedFormat()).toBe(OutputFormat.PLAIN)
		})

		it("should prioritize env var over output file", () => {
			process.env.ROO_OUTPUT_FORMAT = "json"
			process.env.ROO_OUTPUT_FILE = "output.yaml"
			expect(getSuggestedFormat()).toBe(OutputFormat.JSON)
		})
	})

	describe("isValidFormat", () => {
		it("should validate all known formats", () => {
			expect(isValidFormat("json")).toBe(true)
			expect(isValidFormat("plain")).toBe(true)
			expect(isValidFormat("yaml")).toBe(true)
			expect(isValidFormat("csv")).toBe(true)
			expect(isValidFormat("markdown")).toBe(true)
		})

		it("should reject unknown formats", () => {
			expect(isValidFormat("xml")).toBe(false)
			expect(isValidFormat("invalid")).toBe(false)
			expect(isValidFormat("")).toBe(false)
			expect(isValidFormat("JSON")).toBe(false) // case sensitive
		})
	})

	describe("getFormatDisplayName", () => {
		it("should return display names for all formats", () => {
			expect(getFormatDisplayName(OutputFormat.JSON)).toContain("JSON")
			expect(getFormatDisplayName(OutputFormat.PLAIN)).toContain("Plain Text")
			expect(getFormatDisplayName(OutputFormat.YAML)).toContain("YAML")
			expect(getFormatDisplayName(OutputFormat.CSV)).toContain("CSV")
			expect(getFormatDisplayName(OutputFormat.MARKDOWN)).toContain("Markdown")
		})

		it("should return the format itself for unknown formats", () => {
			expect(getFormatDisplayName("unknown" as OutputFormat)).toBe("unknown")
		})
	})

	describe("getAvailableFormatsWithDescriptions", () => {
		it("should return all formats with descriptions", () => {
			const formats = getAvailableFormatsWithDescriptions()

			expect(formats).toHaveLength(5)
			expect(formats.map((f) => f.format)).toContain(OutputFormat.JSON)
			expect(formats.map((f) => f.format)).toContain(OutputFormat.PLAIN)
			expect(formats.map((f) => f.format)).toContain(OutputFormat.YAML)
			expect(formats.map((f) => f.format)).toContain(OutputFormat.CSV)
			expect(formats.map((f) => f.format)).toContain(OutputFormat.MARKDOWN)

			formats.forEach((format) => {
				expect(format.description).toBeTruthy()
				expect(typeof format.description).toBe("string")
			})
		})
	})

	describe("isMachineReadableFormat", () => {
		it("should identify machine readable formats", () => {
			expect(isMachineReadableFormat(OutputFormat.JSON)).toBe(true)
			expect(isMachineReadableFormat(OutputFormat.YAML)).toBe(true)
			expect(isMachineReadableFormat(OutputFormat.CSV)).toBe(true)
		})

		it("should identify human readable formats", () => {
			expect(isMachineReadableFormat(OutputFormat.PLAIN)).toBe(false)
			expect(isMachineReadableFormat(OutputFormat.MARKDOWN)).toBe(false)
		})
	})

	describe("supportsStreamingOutput", () => {
		it("should identify formats that support streaming", () => {
			expect(supportsStreamingOutput(OutputFormat.JSON)).toBe(true)
			expect(supportsStreamingOutput(OutputFormat.CSV)).toBe(true)
		})

		it("should identify formats that do not support streaming", () => {
			expect(supportsStreamingOutput(OutputFormat.PLAIN)).toBe(false)
			expect(supportsStreamingOutput(OutputFormat.YAML)).toBe(false)
			expect(supportsStreamingOutput(OutputFormat.MARKDOWN)).toBe(false)
		})
	})
})
