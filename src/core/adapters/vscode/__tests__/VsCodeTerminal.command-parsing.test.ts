import * as vscode from "vscode"
import { VsCodeTerminal } from "../VsCodeTerminal"

// Mock VS Code
jest.mock("vscode", () => ({
	ExtensionContext: jest.fn(),
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/mock/workspace" },
			},
		],
	},
	window: {
		onDidCloseTerminal: jest.fn(),
	},
}))

describe("VsCodeTerminal Command Parsing", () => {
	let terminal: VsCodeTerminal
	let mockContext: vscode.ExtensionContext

	beforeEach(() => {
		mockContext = {} as vscode.ExtensionContext
		terminal = new VsCodeTerminal(mockContext)
	})

	it("should parse simple commands correctly", () => {
		// Access the private method for testing
		const parseCommand = (terminal as any).parseCommand.bind(terminal)

		const result = parseCommand("echo hello")
		expect(result.executable).toBe("echo")
		expect(result.args).toEqual(["hello"])
	})

	it("should parse commands with quoted arguments", () => {
		const parseCommand = (terminal as any).parseCommand.bind(terminal)

		const result = parseCommand('echo "hello world"')
		expect(result.executable).toBe("echo")
		expect(result.args).toEqual(["hello world"])
	})

	it("should parse commands with single quotes", () => {
		const parseCommand = (terminal as any).parseCommand.bind(terminal)

		const result = parseCommand("echo 'hello world'")
		expect(result.executable).toBe("echo")
		expect(result.args).toEqual(["hello world"])
	})

	it("should parse commands with multiple arguments", () => {
		const parseCommand = (terminal as any).parseCommand.bind(terminal)

		const result = parseCommand("git commit -m 'Initial commit'")
		expect(result.executable).toBe("git")
		expect(result.args).toEqual(["commit", "-m", "Initial commit"])
	})

	it("should handle commands with no arguments", () => {
		const parseCommand = (terminal as any).parseCommand.bind(terminal)

		const result = parseCommand("ls")
		expect(result.executable).toBe("ls")
		expect(result.args).toEqual([])
	})

	it("should handle empty command", () => {
		const parseCommand = (terminal as any).parseCommand.bind(terminal)

		const result = parseCommand("")
		expect(result.executable).toBe("")
		expect(result.args).toEqual([])
	})
})
