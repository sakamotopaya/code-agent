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
})
