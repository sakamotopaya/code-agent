import * as path from "path"
import * as fs from "fs"

// Mock fs module
jest.mock("fs")
const mockFs = fs as jest.Mocked<typeof fs>

// Mock console.log to avoid noise in tests
const originalConsoleLog = console.log
beforeEach(() => {
	console.log = jest.fn()
})

afterEach(() => {
	console.log = originalConsoleLog
	jest.clearAllMocks()
	delete process.env.TREE_SITTER_WASM_DIR
})

// We need to mock the module to test the internal function
// Since getWasmDirectory is not exported, we'll test it indirectly through the module behavior
describe("WASM Directory Resolution", () => {
	describe("Environment Variable Override", () => {
		it("should use TREE_SITTER_WASM_DIR when set and valid", () => {
			const testWasmDir = "/custom/wasm/path"
			process.env.TREE_SITTER_WASM_DIR = testWasmDir

			// Mock fs.existsSync to return true for the tree-sitter.wasm file
			mockFs.existsSync.mockImplementation((filePath: fs.PathLike) => {
				return filePath === path.join(testWasmDir, "tree-sitter.wasm")
			})

			// Import the module after setting up mocks
			const languageParser = require("../languageParser")

			// The module should use the environment variable
			expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(testWasmDir, "tree-sitter.wasm"))
		})

		it("should throw error when TREE_SITTER_WASM_DIR points to invalid directory", () => {
			const invalidWasmDir = "/invalid/wasm/path"
			process.env.TREE_SITTER_WASM_DIR = invalidWasmDir

			// Mock fs.existsSync to return false for the tree-sitter.wasm file
			mockFs.existsSync.mockImplementation(() => false)

			// Import the module after setting up mocks
			expect(() => {
				require("../languageParser")
			}).toThrow(
				`TREE_SITTER_WASM_DIR points to invalid directory: ${invalidWasmDir}. tree-sitter.wasm not found.`,
			)
		})
	})

	describe("Context Detection Fallback", () => {
		beforeEach(() => {
			// Ensure environment variable is not set
			delete process.env.TREE_SITTER_WASM_DIR
		})

		it("should detect CLI context and go up one directory", () => {
			// Mock __dirname to simulate CLI context
			const originalDirname = __dirname
			Object.defineProperty(global, "__dirname", {
				value: "/app/src/dist/cli",
				writable: true,
			})

			// Mock fs.existsSync to avoid validation errors
			mockFs.existsSync.mockReturnValue(true)

			// Import the module after setting up mocks
			const languageParser = require("../languageParser")

			// Should log the context detection
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("Using WASM directory from context detection: /app/src/dist"),
			)

			// Restore original __dirname
			Object.defineProperty(global, "__dirname", {
				value: originalDirname,
				writable: true,
			})
		})

		it("should detect API context and go up one directory", () => {
			// Mock __dirname to simulate API context
			const originalDirname = __dirname
			Object.defineProperty(global, "__dirname", {
				value: "/app/src/dist/api",
				writable: true,
			})

			// Mock fs.existsSync to avoid validation errors
			mockFs.existsSync.mockReturnValue(true)

			// Import the module after setting up mocks
			const languageParser = require("../languageParser")

			// Should log the context detection
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("Using WASM directory from context detection: /app/src/dist"),
			)

			// Restore original __dirname
			Object.defineProperty(global, "__dirname", {
				value: originalDirname,
				writable: true,
			})
		})

		it("should use current directory for VSCode extension context", () => {
			// Mock __dirname to simulate VSCode extension context
			const originalDirname = __dirname
			Object.defineProperty(global, "__dirname", {
				value: "/app/src/dist",
				writable: true,
			})

			// Mock fs.existsSync to avoid validation errors
			mockFs.existsSync.mockReturnValue(true)

			// Import the module after setting up mocks
			const languageParser = require("../languageParser")

			// Should log the context detection
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("Using WASM directory from context detection: /app/src/dist"),
			)

			// Restore original __dirname
			Object.defineProperty(global, "__dirname", {
				value: originalDirname,
				writable: true,
			})
		})
	})

	describe("Windows Path Support", () => {
		it("should handle Windows CLI context", () => {
			// Mock __dirname to simulate Windows CLI context
			const originalDirname = __dirname
			Object.defineProperty(global, "__dirname", {
				value: "C:\\app\\src\\dist\\cli",
				writable: true,
			})

			// Mock fs.existsSync to avoid validation errors
			mockFs.existsSync.mockReturnValue(true)

			// Import the module after setting up mocks
			const languageParser = require("../languageParser")

			// Should detect Windows CLI context and go up one directory
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("Using WASM directory from context detection:"),
			)

			// Restore original __dirname
			Object.defineProperty(global, "__dirname", {
				value: originalDirname,
				writable: true,
			})
		})

		it("should handle Windows API context", () => {
			// Mock __dirname to simulate Windows API context
			const originalDirname = __dirname
			Object.defineProperty(global, "__dirname", {
				value: "C:\\app\\src\\dist\\api",
				writable: true,
			})

			// Mock fs.existsSync to avoid validation errors
			mockFs.existsSync.mockReturnValue(true)

			// Import the module after setting up mocks
			const languageParser = require("../languageParser")

			// Should detect Windows API context and go up one directory
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("Using WASM directory from context detection:"),
			)

			// Restore original __dirname
			Object.defineProperty(global, "__dirname", {
				value: originalDirname,
				writable: true,
			})
		})
	})
})
