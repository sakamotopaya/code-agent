import { ExamplesCommand } from "../ExamplesCommand"
import * as fs from "fs"
import inquirer from "inquirer"

// Mock file system
jest.mock("fs")
jest.mock("inquirer")

const mockFs = fs as jest.Mocked<typeof fs>

describe("ExamplesCommand", () => {
	let examplesCommand: ExamplesCommand
	let consoleSpy: jest.SpyInstance
	let mockInquirer: jest.Mocked<typeof inquirer>

	beforeEach(() => {
		// Clear all mocks
		jest.clearAllMocks()

		// Setup console spy
		consoleSpy = jest.spyOn(console, "log").mockImplementation()

		// Setup inquirer mock
		mockInquirer = inquirer as jest.Mocked<typeof inquirer>

		// Mock fs methods with proper return types
		mockFs.existsSync.mockReturnValue(true)
		mockFs.readdirSync.mockImplementation((path: any, options?: any) => {
			if (options?.withFileTypes) {
				return [
					{ name: "basic", isDirectory: () => true },
					{ name: "workflows", isDirectory: () => true },
					{ name: "integration", isDirectory: () => true },
					{ name: "troubleshooting", isDirectory: () => true },
				] as any
			}
			return ["getting-started.md", "help-system.md"] as any
		})
		mockFs.readFileSync.mockReturnValue("# Example Content\nMock content")

		// Create examples command with test path
		examplesCommand = new ExamplesCommand("/test/examples")
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	describe("constructor", () => {
		it("should initialize with default path when no path provided", () => {
			const defaultCommand = new ExamplesCommand()
			expect(defaultCommand).toBeDefined()
		})

		it("should initialize with custom path", () => {
			const customCommand = new ExamplesCommand("/custom/path")
			expect(customCommand).toBeDefined()
		})
	})

	describe("listCategories", () => {
		it("should display all available categories", async () => {
			await examplesCommand.listCategories()

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("📚 CLI USAGE EXAMPLES"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Available categories:"))
		})

		it("should show category icons and descriptions", async () => {
			await examplesCommand.listCategories()

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("🚀") // Basic icon
			expect(allOutput).toContain("🔄") // Workflows icon
			expect(allOutput).toContain("🔗") // Integration icon
			expect(allOutput).toContain("🔧") // Troubleshooting icon
		})

		it("should show usage instructions", async () => {
			await examplesCommand.listCategories()

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("roo examples <category>")
			expect(allOutput).toContain("roo examples search <query>")
			expect(allOutput).toContain("roo examples run <id>")
		})
	})

	describe("showCategory", () => {
		it("should display category examples when category exists", async () => {
			await examplesCommand.showCategory("basic")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("🚀 BASIC EXAMPLES"))
		})

		it("should handle non-existent category gracefully", async () => {
			await examplesCommand.showCategory("nonexistent")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("❌ Category 'nonexistent' not found"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Available categories:"))
		})

		it("should handle category with no examples", async () => {
			// Mock empty category
			mockFs.readdirSync.mockReturnValueOnce([])

			const emptyCommand = new ExamplesCommand("/test/examples")
			await emptyCommand.showCategory("basic")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No examples available in this category"))
		})

		it("should accept category by name or id", async () => {
			await examplesCommand.showCategory("Basic") // Case insensitive

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("🚀 BASIC EXAMPLES"))
		})
	})

	describe("searchExamples", () => {
		it("should return empty results for non-matching query", async () => {
			await examplesCommand.searchExamples("nonexistent")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No examples found matching 'nonexistent'"))
		})

		it("should display search results header", async () => {
			// Add some mock examples to search
			const mockExamples = [
				{
					id: "test-example",
					title: "Test Example",
					description: "A test example",
					command: "roo test",
					category: "basic",
					difficulty: "beginner" as const,
					tags: ["test"],
				},
			]

			// Mock the private method by accessing it through the instance
			;(examplesCommand as any).categories = [
				{
					id: "basic",
					name: "Basic",
					description: "Basic examples",
					examples: mockExamples,
				},
			]

			await examplesCommand.searchExamples("test")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("🔍 SEARCH RESULTS FOR 'test'"))
		})
	})

	describe("showExample", () => {
		it("should display error for non-existent example", async () => {
			await examplesCommand.showExample("nonexistent")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("❌ Example 'nonexistent' not found"))
		})

		it("should display example details when found", async () => {
			// Mock an example
			const mockExample = {
				id: "test-example",
				title: "Test Example",
				description: "A test example",
				command: "roo test",
				category: "basic",
				difficulty: "beginner" as const,
				estimatedTime: "1 minute",
				expectedOutput: "Test output",
				prerequisites: ["Node.js"],
				tags: ["test", "example"],
			}

			;(examplesCommand as any).categories = [
				{
					id: "basic",
					name: "Basic",
					description: "Basic examples",
					examples: [mockExample],
				},
			]

			await examplesCommand.showExample("test-example")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("📖 Test Example"))

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Category: Basic")
			expect(allOutput).toContain("Difficulty: beginner")
			expect(allOutput).toContain("Estimated Time: 1 minute")
			expect(allOutput).toContain("Description: A test example")
			expect(allOutput).toContain("Command: roo test")
			expect(allOutput).toContain("Prerequisites:")
			expect(allOutput).toContain("Node.js")
			expect(allOutput).toContain("Expected Output: Test output")
			expect(allOutput).toContain("Tags: #test #example")
		})
	})

	describe("runExample", () => {
		it("should display error for non-existent example", async () => {
			await examplesCommand.runExample("nonexistent")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("❌ Example 'nonexistent' not found"))
		})

		it("should execute example when found", async () => {
			// Mock an example
			const mockExample = {
				id: "test-example",
				title: "Test Example",
				description: "A test example",
				command: "roo test",
				category: "basic",
				difficulty: "beginner" as const,
			}

			;(examplesCommand as any).categories = [
				{
					id: "basic",
					name: "Basic",
					description: "Basic examples",
					examples: [mockExample],
				},
			]

			// Mock inquirer prompt
			mockInquirer.prompt.mockResolvedValue({ proceed: false })

			await examplesCommand.runExample("test-example")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("🚀 Running: Test Example"))
			expect(mockInquirer.prompt).toHaveBeenCalled()
		})
	})

	describe("createCustomExample", () => {
		it("should create custom example interactively", async () => {
			// Mock inquirer responses
			mockInquirer.prompt
				.mockResolvedValueOnce({
					title: "Custom Example",
					description: "A custom example",
					command: "roo custom",
					category: "basic",
					difficulty: "beginner",
					tags: ["custom", "test"],
				})
				.mockResolvedValueOnce({ run: false })

			// Mock categories for choices
			;(examplesCommand as any).categories = [
				{
					id: "basic",
					name: "Basic",
					description: "Basic examples",
					examples: [],
				},
			]

			await examplesCommand.createCustomExample()

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("✨ CREATE CUSTOM EXAMPLE"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("✅ Custom example created!"))
			expect(mockInquirer.prompt).toHaveBeenCalledTimes(2)
		})

		it("should validate required fields", async () => {
			// Mock validation by checking if prompt was called with validation functions
			mockInquirer.prompt.mockResolvedValueOnce({
				title: "Test Title",
				description: "Test Description",
				command: "test command",
				category: "basic",
				difficulty: "beginner",
				tags: [],
			})
			;(examplesCommand as any).categories = [
				{
					id: "basic",
					name: "Basic",
					description: "Basic examples",
					examples: [],
				},
			]

			await examplesCommand.createCustomExample()

			// Check that prompt was called
			expect(mockInquirer.prompt).toHaveBeenCalled()

			// Verify the prompt was called with question objects
			const promptCall = mockInquirer.prompt.mock.calls[0][0]
			expect(promptCall).toBeDefined()
		})
	})

	describe("error handling", () => {
		it("should handle file system errors gracefully", () => {
			// Mock file system error
			mockFs.existsSync.mockImplementation(() => {
				throw new Error("File system error")
			})

			// Should not throw when creating command
			expect(() => new ExamplesCommand("/invalid/path")).not.toThrow()
		})

		it("should handle malformed markdown files", () => {
			// Mock corrupted file content
			mockFs.readFileSync.mockImplementation(() => {
				throw new Error("File read error")
			})

			// Should handle gracefully
			expect(() => new ExamplesCommand("/test/examples")).not.toThrow()
		})
	})

	describe("utility methods", () => {
		it("should generate valid example IDs", () => {
			const generateId = (examplesCommand as any).generateExampleId.bind(examplesCommand)

			expect(generateId("Hello World Example")).toBe("hello-world-example")
			expect(generateId("Test@#$%")).toBe("test")
			expect(generateId("Multiple   Spaces")).toBe("multiple-spaces")
		})

		it("should format category names correctly", () => {
			const formatName = (examplesCommand as any).formatCategoryName.bind(examplesCommand)

			expect(formatName("basic")).toBe("Basic")
			expect(formatName("web-development")).toBe("Web development")
		})

		it("should provide appropriate category icons", () => {
			const getIcon = (examplesCommand as any).getCategoryIcon.bind(examplesCommand)

			expect(getIcon("basic")).toBe("🚀")
			expect(getIcon("workflows")).toBe("🔄")
			expect(getIcon("integration")).toBe("🔗")
			expect(getIcon("troubleshooting")).toBe("🔧")
			expect(getIcon("unknown")).toBe("📚")
		})

		it("should apply difficulty colors correctly", () => {
			const getDifficultyColor = (examplesCommand as any).getDifficultyColor.bind(examplesCommand)

			expect(getDifficultyColor("beginner")).toBeDefined()
			expect(getDifficultyColor("intermediate")).toBeDefined()
			expect(getDifficultyColor("advanced")).toBeDefined()
			expect(getDifficultyColor("unknown")).toBeDefined()
		})
	})

	describe("integration with TTY", () => {
		it("should not prompt for selection when not in TTY mode", async () => {
			// Mock TTY detection
			const originalIsTTY = process.stdout.isTTY
			process.stdout.isTTY = false

			try {
				await examplesCommand.showCategory("basic")

				// Should not call inquirer when not in TTY
				expect(mockInquirer.prompt).not.toHaveBeenCalled()
			} finally {
				process.stdout.isTTY = originalIsTTY
			}
		})

		it("should prompt for selection when in TTY mode", async () => {
			// Mock TTY detection
			const originalIsTTY = process.stdout.isTTY
			process.stdout.isTTY = true

			// Mock categories with examples
			;(examplesCommand as any).categories = [
				{
					id: "basic",
					name: "Basic",
					description: "Basic examples",
					examples: [
						{
							id: "test-example",
							title: "Test Example",
							description: "A test example",
							command: "roo test",
							category: "basic",
							difficulty: "beginner" as const,
						},
					],
				},
			]

			// Mock inquirer selection
			mockInquirer.prompt.mockResolvedValue({ example: -1 }) // Back to categories

			try {
				await examplesCommand.showCategory("basic")

				// Should call inquirer when in TTY
				expect(mockInquirer.prompt).toHaveBeenCalled()
			} finally {
				process.stdout.isTTY = originalIsTTY
			}
		})
	})
})
