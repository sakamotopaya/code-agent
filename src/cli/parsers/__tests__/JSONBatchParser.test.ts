import { JSONBatchParser } from "../JSONBatchParser"
import { ErrorHandlingStrategy, OutputFormat } from "../../types/batch-types"

describe("JSONBatchParser", () => {
	let parser: JSONBatchParser

	beforeEach(() => {
		parser = new JSONBatchParser()
	})

	describe("parse", () => {
		it("should parse valid JSON batch file", () => {
			const jsonData = {
				version: "1.0",
				settings: {
					parallel: false,
					maxConcurrency: 2,
					continueOnError: true,
					verbose: true,
					dryRun: false,
					outputFormat: "json",
				},
				defaults: {
					confirmations: false,
					fileOverwrite: true,
					createDirectories: false,
					timeout: 60000,
					retryCount: 5,
				},
				commands: [
					{
						id: "cmd1",
						command: "echo",
						args: ["hello"],
						environment: {
							NODE_ENV: "test",
						},
						workingDirectory: "/tmp",
						timeout: 30000,
						retries: 2,
						dependsOn: [],
						condition: {
							type: "always",
						},
					},
				],
			}

			const result = parser.parse(jsonData)

			expect(result.commands).toHaveLength(1)
			expect(result.commands[0].id).toBe("cmd1")
			expect(result.commands[0].command).toBe("echo")
			expect(result.commands[0].args).toEqual(["hello"])
			expect(result.commands[0].environment).toEqual({ NODE_ENV: "test" })
			expect(result.commands[0].workingDirectory).toBe("/tmp")
			expect(result.commands[0].timeout).toBe(30000)
			expect(result.commands[0].retries).toBe(2)

			expect(result.settings.parallel).toBe(false)
			expect(result.settings.maxConcurrency).toBe(2)
			expect(result.settings.continueOnError).toBe(true)
			expect(result.settings.outputFormat).toBe(OutputFormat.JSON)

			expect(result.defaults.confirmations).toBe(false)
			expect(result.defaults.fileOverwrite).toBe(true)
			expect(result.defaults.timeout).toBe(60000)
			expect(result.defaults.retryCount).toBe(5)

			expect(result.errorHandling).toBe(ErrorHandlingStrategy.CONTINUE_ON_ERROR)
		})

		it("should parse minimal JSON batch file with defaults", () => {
			const jsonData = {
				version: "1.0",
				commands: [
					{
						id: "cmd1",
						command: "echo",
					},
				],
			}

			const result = parser.parse(jsonData)

			expect(result.commands).toHaveLength(1)
			expect(result.commands[0].args).toEqual([])
			expect(result.settings.parallel).toBe(false)
			expect(result.settings.maxConcurrency).toBe(1)
			expect(result.defaults.timeout).toBe(300000)
		})

		it("should throw error for invalid JSON structure", () => {
			expect(() => parser.parse(null)).toThrow("Invalid JSON batch file")
			expect(() => parser.parse("string")).toThrow("Invalid JSON batch file")
			expect(() => parser.parse(123)).toThrow("Invalid JSON batch file")
		})

		it("should throw error for missing version", () => {
			const jsonData = {
				commands: [],
			}

			expect(() => parser.parse(jsonData)).toThrow("Batch file version is required")
		})

		it("should throw error for invalid commands array", () => {
			const jsonData = {
				version: "1.0",
				commands: "not an array",
			}

			expect(() => parser.parse(jsonData)).toThrow("Commands must be an array")
		})

		it("should throw error for command without id", () => {
			const jsonData = {
				version: "1.0",
				commands: [
					{
						command: "echo",
					},
				],
			}

			expect(() => parser.parse(jsonData)).toThrow("must have a string 'id' field")
		})

		it("should throw error for command without command field", () => {
			const jsonData = {
				version: "1.0",
				commands: [
					{
						id: "cmd1",
					},
				],
			}

			expect(() => parser.parse(jsonData)).toThrow("must have a string 'command' field")
		})

		it("should parse different output formats", () => {
			const formats = [
				{ input: "json", expected: OutputFormat.JSON },
				{ input: "yaml", expected: OutputFormat.YAML },
				{ input: "yml", expected: OutputFormat.YAML },
				{ input: "csv", expected: OutputFormat.CSV },
				{ input: "markdown", expected: OutputFormat.MARKDOWN },
				{ input: "md", expected: OutputFormat.MARKDOWN },
				{ input: "text", expected: OutputFormat.TEXT },
				{ input: "plain", expected: OutputFormat.TEXT },
				{ input: "unknown", expected: OutputFormat.TEXT },
			]

			formats.forEach(({ input, expected }) => {
				const jsonData = {
					version: "1.0",
					settings: { outputFormat: input },
					commands: [{ id: "test", command: "echo" }],
				}

				const result = parser.parse(jsonData)
				expect(result.settings.outputFormat).toBe(expected)
			})
		})

		it("should parse different error handling strategies", () => {
			const strategies = [
				{ input: "continue_on_error", expected: ErrorHandlingStrategy.CONTINUE_ON_ERROR },
				{ input: "continue-on-error", expected: ErrorHandlingStrategy.CONTINUE_ON_ERROR },
				{ input: "collect_errors", expected: ErrorHandlingStrategy.COLLECT_ERRORS },
				{ input: "collect-errors", expected: ErrorHandlingStrategy.COLLECT_ERRORS },
				{ input: "retry_failures", expected: ErrorHandlingStrategy.RETRY_FAILURES },
				{ input: "retry-failures", expected: ErrorHandlingStrategy.RETRY_FAILURES },
				{ input: "fail_fast", expected: ErrorHandlingStrategy.FAIL_FAST },
				{ input: "fail-fast", expected: ErrorHandlingStrategy.FAIL_FAST },
				{ input: "unknown", expected: ErrorHandlingStrategy.FAIL_FAST },
			]

			strategies.forEach(({ input, expected }) => {
				const jsonData = {
					version: "1.0",
					settings: { continueOnError: input === "continue_on_error" },
					commands: [{ id: "test", command: "echo" }],
				}

				const result = parser.parse(jsonData)
				expect(result.errorHandling).toBe(expected)
			})
		})

		it("should parse command conditions", () => {
			const jsonData = {
				version: "1.0",
				commands: [
					{
						id: "cmd1",
						command: "echo",
						condition: {
							type: "file_exists",
							value: "package.json",
						},
					},
					{
						id: "cmd2",
						command: "echo",
						condition: {
							type: "exit_code",
							expectedExitCode: 0,
						},
					},
				],
			}

			const result = parser.parse(jsonData)

			expect(result.commands[0].condition).toEqual({
				type: "file_exists",
				value: "package.json",
			})

			expect(result.commands[1].condition).toEqual({
				type: "exit_code",
				expectedExitCode: 0,
			})
		})

		it("should throw error for invalid condition type", () => {
			const jsonData = {
				version: "1.0",
				commands: [
					{
						id: "cmd1",
						command: "echo",
						condition: {
							type: "invalid_type",
						},
					},
				],
			}

			expect(() => parser.parse(jsonData)).toThrow("Invalid condition type")
		})

		it("should throw error for invalid expectedExitCode", () => {
			const jsonData = {
				version: "1.0",
				commands: [
					{
						id: "cmd1",
						command: "echo",
						condition: {
							type: "exit_code",
							expectedExitCode: "not a number",
						},
					},
				],
			}

			expect(() => parser.parse(jsonData)).toThrow("expectedExitCode must be a number")
		})
	})

	describe("stringify", () => {
		it("should convert batch config to JSON string", () => {
			const config = {
				commands: [
					{
						id: "cmd1",
						command: "echo",
						args: ["hello"],
					},
				],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.JSON,
				},
				defaults: {
					confirmations: false,
					fileOverwrite: false,
					createDirectories: true,
					timeout: 300000,
					retryCount: 3,
				},
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			}

			const result = parser.stringify(config)
			const parsed = JSON.parse(result)

			expect(parsed.version).toBe("1.0")
			expect(parsed.commands).toHaveLength(1)
			expect(parsed.commands[0].id).toBe("cmd1")
		})
	})

	describe("validate", () => {
		it("should validate correct JSON data", () => {
			const jsonData = {
				version: "1.0",
				commands: [
					{
						id: "cmd1",
						command: "echo",
					},
				],
			}

			const result = parser.validate(jsonData)
			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it("should return validation errors for invalid data", () => {
			const jsonData = {
				version: "1.0",
				commands: [
					{
						// Missing required fields
					},
				],
			}

			const result = parser.validate(jsonData)
			expect(result.valid).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)
		})
	})
})
