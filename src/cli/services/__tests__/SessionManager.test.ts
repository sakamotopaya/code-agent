import { SessionManager } from "../SessionManager"
import { SessionStorage } from "../SessionStorage"
import { SessionStatus, SESSION_FORMAT_VERSION } from "../../types/session-types"
import type { Session } from "../../types/session-types"

jest.mock("../SessionStorage")
jest.mock("uuid", () => ({
	v4: jest.fn(() => "mock-uuid"),
}))

const MockedSessionStorage = SessionStorage as jest.MockedClass<typeof SessionStorage>

describe("SessionManager", () => {
	let sessionManager: SessionManager
	let mockStorage: jest.Mocked<SessionStorage>

	beforeEach(() => {
		MockedSessionStorage.mockClear()
		sessionManager = new SessionManager()
		mockStorage = MockedSessionStorage.mock.instances[0] as jest.Mocked<SessionStorage>

		// Mock all storage methods
		mockStorage.initialize = jest.fn()
		mockStorage.saveSession = jest.fn()
		mockStorage.loadSession = jest.fn()
		mockStorage.deleteSession = jest.fn()
		mockStorage.listSessions = jest.fn()
		mockStorage.exists = jest.fn()
		mockStorage.getSessionSize = jest.fn()
	})

	afterEach(() => {
		// Clean up any timers or async operations
		sessionManager.destroy()
	})

	describe("initialization", () => {
		it("should initialize storage", async () => {
			await sessionManager.initialize()

			expect(mockStorage.initialize).toHaveBeenCalled()
		})
	})

	describe("session lifecycle", () => {
		describe("createSession", () => {
			it("should create a new session with default name", async () => {
				const session = await sessionManager.createSession()

				expect(session.id).toBe("mock-uuid")
				expect(session.name).toMatch(/Session \d{4}-\d{2}-\d{2}/)
				expect(session.metadata.status).toBe(SessionStatus.ACTIVE)
				expect(session.metadata.version).toBe(SESSION_FORMAT_VERSION)
				expect(mockStorage.saveSession).toHaveBeenCalledWith(session)
			})

			it("should create a session with custom name and description", async () => {
				const name = "My Test Session"
				const description = "This is a test session"

				const session = await sessionManager.createSession(name, description)

				expect(session.name).toBe(name)
				expect(session.description).toBe(description)
				expect(mockStorage.saveSession).toHaveBeenCalledWith(session)
			})

			it("should set current working directory in session state", async () => {
				const originalCwd = process.cwd()
				const session = await sessionManager.createSession()

				expect(session.state.workingDirectory).toBe(originalCwd)
			})

			it("should sanitize environment variables", async () => {
				const originalEnv = process.env
				process.env = {
					...originalEnv,
					API_KEY: "secret-key",
					PUBLIC_VAR: "public-value",
				}

				const session = await sessionManager.createSession()

				expect(session.state.environment).not.toHaveProperty("API_KEY")
				expect(session.state.environment).toHaveProperty("PUBLIC_VAR")

				process.env = originalEnv
			})
		})

		describe("saveSession", () => {
			it("should save active session", async () => {
				const session = await sessionManager.createSession()
				const originalUpdatedAt = session.metadata.updatedAt

				// Wait a bit to ensure timestamp changes
				await new Promise((resolve) => setTimeout(resolve, 1))

				await sessionManager.saveSession(session.id)

				expect(mockStorage.saveSession).toHaveBeenCalledTimes(2) // Once for create, once for save
				const savedSession = mockStorage.saveSession.mock.calls[1][0]
				expect(savedSession.metadata.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
			})

			it("should load and save non-active session", async () => {
				const mockSession: Session = {
					id: "other-session",
					name: "Other Session",
					metadata: {
						createdAt: new Date(),
						updatedAt: new Date(),
						lastAccessedAt: new Date(),
						version: SESSION_FORMAT_VERSION,
						tags: [],
						duration: 0,
						commandCount: 0,
						status: SessionStatus.ACTIVE,
					},
					state: {
						workingDirectory: "/test",
						environment: {},
						activeProcesses: [],
						openFiles: [],
						watchedFiles: [],
						mcpConnections: [],
					},
					history: {
						messages: [],
						context: { workspaceRoot: "/test", activeFiles: [], environmentVariables: {} },
						checkpoints: [],
					},
					tools: [],
					files: { watchedDirectories: [], ignoredPatterns: [], lastScanTime: new Date(), fileChecksums: {} },
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

				mockStorage.loadSession.mockResolvedValue(mockSession)

				await sessionManager.saveSession("other-session")

				expect(mockStorage.loadSession).toHaveBeenCalledWith("other-session")
				expect(mockStorage.saveSession).toHaveBeenCalledWith(mockSession)
			})
		})

		describe("loadSession", () => {
			it("should load session and set as active", async () => {
				const mockSession: Session = {
					id: "test-session",
					name: "Test Session",
					metadata: {
						createdAt: new Date(),
						updatedAt: new Date(),
						lastAccessedAt: new Date(),
						version: SESSION_FORMAT_VERSION,
						tags: [],
						duration: 0,
						commandCount: 0,
						status: SessionStatus.ACTIVE,
					},
					state: {
						workingDirectory: "/test",
						environment: {},
						activeProcesses: [],
						openFiles: [],
						watchedFiles: [],
						mcpConnections: [],
					},
					history: {
						messages: [],
						context: { workspaceRoot: "/test", activeFiles: [], environmentVariables: {} },
						checkpoints: [],
					},
					tools: [],
					files: { watchedDirectories: [], ignoredPatterns: [], lastScanTime: new Date(), fileChecksums: {} },
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

				mockStorage.loadSession.mockResolvedValue(mockSession)

				const loadedSession = await sessionManager.loadSession("test-session")

				expect(loadedSession).toBe(mockSession)
				expect(sessionManager.getActiveSession()).toBe(mockSession)
				expect(mockStorage.loadSession).toHaveBeenCalledWith("test-session")
			})
		})

		describe("deleteSession", () => {
			it("should delete session from storage", async () => {
				await sessionManager.deleteSession("test-session")

				expect(mockStorage.deleteSession).toHaveBeenCalledWith("test-session")
			})

			it("should clear active session if deleted", async () => {
				const session = await sessionManager.createSession()

				await sessionManager.deleteSession(session.id)

				expect(sessionManager.getActiveSession()).toBeNull()
			})
		})
	})

	describe("session management", () => {
		describe("addMessage", () => {
			it("should add message to active session", async () => {
				const session = await sessionManager.createSession()
				const content = "Test message"
				const role = "user"

				await sessionManager.addMessage(content, role)

				expect(session.history.messages).toHaveLength(1)
				expect(session.history.messages[0].content).toBe(content)
				expect(session.history.messages[0].role).toBe(role)
				expect(session.metadata.commandCount).toBe(1)
			})

			it("should throw error if no active session", async () => {
				await expect(sessionManager.addMessage("test", "user")).rejects.toThrow("No active session")
			})

			it("should trim history if exceeds max length", async () => {
				const session = await sessionManager.createSession()
				session.config.maxHistoryLength = 2

				await sessionManager.addMessage("Message 1", "user")
				await sessionManager.addMessage("Message 2", "user")
				await sessionManager.addMessage("Message 3", "user")

				expect(session.history.messages).toHaveLength(2)
				expect(session.history.messages[0].content).toBe("Message 2")
				expect(session.history.messages[1].content).toBe("Message 3")
			})
		})

		describe("createCheckpoint", () => {
			it("should create checkpoint in active session", async () => {
				const session = await sessionManager.createSession()
				await sessionManager.addMessage("Test message", "user")

				await sessionManager.createCheckpoint("Test checkpoint")

				expect(session.history.checkpoints).toHaveLength(1)
				expect(session.history.checkpoints[0].description).toBe("Test checkpoint")
				expect(session.history.checkpoints[0].messageIndex).toBe(1)
			})

			it("should throw error if no active session", async () => {
				await expect(sessionManager.createCheckpoint("test")).rejects.toThrow("No active session")
			})
		})

		describe("updateSessionState", () => {
			it("should update session state", async () => {
				const session = await sessionManager.createSession()
				const updates = {
					workingDirectory: "/new/path",
					openFiles: ["new-file.js"],
				}

				await sessionManager.updateSessionState(updates)

				expect(session.state.workingDirectory).toBe("/new/path")
				expect(session.state.openFiles).toEqual(["new-file.js"])
			})

			it("should throw error if no active session", async () => {
				await expect(sessionManager.updateSessionState({})).rejects.toThrow("No active session")
			})
		})
	})

	describe("session discovery", () => {
		describe("listSessions", () => {
			it("should delegate to storage", async () => {
				const mockSessions = [
					{
						id: "session-1",
						name: "Session 1",
						createdAt: new Date(),
						updatedAt: new Date(),
						lastAccessedAt: new Date(),
						tags: [],
						status: SessionStatus.ACTIVE,
						size: 1024,
						messageCount: 5,
						duration: 3600,
					},
				]

				mockStorage.listSessions.mockResolvedValue(mockSessions)

				const result = await sessionManager.listSessions({ limit: 10 })

				expect(result).toBe(mockSessions)
				expect(mockStorage.listSessions).toHaveBeenCalledWith({ limit: 10 })
			})
		})

		describe("findSessions", () => {
			it("should search sessions by query", async () => {
				const mockSessions = [
					{
						id: "session-1",
						name: "Test Session",
						description: "A test session",
						createdAt: new Date(),
						updatedAt: new Date(),
						lastAccessedAt: new Date(),
						tags: ["testing"],
						status: SessionStatus.ACTIVE,
						size: 1024,
						messageCount: 5,
						duration: 3600,
					},
					{
						id: "session-2",
						name: "Production Session",
						description: "Production work",
						createdAt: new Date(),
						updatedAt: new Date(),
						lastAccessedAt: new Date(),
						tags: ["production"],
						status: SessionStatus.COMPLETED,
						size: 2048,
						messageCount: 10,
						duration: 7200,
					},
				]

				mockStorage.listSessions.mockResolvedValue(mockSessions)

				const result = await sessionManager.findSessions("test")

				expect(result).toHaveLength(1)
				expect(result[0].name).toBe("Test Session")
			})
		})
	})

	describe("events", () => {
		it("should emit sessionCreated event", async () => {
			const eventSpy = jest.fn()
			sessionManager.on("sessionCreated", eventSpy)

			const session = await sessionManager.createSession()

			expect(eventSpy).toHaveBeenCalledWith(session)
		})

		it("should emit sessionSaved event", async () => {
			const eventSpy = jest.fn()
			sessionManager.on("sessionSaved", eventSpy)

			const session = await sessionManager.createSession()
			await sessionManager.saveSession(session.id)

			expect(eventSpy).toHaveBeenCalledWith(session.id)
		})

		it("should emit sessionLoaded event", async () => {
			const eventSpy = jest.fn()
			sessionManager.on("sessionLoaded", eventSpy)

			const mockSession: Session = {
				id: "test-session",
				name: "Test Session",
				metadata: {
					createdAt: new Date(),
					updatedAt: new Date(),
					lastAccessedAt: new Date(),
					version: SESSION_FORMAT_VERSION,
					tags: [],
					duration: 0,
					commandCount: 0,
					status: SessionStatus.ACTIVE,
				},
				state: {
					workingDirectory: "/test",
					environment: {},
					activeProcesses: [],
					openFiles: [],
					watchedFiles: [],
					mcpConnections: [],
				},
				history: {
					messages: [],
					context: { workspaceRoot: "/test", activeFiles: [], environmentVariables: {} },
					checkpoints: [],
				},
				tools: [],
				files: { watchedDirectories: [], ignoredPatterns: [], lastScanTime: new Date(), fileChecksums: {} },
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

			mockStorage.loadSession.mockResolvedValue(mockSession)

			await sessionManager.loadSession("test-session")

			expect(eventSpy).toHaveBeenCalledWith(mockSession)
		})
	})

	describe("cleanup", () => {
		it("should cleanup resources on destroy", () => {
			const removeAllListenersSpy = jest.spyOn(sessionManager, "removeAllListeners")

			sessionManager.destroy()

			expect(removeAllListenersSpy).toHaveBeenCalled()
		})
	})
})
