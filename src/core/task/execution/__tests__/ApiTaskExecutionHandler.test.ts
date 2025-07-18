import { ApiTaskExecutionHandler } from "../ApiTaskExecutionHandler"
import { SSEOutputAdapter } from "../../../../api/streaming/SSEOutputAdapter"

// Mock SSEOutputAdapter
const mockSSEAdapter = {
	showInformation: jest.fn(),
	showProgress: jest.fn(),
	emitCompletion: jest.fn(),
	emitError: jest.fn(),
	log: jest.fn(),
} as unknown as SSEOutputAdapter

describe("ApiTaskExecutionHandler", () => {
	let handler: ApiTaskExecutionHandler
	const jobId = "test-job-123"
	const taskId = "test-task-456"

	beforeEach(() => {
		jest.clearAllMocks()
		handler = new ApiTaskExecutionHandler(mockSSEAdapter, jobId, true) // verbose = true for testing
	})

	describe("onTaskMessage", () => {
		it("should NOT forward 'say' actions to prevent duplication", async () => {
			const event = {
				action: "say",
				message: { text: "This should not be forwarded to SSE" },
			}

			await handler.onTaskMessage(taskId, event)

			// Verify that showInformation was NOT called for "say" actions
			expect(mockSSEAdapter.showInformation).not.toHaveBeenCalled()
		})

		it("should forward 'ask' actions with question prefix", async () => {
			const questionText = "What is your choice?"
			const event = {
				action: "ask",
				message: { text: questionText },
			}

			await handler.onTaskMessage(taskId, event)

			// Verify that ask actions are still forwarded with proper formatting
			expect(mockSSEAdapter.showInformation).toHaveBeenCalledWith(`Question: ${questionText}`)
		})

		it("should forward non-say message types to log", async () => {
			const messageText = "Some other message type"
			const event = {
				action: "tool_use",
				message: { text: messageText },
			}

			await handler.onTaskMessage(taskId, event)

			// Verify that non-say actions are logged
			expect(mockSSEAdapter.log).toHaveBeenCalledWith(messageText)
		})

		it("should handle events without message text gracefully", async () => {
			const event = {
				action: "say",
				// no message property
			}

			await handler.onTaskMessage(taskId, event)

			// Should not throw and should not call any SSE methods
			expect(mockSSEAdapter.showInformation).not.toHaveBeenCalled()
			expect(mockSSEAdapter.log).not.toHaveBeenCalled()
		})

		it("should log verbose information when verbose is enabled", async () => {
			const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {})

			const event = {
				action: "say",
				message: { text: "Test message" },
			}

			await handler.onTaskMessage(taskId, event)

			// Check that verbose logging includes helpful debugging info
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[ApiTaskExecutionHandler] Task test-task-456 message:"),
				"say",
				expect.objectContaining({
					hasText: true,
					textLength: 12,
					source: "message_handler",
				}),
			)

			// Check that skipped "say" action is logged
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'[ApiTaskExecutionHandler] SKIPPED duplicate "say" forwarding - handled by userInterface directly',
				),
			)

			consoleSpy.mockRestore()
		})
	})

	describe("onTaskStarted", () => {
		it("should emit progress event for task start", async () => {
			await handler.onTaskStarted(taskId)

			expect(mockSSEAdapter.showProgress).toHaveBeenCalledWith("Task execution started", 0)
		})
	})

	describe("onTaskCompleted", () => {
		it("should emit completion event", async () => {
			const result = "Task completed successfully"
			const tokenUsage = { total: 100 }
			const toolUsage = { tools: 3 }

			await handler.onTaskCompleted(taskId, result, tokenUsage, toolUsage)

			expect(mockSSEAdapter.emitCompletion).toHaveBeenCalledWith(
				result,
				"Task has been completed successfully",
				undefined,
				"final",
			)
		})
	})

	describe("onTaskFailed", () => {
		it("should emit error event", async () => {
			const error = new Error("Task failed")

			await handler.onTaskFailed(taskId, error)

			expect(mockSSEAdapter.emitError).toHaveBeenCalledWith(error)
		})
	})

	describe("onTaskActivity", () => {
		it("should emit progress for mode switches", async () => {
			await handler.onTaskActivity(taskId, "taskModeSwitched", { mode: "debug" })

			expect(mockSSEAdapter.showProgress).toHaveBeenCalledWith("Switched to debug mode", undefined)
		})

		it("should emit progress for spawned subtasks", async () => {
			await handler.onTaskActivity(taskId, "taskSpawned", {})

			expect(mockSSEAdapter.showProgress).toHaveBeenCalledWith("Spawned subtask", undefined)
		})

		it("should not emit events for unhandled activity types", async () => {
			await handler.onTaskActivity(taskId, "unknownActivity", {})

			expect(mockSSEAdapter.showProgress).not.toHaveBeenCalled()
		})
	})

	describe("onUserInputReceived", () => {
		it("should emit progress indicating continuation", async () => {
			await handler.onUserInputReceived(taskId)

			expect(mockSSEAdapter.showProgress).toHaveBeenCalledWith("Continuing after user response...", undefined)
		})
	})
})
