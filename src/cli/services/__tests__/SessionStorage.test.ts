import { SessionStorage } from "../SessionStorage"
import { SessionStatus, SESSION_FORMAT_VERSION, Session, SessionFile } from "../../types/session-types"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

jest.mock("fs/promises")
jest.mock("os")
jest.mock("util", () => ({
	promisify: (fn: any) => fn, // Return the original function since our mocks already return promises
}))
jest.mock("zlib", () => ({
	gzip: jest.fn().mockImplementation((data: any) => Promise.resolve(Buffer.from(data))),
	gunzip: jest.fn().mockImplementation((data: any) => Promise.resolve(Buffer.from(data.toString()))),
}))

const mockFs = fs as jest.Mocked<typeof fs>

// Mock os module
const mockOs = os as jest.Mocked<typeof os>
jest.mocked(mockOs.homedir).mockReturnValue("/home/test")

// Mock crypto
jest.mock("crypto", () => ({
	createHash: jest.fn().mockReturnValue({
		update: jest.fn().mockReturnThis(),
		digest: jest.fn().mockReturnValue("mock-checksum"),
	}),
}))

describe("SessionStorage", () => {
	let storage: SessionStorage
	let tempDir: string
	let mockSession: Session

	beforeEach(() => {
		tempDir = "/tmp/test-sessions"

		// Reset all mocks before each test
		jest.clearAllMocks()

		// Setup default mock behaviors
		mockFs.mkdir.mockResolvedValue(undefined)
		mockFs.access.mockResolvedValue()
		mockFs.writeFile.mockResolvedValue()
		mockFs.readFile.mockResolvedValue(
			JSON.stringify({
				version: SESSION_FORMAT_VERSION,
				created: new Date().toISOString(),
				sessions: {},
			}),
		)
		mockFs.readdir.mockResolvedValue([])
		mockFs.stat.mockResolvedValue({ size: 1024 } as any)
		mockFs.unlink.mockResolvedValue()

		storage = new SessionStorage({
			sessionDirectory: tempDir,
			compressionLevel: 0, // Disable compression for easier testing
		})

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
				environment: { NODE_ENV: "test" },
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
				],
				context: {
					workspaceRoot: "/test/project",
					activeFiles: ["test.js"],
					environmentVariables: { NODE_ENV: "test" },
				},
				checkpoints: [],
			},
			tools: [],
			files: {
				watchedDirectories: ["/test/project"],
				ignoredPatterns: [".git", "node_modules"],
				lastScanTime: new Date("2024-01-01T00:00:00Z"),
				fileChecksums: {},
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

	describe("initialization", () => {
		it("should create session directory if it doesn't exist", async () => {
			mockFs.mkdir.mockResolvedValue(undefined)
			mockFs.access.mockRejectedValue(new Error("File not found"))
			mockFs.writeFile.mockResolvedValue()

			await storage.initialize()

			expect(mockFs.mkdir).toHaveBeenCalledWith(tempDir, { recursive: true, mode: 0o600 })
		})

		it("should create metadata file if it doesn't exist", async () => {
			mockFs.mkdir.mockResolvedValue(undefined)
			mockFs.access.mockRejectedValue(new Error("File not found"))
			mockFs.writeFile.mockResolvedValue()

			await storage.initialize()

			const metadataPath = path.join(tempDir, "metadata.json")
			expect(mockFs.writeFile).toHaveBeenCalledWith(metadataPath, expect.stringContaining(SESSION_FORMAT_VERSION))
		})
	})

	describe("session operations", () => {
		describe("saveSession", () => {
			it("should save session to file", async () => {
				await storage.saveSession(mockSession)

				const expectedPath = path.join(tempDir, `session-${mockSession.id}.json`)
				expect(mockFs.writeFile).toHaveBeenCalledWith(expectedPath, expect.any(String), { mode: 0o600 })
			})

			it("should sanitize sensitive data before saving", async () => {
				const sessionWithSensitiveData = {
					...mockSession,
					config: {
						...mockSession.config,
						apiKey: "secret-api-key",
					},
				}

				await storage.saveSession(sessionWithSensitiveData)

				const writeCall = mockFs.writeFile.mock.calls.find((call) => call[0].toString().includes("session-"))
				const savedData = writeCall?.[1] as string
				const sessionFile: SessionFile = JSON.parse(savedData)

				expect(sessionFile.session.config).not.toHaveProperty("apiKey")
			})
		})

		describe("loadSession", () => {
			it("should load and deserialize session", async () => {
				const sessionFile: SessionFile = {
					version: SESSION_FORMAT_VERSION,
					session: mockSession,
					checksum: "test-checksum",
					compressed: false,
				}

				mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionFile))

				// Mock checksum validation
				const crypto = require("crypto")
				crypto.createHash = jest.fn().mockReturnValue({
					update: jest.fn(),
					digest: jest.fn().mockReturnValue("test-checksum"),
				})

				const result = await storage.loadSession(mockSession.id, false) // Disable last accessed update

				expect(result.id).toBe(mockSession.id)
				expect(result.name).toBe(mockSession.name)
				expect(result.metadata.createdAt).toBeInstanceOf(Date)
			})

			it("should throw error for invalid checksum", async () => {
				const sessionFile: SessionFile = {
					version: SESSION_FORMAT_VERSION,
					session: mockSession,
					checksum: "invalid-checksum",
					compressed: false,
				}

				mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionFile))

				// Mock checksum validation to fail
				const crypto = require("crypto")
				crypto.createHash = jest.fn().mockReturnValue({
					update: jest.fn(),
					digest: jest.fn().mockReturnValue("different-checksum"),
				})

				await expect(storage.loadSession(mockSession.id, false)).rejects.toThrow("checksum validation failed")
			})
		})

		describe("deleteSession", () => {
			it("should delete session file", async () => {
				await storage.deleteSession(mockSession.id)

				const expectedPath = path.join(tempDir, `session-${mockSession.id}.json`)
				expect(mockFs.unlink).toHaveBeenCalledWith(expectedPath)
			})

			it("should not throw error if file doesn't exist", async () => {
				const error = new Error("File not found") as NodeJS.ErrnoException
				error.code = "ENOENT"
				mockFs.unlink.mockRejectedValue(error)

				await expect(storage.deleteSession(mockSession.id)).resolves.not.toThrow()
			})
		})

		describe("listSessions", () => {
			it("should list all session files", async () => {
				mockFs.readdir.mockResolvedValue([
					"session-id1.json",
					"session-id2.json",
					"metadata.json",
					"other-file.txt",
				] as any)

				const sessionFile1: SessionFile = {
					version: SESSION_FORMAT_VERSION,
					session: { ...mockSession, id: "id1" },
					checksum: "test-checksum",
					compressed: false,
				}
				const sessionFile2: SessionFile = {
					version: SESSION_FORMAT_VERSION,
					session: { ...mockSession, id: "id2" },
					checksum: "test-checksum",
					compressed: false,
				}

				mockFs.readFile
					.mockResolvedValueOnce(JSON.stringify(sessionFile1)) // First session file
					.mockResolvedValueOnce(JSON.stringify(sessionFile2)) // Second session file

				const sessions = await storage.listSessions()

				expect(sessions).toHaveLength(2)
				expect(sessions[0].id).toBe("id1")
				expect(sessions[1].id).toBe("id2")
			})

			it("should filter sessions by status", async () => {
				mockFs.readdir.mockResolvedValue(["session-id1.json"] as any)

				const activeSession = {
					...mockSession,
					id: "id1",
					metadata: { ...mockSession.metadata, status: SessionStatus.ACTIVE },
				}
				const sessionFile: SessionFile = {
					version: SESSION_FORMAT_VERSION,
					session: activeSession,
					checksum: "test-checksum",
					compressed: false,
				}
				mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionFile))

				const sessions = await storage.listSessions({
					status: SessionStatus.ACTIVE,
				})

				expect(sessions).toHaveLength(1)
				expect(sessions[0].status).toBe(SessionStatus.ACTIVE)
			})
		})

		describe("utility methods", () => {
			it("should check if session exists", async () => {
				mockFs.access.mockResolvedValue()

				const exists = await storage.exists(mockSession.id)

				expect(exists).toBe(true)
				expect(mockFs.access).toHaveBeenCalledWith(path.join(tempDir, `session-${mockSession.id}.json`))
			})

			it("should return false if session doesn't exist", async () => {
				mockFs.access.mockRejectedValue(new Error("File not found"))

				const exists = await storage.exists(mockSession.id)

				expect(exists).toBe(false)
			})

			it("should get session file size", async () => {
				mockFs.stat.mockResolvedValue({ size: 2048 } as any)

				const size = await storage.getSessionSize(mockSession.id)

				expect(size).toBe(2048)
			})

			it("should return 0 for non-existent session size", async () => {
				mockFs.stat.mockRejectedValue(new Error("File not found"))

				const size = await storage.getSessionSize(mockSession.id)

				expect(size).toBe(0)
			})
		})
	})

	describe("checksum operations", () => {
		it("should calculate consistent checksum", () => {
			const crypto = require("crypto")
			crypto.createHash = jest.fn().mockReturnValue({
				update: jest.fn(),
				digest: jest.fn().mockReturnValue("test-checksum"),
			})

			const checksum1 = storage.calculateChecksum({ test: "data" })
			const checksum2 = storage.calculateChecksum({ test: "data" })

			expect(checksum1).toBe(checksum2)
		})

		it("should validate correct checksum", () => {
			const crypto = require("crypto")
			crypto.createHash = jest.fn().mockReturnValue({
				update: jest.fn(),
				digest: jest.fn().mockReturnValue("correct-checksum"),
			})

			const sessionFile: SessionFile = {
				version: SESSION_FORMAT_VERSION,
				session: mockSession,
				checksum: "correct-checksum",
				compressed: false,
			}

			const isValid = storage.validateChecksum(sessionFile)

			expect(isValid).toBe(true)
		})

		it("should reject invalid checksum", () => {
			const crypto = require("crypto")
			crypto.createHash = jest.fn().mockReturnValue({
				update: jest.fn(),
				digest: jest.fn().mockReturnValue("expected-checksum"),
			})

			const sessionFile: SessionFile = {
				version: SESSION_FORMAT_VERSION,
				session: mockSession,
				checksum: "wrong-checksum",
				compressed: false,
			}

			const isValid = storage.validateChecksum(sessionFile)

			expect(isValid).toBe(false)
		})

		describe("sanitizeSession", () => {
			it("should preserve Date objects when sanitizing sessions", async () => {
				// Create a session with Date objects
				const testDate = new Date("2024-01-01T12:00:00Z")
				const sessionWithDates: Session = {
					...mockSession,
					metadata: {
						...mockSession.metadata,
						createdAt: testDate,
						updatedAt: testDate,
						lastAccessedAt: testDate,
					},
					history: {
						...mockSession.history,
						messages: [
							{
								id: "msg-1",
								timestamp: testDate,
								role: "user",
								content: "Test message",
							},
						],
					},
					tools: [
						{
							toolName: "test-tool",
							configuration: {},
							cache: { someData: "test" },
							lastUsed: testDate,
							usageCount: 1,
							results: [
								{
									timestamp: testDate,
									input: "test",
									output: "result",
									success: true,
								},
							],
						},
					],
					files: {
						...mockSession.files,
						lastScanTime: testDate,
					},
				}

				// Save the session
				await storage.saveSession(sessionWithDates)

				// Find the session file write call (should contain the SessionFile structure)
				const sessionFileCall = mockFs.writeFile.mock.calls.find((call) => {
					try {
						const data = JSON.parse(call[1] as string)
						return data.version && data.session && data.checksum
					} catch {
						return false
					}
				})

				expect(sessionFileCall).toBeDefined()
				const savedData = JSON.parse(sessionFileCall![1] as string)
				const sanitizedSession = savedData.session

				// Check that Date objects are preserved as Date objects, not strings
				expect(sanitizedSession.metadata.createdAt).toEqual(testDate.toISOString())
				expect(sanitizedSession.metadata.updatedAt).toEqual(testDate.toISOString())
				expect(sanitizedSession.metadata.lastAccessedAt).toEqual(testDate.toISOString())
				expect(sanitizedSession.history.messages[0].timestamp).toEqual(testDate.toISOString())
				expect(sanitizedSession.tools[0].lastUsed).toEqual(testDate.toISOString())
				expect(sanitizedSession.tools[0].results[0].timestamp).toEqual(testDate.toISOString())
				expect(sanitizedSession.files.lastScanTime).toEqual(testDate.toISOString())

				// Verify cache was cleared
				expect(sanitizedSession.tools[0].cache).toEqual({})
			})

			it("should remove sensitive configuration data during sanitization", async () => {
				// Create a session with sensitive config data
				const sessionWithSensitiveData: Session = {
					...mockSession,
					config: {
						...mockSession.config,
						apiKey: "secret-api-key",
						encryptionKey: "secret-encryption-key",
						password: "secret-password",
						token: "secret-token",
						secret: "secret-value",
					} as any,
				}

				// Save the session
				await storage.saveSession(sessionWithSensitiveData)

				// Find the session file write call (should contain the SessionFile structure)
				const sessionFileCall = mockFs.writeFile.mock.calls.find((call) => {
					try {
						const data = JSON.parse(call[1] as string)
						return data.version && data.session && data.checksum
					} catch {
						return false
					}
				})

				expect(sessionFileCall).toBeDefined()
				const savedData = JSON.parse(sessionFileCall![1] as string)
				const sanitizedSession = savedData.session

				expect(sanitizedSession.config.apiKey).toBeUndefined()
				expect(sanitizedSession.config.encryptionKey).toBeUndefined()
				expect(sanitizedSession.config.password).toBeUndefined()
				expect(sanitizedSession.config.token).toBeUndefined()
				expect(sanitizedSession.config.secret).toBeUndefined()
			})
		})
	})
})
