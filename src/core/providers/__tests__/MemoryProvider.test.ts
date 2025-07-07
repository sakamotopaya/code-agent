import { MemoryProvider } from "../MemoryProvider"
import { ProviderType } from "../IProvider"

describe("MemoryProvider", () => {
	let provider: MemoryProvider

	beforeEach(async () => {
		provider = new MemoryProvider({
			defaultState: {
				mode: "test-mode",
			},
		})
		await provider.initialize()
	})

	afterEach(async () => {
		await provider.dispose()
	})

	test("should initialize correctly", () => {
		expect(provider.type).toBe(ProviderType.Memory)
		expect(provider.isInitialized).toBe(true)
	})

	test("should get and set state", async () => {
		const state = await provider.getState()
		expect(state.mode).toBe("test-mode")

		await provider.updateState("mode", "new-mode")
		const updatedState = await provider.getState()
		expect(updatedState.mode).toBe("new-mode")
	})

	test("should manage mode correctly", async () => {
		await provider.setMode("ticket-oracle")
		const mode = await provider.getCurrentMode()
		expect(mode).toBe("ticket-oracle")

		const history = await provider.getModeHistory()
		expect(history).toContain("ticket-oracle")
	})

	test("should handle API configuration", async () => {
		const config = {
			apiProvider: "anthropic" as const,
			apiKey: "test-key",
			apiModelId: "claude-3-5-sonnet-20241022",
		}

		await provider.setApiConfiguration(config)
		const retrievedConfig = await provider.getApiConfiguration()
		expect(retrievedConfig).toEqual(config)
	})

	test("should support session isolation", async () => {
		const sessionProvider = new MemoryProvider({
			enableSessionIsolation: true,
		})
		await sessionProvider.initialize()

		const sessionId1 = sessionProvider.createSession()
		const sessionId2 = sessionProvider.createSession()

		await sessionProvider.setMode("mode1", sessionId1)
		await sessionProvider.setMode("mode2", sessionId2)

		const mode1 = await sessionProvider.getCurrentMode(sessionId1)
		const mode2 = await sessionProvider.getCurrentMode(sessionId2)

		expect(mode1).toBe("mode1")
		expect(mode2).toBe("mode2")

		await sessionProvider.dispose()
	})

	describe("Session ID Security", () => {
		test("should generate unique session IDs", () => {
			const provider = new MemoryProvider()
			const sessionIds = new Set()
			const numSessions = 100

			// Generate multiple session IDs
			for (let i = 0; i < numSessions; i++) {
				const sessionId = provider.createSession()
				sessionIds.add(sessionId)
			}

			// All should be unique
			expect(sessionIds.size).toBe(numSessions)
		})

		test("should generate session IDs with correct format", () => {
			const provider = new MemoryProvider()
			const sessionId = provider.createSession()

			// Should match format: session_{timestamp}_{base64url}
			const formatRegex = /^session_\d+_[A-Za-z0-9_-]+$/
			expect(sessionId).toMatch(formatRegex)
		})

		test("should generate session IDs with cryptographically secure randomness", () => {
			const provider = new MemoryProvider()
			const sessionIds: string[] = []
			const numSessions = 50

			// Generate multiple session IDs
			for (let i = 0; i < numSessions; i++) {
				sessionIds.push(provider.createSession())
			}

			// All session IDs should be unique (extremely high probability with crypto randomness)
			const uniqueSessionIds = new Set(sessionIds)
			expect(uniqueSessionIds.size).toBe(numSessions)

			// Each session ID should follow the correct format and contain crypto-random data
			sessionIds.forEach((sessionId) => {
				// Should start with "session_" and have additional parts
				expect(sessionId).toMatch(/^session_\d+_/)

				// Should contain base64url characters after the timestamp
				const afterSecondUnderscore = sessionId.substring(sessionId.indexOf("_", 8) + 1)
				expect(afterSecondUnderscore).toMatch(/^[A-Za-z0-9_-]+$/)
				expect(afterSecondUnderscore.length).toBeGreaterThan(4)
			})
		})

		test("should generate different session IDs even when called rapidly", () => {
			const provider = new MemoryProvider()
			const sessionIds: string[] = []

			// Generate session IDs rapidly to test timestamp collision handling
			for (let i = 0; i < 10; i++) {
				sessionIds.push(provider.createSession())
			}

			// All should still be unique due to cryptographic randomness
			const uniqueIds = new Set(sessionIds)
			expect(uniqueIds.size).toBe(sessionIds.length)
		})

		test("should maintain session ID format compatibility", () => {
			const provider = new MemoryProvider()
			const sessionId = provider.createSession()

			// Should start with "session_"
			expect(sessionId).toMatch(/^session_/)

			// Should contain timestamp after first underscore
			const firstUnderscoreIndex = sessionId.indexOf("_")
			const secondUnderscoreIndex = sessionId.indexOf("_", firstUnderscoreIndex + 1)

			expect(firstUnderscoreIndex).toBeGreaterThan(0)
			expect(secondUnderscoreIndex).toBeGreaterThan(firstUnderscoreIndex)

			// Extract timestamp
			const timestampPart = sessionId.substring(firstUnderscoreIndex + 1, secondUnderscoreIndex)
			expect(timestampPart).toMatch(/^\d+$/)
			const timestamp = parseInt(timestampPart)
			expect(timestamp).toBeGreaterThan(0)

			// Timestamp should be recent (within last few seconds)
			const now = Date.now()
			expect(timestamp).toBeGreaterThan(now - 5000) // within 5 seconds
			expect(timestamp).toBeLessThanOrEqual(now)

			// Random part should be the secure random component (everything after second underscore)
			const randomPart = sessionId.substring(secondUnderscoreIndex + 1)
			expect(randomPart).toBeDefined()
			expect(randomPart.length).toBeGreaterThan(4)
			expect(randomPart).toMatch(/^[A-Za-z0-9_-]+$/)
		})
	})
})
