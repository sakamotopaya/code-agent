import { ApiTerminal } from "../ApiTerminal"
import { CommandResult, ExecuteCommandOptions } from "../../../interfaces/ITerminal"

// Mock the executeCommand method
class TestApiTerminal extends ApiTerminal {
	private mockResult: CommandResult = {
		exitCode: 0,
		stdout: "",
		stderr: "",
		success: true,
		command: "",
		executionTime: 0,
	}

	setMockResult(result: Partial<CommandResult>) {
		this.mockResult = { ...this.mockResult, ...result }
	}

	override async executeCommand(command: string, options?: ExecuteCommandOptions): Promise<CommandResult> {
		return { ...this.mockResult, command }
	}
}

describe("ApiTerminal", () => {
	let terminal: TestApiTerminal

	beforeEach(() => {
		terminal = new TestApiTerminal()
	})

	describe("getProcesses", () => {
		it("should parse Unix/Linux ps aux output correctly", async () => {
			const mockOutput = `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1  77616  8604 ?        Ss   Dec07   0:01 /sbin/init
root         2  0.0  0.0      0     0 ?        S    Dec07   0:00 [kthreadd]
user      1234  1.2  2.3 123456  7890 pts/0    R+   10:30   0:05 node server.js
user      5678  0.5  1.1  98765  4321 pts/1    S    10:25   0:02 vim file.txt`

			terminal.setMockResult({
				success: true,
				stdout: mockOutput,
				exitCode: 0,
			})

			// Mock process.platform for Unix-like systems
			const originalPlatform = process.platform
			Object.defineProperty(process, "platform", { value: "linux" })

			const processes = await terminal.getProcesses()

			// Restore original platform
			Object.defineProperty(process, "platform", { value: originalPlatform })

			expect(processes).toHaveLength(4)
			expect(processes[0]).toEqual({
				pid: 1,
				name: "root",
				cmd: "root         1  0.0  0.1  77616  8604 ?        Ss   Dec07   0:01 /sbin/init",
			})
			expect(processes[1]).toEqual({
				pid: 2,
				name: "root",
				cmd: "root         2  0.0  0.0      0     0 ?        S    Dec07   0:00 [kthreadd]",
			})
			expect(processes[2]).toEqual({
				pid: 1234,
				name: "user",
				cmd: "user      1234  1.2  2.3 123456  7890 pts/0    R+   10:30   0:05 node server.js",
			})
		})

		it("should parse Windows tasklist CSV output correctly", async () => {
			const mockOutput = `"Image Name","PID","Session Name","Session#","Mem Usage"
"System Idle Process","0","Services","0","24 K"
"System","4","Services","0","7,428 K"
"notepad.exe","1234","Console","1","15,432 K"
"chrome.exe","5678","Console","1","123,456 K"`

			terminal.setMockResult({
				success: true,
				stdout: mockOutput,
				exitCode: 0,
			})

			// Mock process.platform for Windows
			const originalPlatform = process.platform
			Object.defineProperty(process, "platform", { value: "win32" })

			const processes = await terminal.getProcesses()

			// Restore original platform
			Object.defineProperty(process, "platform", { value: originalPlatform })

			expect(processes).toHaveLength(4)
			expect(processes[0]).toEqual({
				pid: 0,
				name: "System Idle Process",
				cmd: `"System Idle Process","0","Services","0","24 K"`,
			})
			expect(processes[1]).toEqual({
				pid: 4,
				name: "System",
				cmd: `"System","4","Services","0","7,428 K"`,
			})
			expect(processes[2]).toEqual({
				pid: 1234,
				name: "notepad.exe",
				cmd: `"notepad.exe","1234","Console","1","15,432 K"`,
			})
		})

		it("should handle Windows CSV fallback parsing", async () => {
			const mockOutput = `Image Name,PID,Session Name,Session#,Mem Usage
System Idle Process,0,Services,0,24 K
notepad.exe,1234,Console,1,15432 K`

			terminal.setMockResult({
				success: true,
				stdout: mockOutput,
				exitCode: 0,
			})

			const originalPlatform = process.platform
			Object.defineProperty(process, "platform", { value: "win32" })

			const processes = await terminal.getProcesses()

			Object.defineProperty(process, "platform", { value: originalPlatform })

			expect(processes).toHaveLength(2)
			expect(processes[0]).toEqual({
				pid: 0,
				name: "System Idle Process",
				cmd: "System Idle Process,0,Services,0,24 K",
			})
			expect(processes[1]).toEqual({
				pid: 1234,
				name: "notepad.exe",
				cmd: "notepad.exe,1234,Console,1,15432 K",
			})
		})

		it("should filter processes by name when filter is provided", async () => {
			const mockOutput = `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1  77616  8604 ?        Ss   Dec07   0:01 /sbin/init
user      1234  1.2  2.3 123456  7890 pts/0    R+   10:30   0:05 node server.js
user      5678  0.5  1.1  98765  4321 pts/1    S    10:25   0:02 vim file.txt`

			terminal.setMockResult({
				success: true,
				stdout: mockOutput,
				exitCode: 0,
			})

			const processes = await terminal.getProcesses("node")

			expect(processes).toHaveLength(1)
			expect(processes[0].pid).toBe(1234)
			expect(processes[0].name).toBe("user")
		})

		it("should skip lines with invalid PIDs", async () => {
			const mockOutput = `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root       abc  0.0  0.1  77616  8604 ?        Ss   Dec07   0:01 /sbin/init
user      1234  1.2  2.3 123456  7890 pts/0    R+   10:30   0:05 node server.js`

			terminal.setMockResult({
				success: true,
				stdout: mockOutput,
				exitCode: 0,
			})

			const processes = await terminal.getProcesses()

			expect(processes).toHaveLength(1)
			expect(processes[0].pid).toBe(1234)
		})

		it("should return empty array when command fails", async () => {
			terminal.setMockResult({
				success: false,
				stderr: "Command not found",
				exitCode: 1,
			})

			const processes = await terminal.getProcesses()

			expect(processes).toHaveLength(0)
		})

		it("should limit to 50 processes", async () => {
			// Generate 60 lines of mock output
			let mockOutput = "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n"
			for (let i = 1; i <= 60; i++) {
				mockOutput += `user      ${i.toString().padStart(4, " ")}  0.0  0.1  12345  6789 ?        S    Dec07   0:00 process${i}\n`
			}

			terminal.setMockResult({
				success: true,
				stdout: mockOutput,
				exitCode: 0,
			})

			const processes = await terminal.getProcesses()

			expect(processes).toHaveLength(49) // 50 processes - 1 (header line is skipped)
		})
	})
})
