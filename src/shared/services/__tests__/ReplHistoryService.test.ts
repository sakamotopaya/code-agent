import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { ReplHistoryService } from "../ReplHistoryService"
import { HistoryEntry } from "../types/repl-history-types"

describe("ReplHistoryService", () => {
	let historyService: ReplHistoryService
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "repl-history-test-"))
		historyService = new ReplHistoryService({
			storageDir: tempDir,
			historyFile: "test-history.json",
			maxHistorySize: 5,
			context: "cli",
			deduplication: true,
			autoSave: false, // Disable for testing
		})
	})

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors in tests
		}
	})

	describe("initialization", () => {
		it("should initialize without existing history file", async () => {
			await historyService.initialize()
			const history = historyService.getHistory()
			expect(history).toEqual([])
		})

		it("should initialize with existing history file", async () => {
			// Create a pre-existing history file
			const historyData = {
				version: "1.0",
				context: "cli",
				maxSize: 5,
				created: new Date().toISOString(),
				lastModified: new Date().toISOString(),
				entries: [
					{
						command: "test command",
						timestamp: new Date().toISOString(),
						context: "cli",
					},
				],
			}

			const historyFile = path.join(tempDir, "test-history.json")
			await fs.writeFile(historyFile, JSON.stringify(historyData, null, 2))

			await historyService.initialize()
			const history = historyService.getHistory()
			expect(history).toHaveLength(1)
			expect(history[0].command).toBe("test command")
		})

		it("should handle corrupted history file gracefully", async () => {
			const historyFile = path.join(tempDir, "test-history.json")
			await fs.writeFile(historyFile, "invalid json content")

			await historyService.initialize()
			const history = historyService.getHistory()
			expect(history).toEqual([])
		})
	})

	describe("addEntry", () => {
		beforeEach(async () => {
			await historyService.initialize()
		})

		it("should add entries in reverse chronological order", async () => {
			const now = new Date()
			const earlier = new Date(now.getTime() - 1000)

			await historyService.addEntry("command1", { timestamp: earlier })
			await historyService.addEntry("command2", { timestamp: now })

			const history = historyService.getHistory()
			expect(history[0].command).toBe("command2")
			expect(history[1].command).toBe("command1")
		})

		it("should prune history when exceeding max size", async () => {
			for (let i = 1; i <= 7; i++) {
				await historyService.addEntry(`command${i}`)
			}

			const history = historyService.getHistory()
			expect(history).toHaveLength(5)
			expect(history[0].command).toBe("command7")
			expect(history[4].command).toBe("command3")
		})

		it("should deduplicate consecutive identical commands", async () => {
			await historyService.addEntry("same command")
			await historyService.addEntry("same command")
			await historyService.addEntry("different command")

			const history = historyService.getHistory()
			expect(history).toHaveLength(2)
			expect(history[0].command).toBe("different command")
			expect(history[1].command).toBe("same command")
		})

		it("should not deduplicate non-consecutive identical commands", async () => {
			await historyService.addEntry("command1")
			await historyService.addEntry("command2")
			await historyService.addEntry("command1")

			const history = historyService.getHistory()
			expect(history).toHaveLength(3)
			expect(history[0].command).toBe("command1")
			expect(history[1].command).toBe("command2")
			expect(history[2].command).toBe("command1")
		})

		it("should ignore empty or whitespace-only commands", async () => {
			await historyService.addEntry("")
			await historyService.addEntry("   ")
			await historyService.addEntry("\t\n")

			const history = historyService.getHistory()
			expect(history).toHaveLength(0)
		})

		it("should trim whitespace from commands", async () => {
			await historyService.addEntry("  test command  ")

			const history = historyService.getHistory()
			expect(history[0].command).toBe("test command")
		})
	})

	describe("getHistory", () => {
		beforeEach(async () => {
			await historyService.initialize()
			for (let i = 1; i <= 10; i++) {
				await historyService.addEntry(`command${i}`)
			}
		})

		it("should return all history when no limit specified", () => {
			const history = historyService.getHistory()
			expect(history).toHaveLength(5) // maxHistorySize is 5
		})

		it("should return limited history when limit specified", () => {
			const history = historyService.getHistory(3)
			expect(history).toHaveLength(3)
			expect(history[0].command).toBe("command10")
			expect(history[2].command).toBe("command8")
		})

		it("should return copies to prevent mutation", () => {
			const history = historyService.getHistory()
			const originalCommand = history[0].command

			history[0].command = "modified"

			const freshHistory = historyService.getHistory()
			expect(freshHistory[0].command).toBe(originalCommand)
		})
	})

	describe("persistence", () => {
		it("should save and load history correctly", async () => {
			await historyService.initialize()
			await historyService.addEntry("test command")
			await historyService.saveHistory()

			const newService = new ReplHistoryService({
				storageDir: tempDir,
				historyFile: "test-history.json",
				context: "cli",
			})

			await newService.initialize()
			const history = newService.getHistory()
			expect(history).toHaveLength(1)
			expect(history[0].command).toBe("test command")
		})

		it("should preserve timestamps correctly", async () => {
			await historyService.initialize()
			const testTime = new Date("2025-01-01T12:00:00Z")
			await historyService.addEntry("test command", { timestamp: testTime })
			await historyService.saveHistory()

			const newService = new ReplHistoryService({
				storageDir: tempDir,
				historyFile: "test-history.json",
				context: "cli",
			})

			await newService.initialize()
			const history = newService.getHistory()
			expect(history[0].timestamp).toEqual(testTime)
		})

		it("should create backup when encountering invalid format", async () => {
			const historyFile = path.join(tempDir, "test-history.json")
			await fs.writeFile(historyFile, "invalid json")

			await historyService.initialize()

			// Check if backup was created
			const backupDir = path.join(tempDir, "backups")
			const backupFiles = await fs.readdir(backupDir).catch(() => [])
			const hasBackup = backupFiles.some((file) => file.startsWith("repl-history-backup-"))
			expect(hasBackup).toBe(true)
		})
	})

	describe("clearHistory", () => {
		beforeEach(async () => {
			await historyService.initialize()
			await historyService.addEntry("command1")
			await historyService.addEntry("command2")
		})

		it("should clear all history entries", async () => {
			await historyService.clearHistory()
			const history = historyService.getHistory()
			expect(history).toHaveLength(0)
		})

		it("should mark service as dirty after clearing", async () => {
			await historyService.clearHistory()
			expect(historyService.isDirtyState()).toBe(true)
		})
	})

	describe("searchHistory", () => {
		beforeEach(async () => {
			await historyService.initialize()
			await historyService.addEntry("create todo app")
			await historyService.addEntry("list all tasks")
			await historyService.addEntry("delete completed tasks")
			await historyService.addEntry("update user settings")
		})

		it("should search by string pattern (case insensitive)", () => {
			const results = historyService.searchHistory("task")
			expect(results).toHaveLength(2)
			expect(results.some((r) => r.command.includes("tasks"))).toBe(true)
		})

		it("should search by regex pattern", () => {
			const results = historyService.searchHistory(/^create/)
			expect(results).toHaveLength(1)
			expect(results[0].command).toBe("create todo app")
		})

		it("should return empty array for no matches", () => {
			const results = historyService.searchHistory("nonexistent")
			expect(results).toHaveLength(0)
		})

		it("should return copies to prevent mutation", () => {
			const results = historyService.searchHistory("task")
			const originalCommand = results[0].command

			results[0].command = "modified"

			const freshResults = historyService.searchHistory("task")
			expect(freshResults[0].command).toBe(originalCommand)
		})
	})

	describe("getStatistics", () => {
		beforeEach(async () => {
			await historyService.initialize()
		})

		it("should return empty stats for no history", () => {
			const stats = historyService.getStatistics()
			expect(stats.totalEntries).toBe(0)
			expect(stats.uniqueCommands).toBe(0)
			expect(stats.mostUsedCommands).toEqual([])
			expect(stats.averageCommandLength).toBe(0)
		})

		it("should calculate correct statistics", async () => {
			await historyService.addEntry("short")
			await historyService.addEntry("medium command")
			await historyService.addEntry("short")
			await historyService.addEntry("this is a longer command")

			const stats = historyService.getStatistics()
			expect(stats.totalEntries).toBe(4)
			expect(stats.uniqueCommands).toBe(3)
			expect(stats.averageCommandLength).toBeCloseTo(13.25) // (5 + 14 + 5 + 24) / 4

			// Check most used commands
			expect(stats.mostUsedCommands[0].command).toBe("short")
			expect(stats.mostUsedCommands[0].count).toBe(2)
		})

		it("should include date range", async () => {
			const earlier = new Date("2025-01-01T10:00:00Z")
			const later = new Date("2025-01-01T11:00:00Z")

			await historyService.addEntry("first", { timestamp: earlier })
			await historyService.addEntry("second", { timestamp: later })

			const stats = historyService.getStatistics()
			expect(stats.oldestEntry).toEqual(earlier)
			expect(stats.newestEntry).toEqual(later)
		})
	})

	describe("file operations", () => {
		it("should create storage directory if it does not exist", async () => {
			const nestedDir = path.join(tempDir, "nested", "deep", "dir")
			const service = new ReplHistoryService({
				storageDir: nestedDir,
				historyFile: "test.json",
				context: "cli",
			})

			await service.initialize()
			await service.addEntry("test")
			await service.saveHistory()

			const historyFile = path.join(nestedDir, "test.json")
			const exists = await fs
				.access(historyFile)
				.then(() => true)
				.catch(() => false)
			expect(exists).toBe(true)
		})

		it("should handle file permission errors gracefully", async () => {
			// This test might not work on all systems, but it's good to have
			const service = new ReplHistoryService({
				storageDir: "/root/inaccessible", // Usually inaccessible directory
				historyFile: "test.json",
				context: "cli",
			})

			// Should not throw errors
			await service.initialize()
			await service.addEntry("test")
			// History should still be available in memory
			expect(service.getHistory()).toHaveLength(1)
		})
	})

	describe("configuration options", () => {
		it("should respect deduplication setting", async () => {
			const noDedupService = new ReplHistoryService({
				storageDir: tempDir,
				historyFile: "no-dedup.json",
				deduplication: false,
				context: "cli",
			})

			await noDedupService.initialize()
			await noDedupService.addEntry("same command")
			await noDedupService.addEntry("same command")

			const history = noDedupService.getHistory()
			expect(history).toHaveLength(2)
		})

		it("should use correct default values", () => {
			const defaultService = new ReplHistoryService()
			expect(defaultService.getHistoryFilePath()).toContain("default-repl-history.json")
			expect(defaultService.isDirtyState()).toBe(false)
		})
	})

	describe("edge cases", () => {
		beforeEach(async () => {
			await historyService.initialize()
		})

		it("should handle very long commands", async () => {
			const longCommand = "a".repeat(10000)
			await historyService.addEntry(longCommand)

			const history = historyService.getHistory()
			expect(history[0].command).toBe(longCommand)
		})

		it("should handle special characters in commands", async () => {
			const specialCommand = 'echo "Hello 世界" | grep -E "^[a-z]+$" && echo $?'
			await historyService.addEntry(specialCommand)

			const history = historyService.getHistory()
			expect(history[0].command).toBe(specialCommand)
		})

		it("should handle concurrent addEntry calls", async () => {
			const promises = []
			for (let i = 0; i < 10; i++) {
				promises.push(historyService.addEntry(`command${i}`))
			}

			await Promise.all(promises)
			const history = historyService.getHistory()
			expect(history).toHaveLength(5) // Limited by maxHistorySize
		})
	})

	describe("memory management", () => {
		it("should not leak memory with many operations", async () => {
			await historyService.initialize()

			// Add many entries to test memory usage
			for (let i = 0; i < 1000; i++) {
				await historyService.addEntry(`command${i}`)
			}

			// Should only keep maxHistorySize entries
			const history = historyService.getHistory()
			expect(history).toHaveLength(5)
		})
	})
})
