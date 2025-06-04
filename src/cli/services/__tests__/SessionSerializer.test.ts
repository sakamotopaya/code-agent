import { SessionSerializer } from "../SessionSerializer"
import { SessionStatus, SESSION_FORMAT_VERSION } from "../../types/session-types"
import type { Session } from "../../types/session-types"

describe("SessionSerializer", () => {
	let serializer: SessionSerializer
	let mockSession: Session

	beforeEach(() => {
		serializer = new SessionSerializer()

		mockSession = {
			id: "test-session-id",
			name: "Test Session",
			description: "Test session description",
			metadata: {
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: new Date("2024-01-01T01:00:00Z"),
				lastAccessedAt: new Date("2024-01-01T02:00:00Z"),
				version: SESSION_FORMAT_VERSION,
				tags: ["test", "demo"],
				duration: 3600000,
				commandCount: 5,
				status: SessionStatus.ACTIVE,
			},
			state: {
				workingDirectory: "/test/project",
				environment: { NODE_ENV: "test", API_KEY: "secret-key" },
				activeProcesses: [],
				openFiles: ["test.js"],
				watchedFiles: [],
				mcpConnections: [],
			},
			history: {
				messages: [
					{
						id: "msg-1",
						timestamp: new Date("2024-01-01T00:30:00Z"),
						role: "user",
						content: "Create a test function",
					},
					{
						id: "msg-2",
						timestamp: new Date("2024-01-01T00:45:00Z"),
						role: "assistant",
						content: "I'll help you create a test function.",
					},
				],
				context: {
					workspaceRoot: "/test/project",
					activeFiles: ["test.js"],
					environmentVariables: { NODE_ENV: "test" },
				},
				checkpoints: [
					{
						id: "checkpoint-1",
						timestamp: new Date("2024-01-01T00:40:00Z"),
						description: "After creating function",
						messageIndex: 1,
						state: {
							workingDirectory: "/test/project",
							environment: { NODE_ENV: "test" },
							activeProcesses: [],
							openFiles: ["test.js"],
							watchedFiles: [],
							mcpConnections: [],
						},
					},
				],
			},
			tools: [
				{
					toolName: "code_editor",
					configuration: { theme: "dark" },
					cache: { lastUsedFiles: ["test.js"] },
					lastUsed: new Date("2024-01-01T00:35:00Z"),
					usageCount: 3,
					results: [
						{
							timestamp: new Date("2024-01-01T00:35:00Z"),
							input: { action: "create_file", file: "test.js" },
							output: { success: true },
							success: true,
						},
					],
				},
			],
			files: {
				watchedDirectories: ["/test/project"],
				ignoredPatterns: [".git", "node_modules"],
				lastScanTime: new Date("2024-01-01T00:00:00Z"),
				fileChecksums: { "test.js": "abc123" },
			},
			config: {
				autoSave: true,
				autoSaveInterval: 5,
				maxHistoryLength: 1000,
				compressionEnabled: false,
				encryptionEnabled: false,
				retentionDays: 30,
				maxSessionSize: 100,
			},
		}
	})

	describe("serialize", () => {
		it("should serialize session to JSON string", async () => {
			const result = await serializer.serialize(mockSession)

			expect(typeof result).toBe("string")
			const parsed = JSON.parse(result)
			expect(parsed.id).toBe(mockSession.id)
			expect(parsed.name).toBe(mockSession.name)
		})

		it("should remove sensitive data during serialization", async () => {
			const result = await serializer.serialize(mockSession)
			const parsed = JSON.parse(result)

			// Should not contain API keys
			expect(parsed.config).not.toHaveProperty("apiKey")
			expect(parsed.config).not.toHaveProperty("encryptionKey")

			// Should not contain sensitive environment variables
			expect(parsed.state.environment).not.toHaveProperty("API_KEY")
			expect(parsed.state.environment).toHaveProperty("NODE_ENV")
		})

		it("should clear cache data to reduce size", async () => {
			const result = await serializer.serialize(mockSession)
			const parsed = JSON.parse(result)

			expect(parsed.tools[0].cache).toEqual({})
		})

		it("should limit tool results to last 10", async () => {
			// Add more than 10 results
			const manyResults = Array.from({ length: 15 }, (_, i) => ({
				timestamp: new Date(),
				input: { action: `action-${i}` },
				output: { success: true },
				success: true,
			}))

			mockSession.tools[0].results = manyResults

			const result = await serializer.serialize(mockSession)
			const parsed = JSON.parse(result)

			expect(parsed.tools[0].results).toHaveLength(10)
		})

		it("should limit message history to 1000 messages", async () => {
			// Create more than 1000 messages
			const manyMessages = Array.from({ length: 1500 }, (_, i) => ({
				id: `msg-${i}`,
				timestamp: new Date(),
				role: "user" as const,
				content: `Message ${i}`,
			}))

			mockSession.history.messages = manyMessages

			const result = await serializer.serialize(mockSession)
			const parsed = JSON.parse(result)

			expect(parsed.history.messages).toHaveLength(1000)
			// Should keep the last 1000 messages
			expect(parsed.history.messages[0].content).toBe("Message 500")
			expect(parsed.history.messages[999].content).toBe("Message 1499")
		})
	})

	describe("deserialize", () => {
		it("should deserialize JSON string to session object", async () => {
			const serialized = await serializer.serialize(mockSession)
			const result = await serializer.deserialize(serialized)

			expect(result.id).toBe(mockSession.id)
			expect(result.name).toBe(mockSession.name)
			expect(result.metadata.createdAt).toBeInstanceOf(Date)
			expect(result.history.messages[0].timestamp).toBeInstanceOf(Date)
		})

		it("should convert date strings back to Date objects", async () => {
			const serialized = await serializer.serialize(mockSession)
			const result = await serializer.deserialize(serialized)

			expect(result.metadata.createdAt).toBeInstanceOf(Date)
			expect(result.metadata.updatedAt).toBeInstanceOf(Date)
			expect(result.metadata.lastAccessedAt).toBeInstanceOf(Date)
			expect(result.history.messages[0].timestamp).toBeInstanceOf(Date)
			expect(result.history.checkpoints[0].timestamp).toBeInstanceOf(Date)
			expect(result.tools[0].lastUsed).toBeInstanceOf(Date)
			expect(result.files.lastScanTime).toBeInstanceOf(Date)
		})

		it("should throw error for invalid JSON", async () => {
			await expect(serializer.deserialize("invalid json")).rejects.toThrow("Failed to deserialize session")
		})

		it("should throw error if validation fails", async () => {
			const invalidSession = { id: "", name: "" } // Missing required fields

			await expect(serializer.deserialize(JSON.stringify(invalidSession))).rejects.toThrow(
				"Session validation failed",
			)
		})
	})

	describe("sanitizeSession", () => {
		it("should remove sensitive configuration data", () => {
			const result = serializer.sanitizeSession(mockSession)

			expect(result.config).not.toHaveProperty("apiKey")
			expect(result.config).not.toHaveProperty("encryptionKey")
		})

		it("should remove sensitive environment variables", () => {
			const result = serializer.sanitizeSession(mockSession)

			expect(result.state.environment).not.toHaveProperty("API_KEY")
			expect(result.state.environment).toHaveProperty("NODE_ENV")
		})

		it("should clear tool cache", () => {
			const result = serializer.sanitizeSession(mockSession)

			expect(result.tools[0].cache).toEqual({})
		})

		it("should not modify original session", () => {
			const originalName = mockSession.name
			serializer.sanitizeSession(mockSession)

			expect(mockSession.name).toBe(originalName)
		})
	})

	describe("validateSession", () => {
		it("should validate correct session", () => {
			const result = serializer.validateSession(mockSession)

			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it("should detect missing required fields", () => {
			const invalidSession = { ...mockSession, id: "" }
			const result = serializer.validateSession(invalidSession)

			expect(result.valid).toBe(false)
			expect(result.errors).toContain("Session ID is required")
		})

		it("should detect invalid session status", () => {
			const invalidSession = {
				...mockSession,
				metadata: { ...mockSession.metadata, status: "invalid" as any },
			}
			const result = serializer.validateSession(invalidSession)

			expect(result.valid).toBe(false)
			expect(result.errors).toContain("Invalid session status: invalid")
		})

		it("should generate warnings for large sessions", () => {
			const largeSession = {
				...mockSession,
				history: {
					...mockSession.history,
					messages: Array.from({ length: 1500 }, (_, i) => ({
						id: `msg-${i}`,
						timestamp: new Date(),
						role: "user" as const,
						content: `Message ${i}`,
					})),
				},
			}

			const result = serializer.validateSession(largeSession)

			expect(result.warnings).toContain("Large number of messages: 1500")
		})

		it("should validate message structure", () => {
			const sessionWithInvalidMessage = {
				...mockSession,
				history: {
					...mockSession.history,
					messages: [
						{
							id: "",
							timestamp: new Date(),
							role: "invalid-role" as any,
							content: "Test message",
						},
					],
				},
			}

			const result = serializer.validateSession(sessionWithInvalidMessage)

			expect(result.warnings).toContain("Message at index 0 missing ID")
			expect(result.warnings).toContain("Message at index 0 has invalid role: invalid-role")
		})

		it("should validate tool structure", () => {
			const sessionWithInvalidTool = {
				...mockSession,
				tools: [
					{
						toolName: "",
						configuration: {},
						cache: {},
						lastUsed: null as any,
						usageCount: 0,
						results: [],
					},
				],
			}

			const result = serializer.validateSession(sessionWithInvalidTool)

			expect(result.warnings).toContain("Tool at index 0 missing name")
			expect(result.warnings).toContain("Tool at index 0 missing last used timestamp")
		})

		it("should warn about very large session size", () => {
			// Create a session that would be very large when serialized
			const largeContent = "x".repeat(60 * 1024 * 1024) // 60MB of content
			const largeSession = {
				...mockSession,
				description: largeContent,
			}

			const result = serializer.validateSession(largeSession)

			expect(result.warnings.some((w) => w.includes("Session size is very large"))).toBe(true)
		})
	})
})
