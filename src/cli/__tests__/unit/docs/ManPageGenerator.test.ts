import { ManPageGenerator } from "../../../docs/ManPageGenerator"
import * as fs from "fs"
import * as path from "path"

// Mock fs module
jest.mock("fs", () => ({
	promises: {
		writeFile: jest.fn(),
		mkdir: jest.fn(),
	},
	readFileSync: jest.fn(),
}))

describe("ManPageGenerator", () => {
	let generator: ManPageGenerator
	let mockWriteFile: jest.MockedFunction<typeof fs.promises.writeFile>
	let mockMkdir: jest.MockedFunction<typeof fs.promises.mkdir>
	let mockReadFileSync: jest.MockedFunction<typeof fs.readFileSync>

	beforeEach(() => {
		jest.clearAllMocks()
		mockWriteFile = fs.promises.writeFile as jest.MockedFunction<typeof fs.promises.writeFile>
		mockMkdir = fs.promises.mkdir as jest.MockedFunction<typeof fs.promises.mkdir>
		mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>

		// Mock package.json reading
		mockReadFileSync.mockReturnValue(JSON.stringify({ version: "1.2.3" }))

		generator = new ManPageGenerator()
	})

	describe("generateManPage", () => {
		it("should generate a complete man page", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".TH ROO-CLI 1")
			expect(manPage).toContain("Roo CLI 1.2.3")
			expect(manPage).toContain("User Commands")
		})

		it("should include NAME section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH NAME")
			expect(manPage).toContain("roo-cli \\- AI-powered development assistant")
		})

		it("should include SYNOPSIS section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH SYNOPSIS")
			expect(manPage).toContain(".B roo-cli")
			expect(manPage).toContain("[\\fIOPTIONS\\fR]")
		})

		it("should include DESCRIPTION section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH DESCRIPTION")
			expect(manPage).toContain("AI-powered development assistant")
			expect(manPage).toContain("interactive")
			expect(manPage).toContain("batch modes")
		})

		it("should include OPTIONS section with categories", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH OPTIONS")
			expect(manPage).toContain('.SS "General Options"')
			expect(manPage).toContain('.SS "Agent Options"')
			expect(manPage).toContain('.SS "Output Options"')
			expect(manPage).toContain('.SS "Execution Options"')
			expect(manPage).toContain('.SS "Browser Options"')
			expect(manPage).toContain('.SS "MCP Options"')
		})

		it("should include COMMANDS section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH COMMANDS")
			expect(manPage).toContain(".B help")
			expect(manPage).toContain(".B config")
			expect(manPage).toContain(".B session")
			expect(manPage).toContain(".B mcp")
		})

		it("should include AGENT MODES section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH AGENT MODES")
			expect(manPage).toContain(".B code")
			expect(manPage).toContain(".B debug")
			expect(manPage).toContain(".B architect")
			expect(manPage).toContain(".B test")
		})

		it("should include EXAMPLES section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH EXAMPLES")
			expect(manPage).toContain("Start interactive mode:")
			expect(manPage).toContain("Run a single task:")
			expect(manPage).toContain("\\-\\-batch")
		})

		it("should include FILES section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH FILES")
			expect(manPage).toContain("~/.roo-cli/config.json")
			expect(manPage).toContain(".roo-cli.json")
			expect(manPage).toContain("User configuration file")
		})

		it("should include ENVIRONMENT section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH ENVIRONMENT")
			expect(manPage).toContain(".B ROO_API_KEY")
			expect(manPage).toContain(".B ROO_CONFIG_PATH")
			expect(manPage).toContain(".B ROO_MODEL")
		})

		it("should include EXIT STATUS section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH EXIT STATUS")
			expect(manPage).toContain(".B 0")
			expect(manPage).toContain("Success")
			expect(manPage).toContain(".B 1")
			expect(manPage).toContain("General error")
		})

		it("should include SEE ALSO section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH SEE ALSO")
			expect(manPage).toContain(".BR node (1)")
			expect(manPage).toContain(".BR npm (1)")
			expect(manPage).toContain("https://docs.roocode.com/cli")
		})

		it("should include BUGS section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH BUGS")
			expect(manPage).toContain("Report bugs at:")
			expect(manPage).toContain("github.com/roo-dev/roo/issues")
		})

		it("should include AUTHOR section", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".SH AUTHOR")
			expect(manPage).toContain("Roo Development Team")
		})
	})

	describe("writeManPage", () => {
		it("should write man page to specified file", async () => {
			const outputPath = "/tmp/roo-cli.1"

			await generator.writeManPage(outputPath)

			expect(mockWriteFile).toHaveBeenCalledWith(outputPath, expect.stringContaining(".TH ROO-CLI 1"), "utf8")
		})

		it("should generate valid man page content", async () => {
			const outputPath = "/tmp/roo-cli.1"

			await generator.writeManPage(outputPath)

			const writtenContent = mockWriteFile.mock.calls[0][1] as string

			// Check for proper man page structure
			expect(writtenContent).toMatch(/^\.TH ROO-CLI 1/)
			expect(writtenContent).toContain(".SH NAME")
			expect(writtenContent).toContain(".SH SYNOPSIS")
			expect(writtenContent).toContain(".SH DESCRIPTION")
		})
	})

	describe("generateManPageForInstallation", () => {
		it("should create output directory and write man page", async () => {
			const outputDir = "/usr/local/man/man1"
			const consoleSpy = jest.spyOn(console, "log").mockImplementation()

			await generator.generateManPageForInstallation(outputDir)

			expect(mockMkdir).toHaveBeenCalledWith(outputDir, { recursive: true })
			expect(mockWriteFile).toHaveBeenCalledWith(
				path.join(outputDir, "roo-cli.1"),
				expect.stringContaining(".TH ROO-CLI 1"),
				"utf8",
			)
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Man page generated:"))

			consoleSpy.mockRestore()
		})

		it("should provide installation instructions", async () => {
			const outputDir = "/usr/local/man/man1"
			const consoleSpy = jest.spyOn(console, "log").mockImplementation()

			await generator.generateManPageForInstallation(outputDir)

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("To install system-wide:"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("sudo cp"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("sudo mandb"))

			consoleSpy.mockRestore()
		})
	})

	describe("version handling", () => {
		it("should use version from package.json", () => {
			mockReadFileSync.mockReturnValue(JSON.stringify({ version: "2.0.0" }))
			const newGenerator = new ManPageGenerator()

			const manPage = newGenerator.generateManPage()
			expect(manPage).toContain("Roo CLI 2.0.0")
		})

		it("should fallback to default version when package.json is not readable", () => {
			mockReadFileSync.mockImplementation(() => {
				throw new Error("File not found")
			})

			const newGenerator = new ManPageGenerator()
			const manPage = newGenerator.generateManPage()

			expect(manPage).toContain("Roo CLI 1.0.0")
		})

		it("should handle invalid JSON in package.json", () => {
			mockReadFileSync.mockReturnValue("invalid json")

			const newGenerator = new ManPageGenerator()
			const manPage = newGenerator.generateManPage()

			expect(manPage).toContain("Roo CLI 1.0.0")
		})

		it("should handle missing version field in package.json", () => {
			mockReadFileSync.mockReturnValue(JSON.stringify({ name: "roo-cli" }))

			const newGenerator = new ManPageGenerator()
			const manPage = newGenerator.generateManPage()

			expect(manPage).toContain("Roo CLI 1.0.0")
		})
	})

	describe("date formatting", () => {
		it("should include current date in proper format", () => {
			const manPage = generator.generateManPage()

			// Check that date is in YYYY-MM-DD format
			const dateRegex = /\.TH ROO-CLI 1 "\d{4}-\d{2}-\d{2}"/
			expect(manPage).toMatch(dateRegex)
		})
	})

	describe("man page formatting", () => {
		it("should properly escape special characters", () => {
			const manPage = generator.generateManPage()

			// Check for proper escaping of dashes
			expect(manPage).toContain("\\-\\-help")
			expect(manPage).toContain("\\-\\-version")
			expect(manPage).toContain("\\-\\-config")
		})

		it("should use proper man page macros", () => {
			const manPage = generator.generateManPage()

			// Check for proper use of man page macros
			expect(manPage).toContain(".TH") // Title header
			expect(manPage).toContain(".SH") // Section header
			expect(manPage).toContain(".TP") // Tagged paragraph
			expect(manPage).toContain(".BR") // Bold and roman
			expect(manPage).toContain(".SS") // Subsection
		})

		it("should format options correctly", () => {
			const manPage = generator.generateManPage()

			// Check option formatting
			expect(manPage).toContain('.BR \\-h ", " \\-\\-help')
			expect(manPage).toContain('.BR \\-V ", " \\-\\-version')
			expect(manPage).toContain("\\fIOPTIONS\\fR")
			expect(manPage).toContain("\\fIFILE\\fR")
		})

		it("should include proper cross-references", () => {
			const manPage = generator.generateManPage()

			// Check for proper man page references
			expect(manPage).toContain(".BR node (1)")
			expect(manPage).toContain(".BR npm (1)")
			expect(manPage).toContain(".BR git (1)")
		})
	})

	describe("comprehensive content validation", () => {
		it("should include all required options", () => {
			const manPage = generator.generateManPage()

			// Check for key options
			expect(manPage).toContain("\\-\\-help")
			expect(manPage).toContain("\\-\\-version")
			expect(manPage).toContain("\\-\\-config")
			expect(manPage).toContain("\\-\\-batch")
			expect(manPage).toContain("\\-\\-format")
			expect(manPage).toContain("\\-\\-verbose")
			expect(manPage).toContain("\\-\\-headless")
			expect(manPage).toContain("\\-\\-mcp\\-config")
		})

		it("should include all environment variables", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain("ROO_API_KEY")
			expect(manPage).toContain("ROO_CONFIG_PATH")
			expect(manPage).toContain("ROO_MODEL")
			expect(manPage).toContain("ROO_MODE")
			expect(manPage).toContain("ROO_OUTPUT_FORMAT")
			expect(manPage).toContain("ROO_VERBOSE")
			expect(manPage).toContain("ROO_BROWSER_HEADLESS")
			expect(manPage).toContain("ROO_MCP_AUTO_CONNECT")
		})

		it("should include all exit codes", () => {
			const manPage = generator.generateManPage()

			expect(manPage).toContain(".B 0") // Success
			expect(manPage).toContain(".B 1") // General error
			expect(manPage).toContain(".B 2") // Configuration error
			expect(manPage).toContain(".B 3") // API error
			expect(manPage).toContain(".B 4") // File system error
			expect(manPage).toContain(".B 5") // Network error
			expect(manPage).toContain(".B 6") // Timeout error
			expect(manPage).toContain(".B 130") // Interrupted
		})
	})
})
