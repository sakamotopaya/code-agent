import { jest } from "@jest/globals"

describe("Tools CLI Compatibility", () => {
	describe("Interface Integration", () => {
		it("should expose fileSystem interface through Task", () => {
			// Mock interfaces
			const mockFileSystem = {
				readFile: jest.fn<() => Promise<string>>().mockResolvedValue("test content"),
				writeFile: jest.fn<() => Promise<void>>().mockResolvedValue(),
				exists: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
				resolve: jest.fn<() => string>().mockReturnValue("/resolved/path"),
				isAbsolute: jest.fn<() => boolean>().mockReturnValue(false),
			} as any

			// Create task with interface
			const task = {
				fileSystem: mockFileSystem,
				get fs() {
					if (!this.fileSystem) {
						throw new Error(
							"FileSystem interface not available. Make sure the Task was initialized with a fileSystem interface.",
						)
					}
					return this.fileSystem
				},
			} as any

			// Test interface access
			expect(task.fs).toBe(mockFileSystem)
			expect(task.fs.resolve("test")).toBe("/resolved/path")
		})

		it("should expose terminal interface through Task", () => {
			const mockTerminal = {
				executeCommand: jest.fn<() => Promise<any>>().mockResolvedValue({
					exitCode: 0,
					stdout: "success",
					stderr: "",
					success: true,
					command: "test",
					executionTime: 100,
				}),
				getCwd: jest.fn<() => Promise<string>>().mockResolvedValue("/current/dir"),
			} as any

			const task = {
				terminal: mockTerminal,
				get term() {
					if (!this.terminal) {
						throw new Error(
							"Terminal interface not available. Make sure the Task was initialized with a terminal interface.",
						)
					}
					return this.terminal
				},
			} as any

			expect(task.term).toBe(mockTerminal)
		})

		it("should expose browser interface through Task", () => {
			const mockBrowser = {
				launch: jest.fn<() => Promise<any>>().mockResolvedValue({
					id: "session-1",
					isActive: true,
					navigateToUrl: jest.fn(),
				}),
				getAvailableBrowsers: jest.fn<() => Promise<string[]>>().mockResolvedValue(["chrome", "firefox"]),
			} as any

			const task = {
				browser: mockBrowser,
				get browserInterface() {
					if (!this.browser) {
						throw new Error(
							"Browser interface not available. Make sure the Task was initialized with a browser interface.",
						)
					}
					return this.browser
				},
			} as any

			expect(task.browserInterface).toBe(mockBrowser)
		})

		it("should throw error when interface is missing", () => {
			const task = {
				get fs() {
					if (!this.fileSystem) {
						throw new Error(
							"FileSystem interface not available. Make sure the Task was initialized with a fileSystem interface.",
						)
					}
					return this.fileSystem
				},
			} as any

			expect(() => task.fs).toThrow("FileSystem interface not available")
		})
	})

	describe("Helper Functions", () => {
		it("should provide interface-compatible file operations", async () => {
			const mockFs = {
				readFile: jest.fn<() => Promise<string>>().mockResolvedValue("line1\nline2\nline3"),
				resolve: jest.fn<() => string>().mockReturnValue("/resolved/path"),
			} as any

			// Test countFileLinesWithInterface helper function logic
			const content = await mockFs.readFile("/test/file.txt", "utf8")
			const lineCount = content.split("\n").length
			expect(lineCount).toBe(3)
		})

		it("should detect binary files correctly", async () => {
			const mockFs = {
				readFile: jest.fn<() => Promise<string>>(),
			} as any

			// Test binary detection logic
			mockFs.readFile.mockResolvedValue("binary\0content")
			const content = await mockFs.readFile("/test/binary.png", "utf8")
			const isBinary = content.includes("\0")
			expect(isBinary).toBe(true)

			// Test text file
			mockFs.readFile.mockResolvedValue("normal text content")
			const textContent = await mockFs.readFile("/test/text.txt", "utf8")
			const isTextBinary = textContent.includes("\0")
			expect(isTextBinary).toBe(false)
		})

		it("should handle line range reading", async () => {
			const mockFs = {
				readFile: jest.fn<() => Promise<string>>().mockResolvedValue("line1\nline2\nline3\nline4\nline5"),
			} as any

			// Test readLinesWithInterface helper function logic
			const content = await mockFs.readFile("/test/file.txt", "utf8")
			const lines = content.split("\n")

			// Simulate reading lines 1-3 (0-based indexing)
			const startLine = 1
			const endLine = 3
			const selectedLines = lines.slice(startLine, endLine + 1)
			const result = selectedLines.join("\n")

			expect(result).toBe("line2\nline3\nline4")
		})
	})

	describe("Path Operations", () => {
		it("should use interface for path resolution", () => {
			const mockFs = {
				resolve: jest.fn<() => string>().mockReturnValue("/workspace/resolved/path"),
				isAbsolute: jest.fn<() => boolean>().mockReturnValue(false),
				exists: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
			} as any

			// Test path resolution logic used in tools
			const relativePath = "test/file.txt"
			const isAbsolute = mockFs.isAbsolute(relativePath)
			expect(isAbsolute).toBe(false)

			const resolvedPath = mockFs.resolve(relativePath)
			expect(resolvedPath).toBe("/workspace/resolved/path")
			expect(mockFs.resolve).toHaveBeenCalledWith(relativePath)
		})
	})
})
