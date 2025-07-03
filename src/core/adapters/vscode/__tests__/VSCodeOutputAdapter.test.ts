import { VSCodeOutputAdapter } from "../VSCodeOutputAdapter"
import { ClineProvider } from "../../../webview/ClineProvider"
import { ClineMessage } from "@roo-code/types"

// Mock the ClineProvider
const mockProvider = {
	postMessageToWebview: jest.fn(),
	updateTaskHistory: jest.fn(),
	getStateToPostToWebview: jest.fn(),
} as unknown as ClineProvider

describe("VSCodeOutputAdapter", () => {
	let adapter: VSCodeOutputAdapter

	beforeEach(() => {
		adapter = new VSCodeOutputAdapter(mockProvider)
		jest.clearAllMocks()
	})

	describe("outputContent", () => {
		it("should send complete message to webview", async () => {
			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Hello world",
			}

			await adapter.outputContent(message)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "partialMessage",
				partialMessage: message,
			})
		})
	})

	describe("outputPartialContent", () => {
		it("should send partial message to webview", async () => {
			const partialMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Partial content...",
				partial: true,
			}

			await adapter.outputPartialContent(partialMessage)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "partialMessage",
				partialMessage,
			})
		})
	})

	describe("streamChunk", () => {
		it("should log chunk received without error", async () => {
			const consoleSpy = jest.spyOn(console, "log").mockImplementation()

			await adapter.streamChunk("test chunk")

			expect(consoleSpy).toHaveBeenCalledWith("[VSCodeOutputAdapter] Streaming chunk received: 10 chars")

			consoleSpy.mockRestore()
		})
	})

	describe("sendMessage", () => {
		it("should send structured message to webview", async () => {
			const message = { type: "action", action: "testAction" }

			await adapter.sendMessage(message)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(message)
		})
	})

	describe("sendPartialUpdate", () => {
		it("should send partial update to webview", async () => {
			const partialMessage = { text: "updating..." }

			await adapter.sendPartialUpdate(partialMessage)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "partialMessage",
				partialMessage,
			})
		})
	})

	describe("syncState", () => {
		it("should sync state to webview", async () => {
			const state = { taskHistory: [], currentTask: null }

			await adapter.syncState(state)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "state",
				state,
			})
		})
	})

	describe("notifyStateChange", () => {
		it("should notify webview of state changes", async () => {
			await adapter.notifyStateChange("taskCompleted", { taskId: "123" })

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "action",
				action: "taskCompleted",
				taskId: "123",
			})
		})
	})

	describe("updateTaskHistory", () => {
		it("should delegate to provider and return updated history", async () => {
			const historyItem = {
				id: "test",
				number: 1,
				ts: Date.now(),
				task: "Test task",
				tokensIn: 100,
				tokensOut: 50,
				totalCost: 0.01,
			}

			const mockState = { taskHistory: [historyItem] }
			;(mockProvider.getStateToPostToWebview as jest.Mock).mockResolvedValue(mockState)

			const result = await adapter.updateTaskHistory(historyItem)

			expect(mockProvider.updateTaskHistory).toHaveBeenCalledWith(historyItem)
			expect(mockProvider.getStateToPostToWebview).toHaveBeenCalled()
			expect(result).toEqual([historyItem])
		})
	})

	describe("updatePersistentData", () => {
		it("should log update request", async () => {
			const consoleSpy = jest.spyOn(console, "log").mockImplementation()

			await adapter.updatePersistentData("testKey", "testValue")

			expect(consoleSpy).toHaveBeenCalledWith(
				"[VSCodeOutputAdapter] Persistent data update requested for key: testKey",
			)

			consoleSpy.mockRestore()
		})
	})

	describe("getPersistentData", () => {
		it("should log retrieval request and return undefined", () => {
			const consoleSpy = jest.spyOn(console, "log").mockImplementation()

			const result = adapter.getPersistentData("testKey")

			expect(consoleSpy).toHaveBeenCalledWith(
				"[VSCodeOutputAdapter] Persistent data retrieval requested for key: testKey",
			)
			expect(result).toBeUndefined()

			consoleSpy.mockRestore()
		})
	})

	describe("reset", () => {
		it("should log reset call", () => {
			const consoleSpy = jest.spyOn(console, "log").mockImplementation()

			adapter.reset()

			expect(consoleSpy).toHaveBeenCalledWith("[VSCodeOutputAdapter] Reset called")

			consoleSpy.mockRestore()
		})
	})

	describe("dispose", () => {
		it("should log dispose call", async () => {
			const consoleSpy = jest.spyOn(console, "log").mockImplementation()

			await adapter.dispose()

			expect(consoleSpy).toHaveBeenCalledWith("[VSCodeOutputAdapter] Dispose called")

			consoleSpy.mockRestore()
		})
	})
})
