// Mock implementation of execa for testing
const mockExeca = jest.fn().mockResolvedValue({
	stdout: "",
	stderr: "",
	exitCode: 0,
	command: "",
	escapedCommand: "",
	failed: false,
	timedOut: false,
	isCanceled: false,
	killed: false,
})

class MockExecaError extends Error {
	constructor(message, result) {
		super(message)
		this.name = "ExecaError"
		this.exitCode = result?.exitCode || 1
		this.stdout = result?.stdout || ""
		this.stderr = result?.stderr || ""
		this.failed = true
		this.command = result?.command || ""
		this.escapedCommand = result?.escapedCommand || ""
		this.timedOut = result?.timedOut || false
		this.isCanceled = result?.isCanceled || false
		this.killed = result?.killed || false
	}
}

module.exports = {
	execa: mockExeca,
	ExecaError: MockExecaError,
	__esModule: true,
	default: mockExeca,
}
