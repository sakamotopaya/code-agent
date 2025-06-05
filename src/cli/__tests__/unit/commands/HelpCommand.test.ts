import { HelpCommand } from "../../../commands/HelpCommand"

// Mock chalk to avoid ES module issues in tests
jest.mock("chalk", () => {
	const mockColorFunction = (str: string) => str
	mockColorFunction.bold = (str: string) => str

	return {
		cyan: Object.assign(mockColorFunction, { bold: mockColorFunction }),
		white: Object.assign(mockColorFunction, { bold: mockColorFunction }),
		yellow: mockColorFunction,
		green: mockColorFunction,
		gray: mockColorFunction,
		red: mockColorFunction,
		blue: mockColorFunction,
	}
})

describe("HelpCommand", () => {
	let helpCommand: HelpCommand
	let consoleSpy: jest.SpyInstance

	beforeEach(() => {
		helpCommand = new HelpCommand()
		consoleSpy = jest.spyOn(console, "log").mockImplementation()
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	describe("showGeneralHelp", () => {
		it("should display general help information", () => {
			helpCommand.showGeneralHelp()

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("🤖 Roo CLI - AI-powered development assistant"),
			)
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("USAGE:"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("COMMANDS:"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("EXAMPLES:"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("MODES:"))
		})

		it("should include all essential sections", () => {
			helpCommand.showGeneralHelp()

			const allOutput = consoleSpy.mock.calls.flat().join(" ")

			// Check for key sections
			expect(allOutput).toContain("USAGE:")
			expect(allOutput).toContain("COMMANDS:")
			expect(allOutput).toContain("COMMON OPTIONS:")
			expect(allOutput).toContain("MODES:")
			expect(allOutput).toContain("EXAMPLES:")
			expect(allOutput).toContain("GETTING HELP:")
		})

		it("should include all agent modes", () => {
			helpCommand.showGeneralHelp()

			const allOutput = consoleSpy.mock.calls.flat().join(" ")

			// Check for all modes
			expect(allOutput).toContain("code")
			expect(allOutput).toContain("debug")
			expect(allOutput).toContain("architect")
			expect(allOutput).toContain("ask")
			expect(allOutput).toContain("test")
			expect(allOutput).toContain("design-engineer")
			expect(allOutput).toContain("release-engineer")
			expect(allOutput).toContain("translate")
			expect(allOutput).toContain("product-owner")
			expect(allOutput).toContain("orchestrator")
		})
	})

	describe("showCommandHelp", () => {
		it("should show help for config command", () => {
			helpCommand.showCommandHelp("config")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Command: config"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Description:"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Options:"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Examples:"))
		})

		it("should show help for session command", () => {
			helpCommand.showCommandHelp("session")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Command: session")
			expect(allOutput).toContain("Manage CLI sessions")
		})

		it("should show help for mcp command", () => {
			helpCommand.showCommandHelp("mcp")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Command: mcp")
			expect(allOutput).toContain("Model Context Protocol")
		})

		it("should handle unknown commands gracefully", () => {
			helpCommand.showCommandHelp("nonexistent")

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("No help available for command: nonexistent"),
			)
		})

		it("should suggest similar commands for typos", () => {
			helpCommand.showCommandHelp("confi")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Did you mean:")
			expect(allOutput).toContain("config")
		})
	})

	describe("showToolHelp", () => {
		it("should show tools list when no specific tool requested", () => {
			helpCommand.showToolHelp("list")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Available Tools"))
		})

		it("should show help for read_file tool", () => {
			helpCommand.showToolHelp("read_file")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Tool: read_file")
			expect(allOutput).toContain("File Operations")
			expect(allOutput).toContain("Parameters:")
			expect(allOutput).toContain("Examples:")
		})

		it("should show help for write_to_file tool", () => {
			helpCommand.showToolHelp("write_to_file")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Tool: write_to_file")
			expect(allOutput).toContain("Create or overwrite files")
		})

		it("should show help for execute_command tool", () => {
			helpCommand.showToolHelp("execute_command")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Tool: execute_command")
			expect(allOutput).toContain("Terminal Tools")
		})

		it("should show help for browser_action tool", () => {
			helpCommand.showToolHelp("browser_action")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Tool: browser_action")
			expect(allOutput).toContain("Browser Tools")
		})

		it("should handle unknown tools gracefully", () => {
			helpCommand.showToolHelp("nonexistent_tool")

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("No help available for tool: nonexistent_tool"),
			)
		})

		it("should suggest similar tools for typos", () => {
			helpCommand.showToolHelp("read_fil")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Did you mean:")
			expect(allOutput).toContain("read_file")
		})
	})

	describe("showConfigHelp", () => {
		it("should display configuration help", () => {
			helpCommand.showConfigHelp()

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Configuration Help"))

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Configuration Priority")
			expect(allOutput).toContain("Configuration Files:")
			expect(allOutput).toContain("Environment Variables:")
			expect(allOutput).toContain("Common Commands:")
		})

		it("should include environment variable examples", () => {
			helpCommand.showConfigHelp()

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("ROO_API_KEY")
			expect(allOutput).toContain("ROO_MODEL")
			expect(allOutput).toContain("ROO_MODE")
			expect(allOutput).toContain("ROO_OUTPUT_FORMAT")
		})

		it("should include configuration file locations", () => {
			helpCommand.showConfigHelp()

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain(".roo-cli.json")
			expect(allOutput).toContain("~/.roo-cli/config.json")
		})
	})

	describe("searchHelp", () => {
		it("should search and return relevant results", () => {
			helpCommand.searchHelp("config")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Search Results for: "config"'))
		})

		it("should find commands in search results", () => {
			helpCommand.searchHelp("session")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Command")
			expect(allOutput).toContain("session")
		})

		it("should find tools in search results", () => {
			helpCommand.searchHelp("file")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Tool")
		})

		it("should handle no results gracefully", () => {
			helpCommand.searchHelp("xyz123nonexistent")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No results found"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Try searching for:"))
		})

		it("should provide search suggestions when no results", () => {
			helpCommand.searchHelp("impossiblequery")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Try searching for:")
			expect(allOutput).toContain("Command names")
			expect(allOutput).toContain("Tool categories")
			expect(allOutput).toContain("Topics")
		})
	})

	describe("similarity algorithm", () => {
		it("should find exact matches", () => {
			helpCommand.showCommandHelp("config")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Command: config")
		})

		it("should handle case insensitive matching", () => {
			helpCommand.showCommandHelp("CONFIG")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Command: config")
		})

		it("should suggest similar commands for partial matches", () => {
			helpCommand.showCommandHelp("sess")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Did you mean:")
		})
	})

	describe("tool categories", () => {
		it("should organize tools by category", () => {
			helpCommand.showToolHelp("list")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("File Operations:")
			expect(allOutput).toContain("Terminal Tools:")
			expect(allOutput).toContain("Browser Tools:")
		})

		it("should show tool descriptions in category listing", () => {
			helpCommand.showToolHelp("list")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("read_file")
			expect(allOutput).toContain("write_to_file")
			expect(allOutput).toContain("execute_command")
			expect(allOutput).toContain("browser_action")
		})
	})

	describe("command examples", () => {
		it("should include examples for config command", () => {
			helpCommand.showCommandHelp("config")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("roo-cli config --show")
			expect(allOutput).toContain("roo-cli config --validate")
			expect(allOutput).toContain("roo-cli --generate-config")
		})

		it("should include examples for session command", () => {
			helpCommand.showCommandHelp("session")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("roo-cli session list")
			expect(allOutput).toContain("roo-cli session save")
			expect(allOutput).toContain("roo-cli session load")
		})

		it("should include examples for mcp command", () => {
			helpCommand.showCommandHelp("mcp")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("roo-cli mcp list")
			expect(allOutput).toContain("roo-cli mcp connect")
			expect(allOutput).toContain("roo-cli mcp tools")
		})
	})

	describe("help formatting", () => {
		it("should use consistent formatting across all help sections", () => {
			helpCommand.showGeneralHelp()

			const calls = consoleSpy.mock.calls

			// Check that we have structured output with key sections
			const allOutput = calls.flat().join(" ")
			expect(allOutput).toContain("🤖 Roo CLI")
			expect(allOutput).toContain("USAGE:")
			expect(allOutput).toContain("COMMANDS:")
			expect(allOutput).toContain("COMMON OPTIONS:")
			expect(allOutput).toContain("MODES:")
			expect(allOutput).toContain("EXAMPLES:")
		})

		it("should format tool parameters correctly", () => {
			helpCommand.showToolHelp("read_file")

			const allOutput = consoleSpy.mock.calls.flat().join(" ")
			expect(allOutput).toContain("Parameters:")
			expect(allOutput).toContain("path")
			expect(allOutput).toContain("string")
			expect(allOutput).toContain("Required")
		})
	})
})
