import { ReplHistoryService } from "../../shared/services/ReplHistoryService"
import * as readline from "readline"
import { getGlobalStoragePath } from "../../shared/paths"
import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"

describe("API Client REPL History Fix", () => {
	let tempDir: string
	let historyService: ReplHistoryService

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-client-history-test-"))
		historyService = new ReplHistoryService({
			storageDir: tempDir,
			context: "api-client",
			maxHistorySize: 100,
			deduplication: true,
			autoSave: true,
		})
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("should load history in correct order for up arrow navigation", async () => {
		// Initialize and add some test commands
		await historyService.initialize()
		await historyService.addEntry("first command")
		await historyService.addEntry("second command")
		await historyService.addEntry("third command")

		// Get history as the API client would
		const history = historyService.getHistory(50)

		// Extract commands as the API client does
		const commands = history.map((entry) => entry.command)

		// Verify that newest command is first (what we want for up arrow)
		expect(commands[0]).toBe("third command")
		expect(commands[1]).toBe("second command")
		expect(commands[2]).toBe("first command")

		// Simulate what the API client does - directly assign to readline history
		// This should NOT be reversed since ReplHistoryService already returns newest first
		const mockReadlineHistory = commands

		// When user presses up arrow, they should get the most recent command first
		expect(mockReadlineHistory[0]).toBe("third command")
		expect(mockReadlineHistory[1]).toBe("second command")
		expect(mockReadlineHistory[2]).toBe("first command")
	})

	it("should verify ReplHistoryService returns newest first", async () => {
		await historyService.initialize()

		// Add commands with specific timestamps to be sure
		const now = new Date()
		await historyService.addEntry("oldest", { timestamp: new Date(now.getTime() - 3000) })
		await historyService.addEntry("middle", { timestamp: new Date(now.getTime() - 2000) })
		await historyService.addEntry("newest", { timestamp: new Date(now.getTime() - 1000) })

		const history = historyService.getHistory()

		// Should be in reverse chronological order (newest first)
		expect(history[0].command).toBe("newest")
		expect(history[1].command).toBe("middle")
		expect(history[2].command).toBe("oldest")

		// Verify timestamps are actually in descending order
		expect(history[0].timestamp.getTime()).toBeGreaterThan(history[1].timestamp.getTime())
		expect(history[1].timestamp.getTime()).toBeGreaterThan(history[2].timestamp.getTime())
	})

	it("should handle empty history gracefully", async () => {
		await historyService.initialize()

		const history = historyService.getHistory(50)
		const commands = history.map((entry) => entry.command)

		expect(commands).toEqual([])
	})

	it("should handle single command correctly", async () => {
		await historyService.initialize()
		await historyService.addEntry("only command")

		const history = historyService.getHistory(50)
		const commands = history.map((entry) => entry.command)

		expect(commands).toEqual(["only command"])
	})
})
