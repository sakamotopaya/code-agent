import { describe, it, expect, jest } from "@jest/globals"
import { validateTaskId, parseCommandLineArgs } from "../api-client"

// Mock the ReplHistoryService to avoid file system dependencies in tests
jest.mock("../../shared/services/ReplHistoryService", () => ({
	ReplHistoryService: jest.fn().mockImplementation(() => ({
		initialize: jest.fn(),
		addEntry: jest.fn(),
		getHistory: jest.fn(() => []),
		clearHistory: jest.fn(),
		searchHistory: jest.fn(() => []),
		getStatistics: jest.fn(() => ({
			totalEntries: 0,
			uniqueCommands: 0,
			mostUsedCommands: [],
			averageCommandLength: 0,
		})),
		flush: jest.fn(),
	})),
}))

jest.mock("../../shared/paths", () => ({
	getGlobalStoragePath: jest.fn(() => "/tmp/test-storage"),
}))

describe("API Client TypeScript Implementation", () => {
	describe("validateTaskId", () => {
		it("should validate correct UUID format", () => {
			const validUuid = "abc123-def456-ghi789-jkl012-mno345"
			expect(validateTaskId(validUuid.replace(/-/g, ""))).toBe(false) // Missing hyphens

			const properUuid = "abc12345-def4-5678-9012-mno345678901"
			expect(validateTaskId(properUuid)).toBe(true)
		})

		it("should reject invalid UUID format", () => {
			expect(validateTaskId("invalid-id")).toBe(false)
			expect(validateTaskId("123")).toBe(false)
			expect(validateTaskId("")).toBe(false)
		})
	})

	describe("parseCommandLineArgs", () => {
		const originalArgv = process.argv

		afterEach(() => {
			process.argv = originalArgv
		})

		it("should parse basic options correctly", () => {
			process.argv = ["node", "api-client.js", "--stream", "--mode", "architect", "test task"]

			const result = parseCommandLineArgs()

			expect(result.options.useStream).toBe(true)
			expect(result.options.mode).toBe("architect")
			expect(result.task).toBe("test task")
			expect(result.showHelp).toBe(false)
		})

		it("should handle help flag", () => {
			process.argv = ["node", "api-client.js", "--help"]

			const result = parseCommandLineArgs()

			expect(result.showHelp).toBe(true)
		})

		it("should handle REPL mode flag", () => {
			process.argv = ["node", "api-client.js", "--repl"]

			const result = parseCommandLineArgs()

			expect(result.options.replMode).toBe(true)
		})

		it("should handle task restart with valid UUID", () => {
			const validUuid = "abc12345-def4-5678-9012-mno345678901"
			process.argv = ["node", "api-client.js", "--task", validUuid]

			const result = parseCommandLineArgs()

			expect(result.options.task).toBe(validUuid)
			expect(result.options.restartTask).toBe(true)
		})
	})

	describe("History Service Integration", () => {
		it("should be able to import ReplHistoryService without errors", () => {
			// This test verifies that the TypeScript import works correctly
			expect(() => {
				const { ReplHistoryService } = require("../../shared/services/ReplHistoryService")
				expect(ReplHistoryService).toBeDefined()
			}).not.toThrow()
		})
	})
})
