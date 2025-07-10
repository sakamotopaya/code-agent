import { SSEOutputAdapter } from "../SSEOutputAdapter"
import { StreamManager } from "../StreamManager"
import { SSE_EVENTS } from "../types"
import { ServerResponse } from "http"

describe("Stream End Functionality", () => {
	let mockResponse: Partial<ServerResponse>
	let streamManager: StreamManager
	let adapter: SSEOutputAdapter
	let jobId: string

	beforeEach(() => {
		mockResponse = {
			writeHead: jest.fn(),
			write: jest.fn(),
			end: jest.fn(),
			headersSent: false,
		}

		streamManager = new StreamManager()
		jobId = "test-stream-end-job"

		// Create stream first
		streamManager.createStream(mockResponse as ServerResponse, jobId)

		// Create adapter with mock question manager
		const mockQuestionManager = {
			cancelJobQuestions: jest.fn().mockResolvedValue(undefined),
		}
		adapter = new SSEOutputAdapter(streamManager, jobId, false, mockQuestionManager as any)
	})

	afterEach(() => {
		streamManager.closeAllStreams()
		jest.clearAllTimers()
	})

	describe("emitCompletion with stream_end", () => {
		beforeEach(() => {
			jest.useFakeTimers()
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		it("should schedule stream_end event after completion", async () => {
			const writeSpy = jest.spyOn(mockResponse, "write")

			// Call emitCompletion
			await adapter.emitCompletion("Task completed successfully")

			// Should have sent completion event immediately
			expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(`"type":"${SSE_EVENTS.COMPLETION}"`))

			// Fast-forward 50ms to trigger stream_end
			jest.advanceTimersByTime(50)

			// Should have sent stream_end event
			expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(`"type":"${SSE_EVENTS.STREAM_END}"`))

			// Fast-forward another 100ms to trigger stream closure
			jest.advanceTimersByTime(100)

			// Stream should be closed
			expect(streamManager.hasActiveStream(jobId)).toBe(false)
		})

		it("should handle completion and stream_end timing correctly", async () => {
			const writeSpy = jest.spyOn(mockResponse, "write")

			await adapter.emitCompletion("Test completion message")

			// Verify completion event was sent first
			const completionCall = writeSpy.mock.calls.find((call) =>
				call[0].includes(`"type":"${SSE_EVENTS.COMPLETION}"`),
			)
			expect(completionCall).toBeDefined()

			// Advance timers to trigger stream_end
			jest.advanceTimersByTime(50)

			// Verify stream_end event was sent
			const streamEndCall = writeSpy.mock.calls.find((call) =>
				call[0].includes(`"type":"${SSE_EVENTS.STREAM_END}"`),
			)
			expect(streamEndCall).toBeDefined()

			// Verify stream_end came after completion
			const completionIndex = writeSpy.mock.calls.findIndex((call) =>
				call[0].includes(`"type":"${SSE_EVENTS.COMPLETION}"`),
			)
			const streamEndIndex = writeSpy.mock.calls.findIndex((call) =>
				call[0].includes(`"type":"${SSE_EVENTS.STREAM_END}"`),
			)

			expect(streamEndIndex).toBeGreaterThan(completionIndex)
		})
	})

	describe("emitError with stream_end", () => {
		beforeEach(() => {
			jest.useFakeTimers()
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		it("should schedule stream_end event after error", async () => {
			const writeSpy = jest.spyOn(mockResponse, "write")

			// Call emitError
			await adapter.emitError("Test error message")

			// Should have sent error event immediately
			expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(`"type":"${SSE_EVENTS.ERROR}"`))

			// Fast-forward 50ms to trigger stream_end
			jest.advanceTimersByTime(50)

			// Should have sent stream_end event
			expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(`"type":"${SSE_EVENTS.STREAM_END}"`))

			// Fast-forward another 100ms to trigger stream closure
			jest.advanceTimersByTime(100)

			// Stream should be closed
			expect(streamManager.hasActiveStream(jobId)).toBe(false)
		})
	})

	describe("stream state tracking", () => {
		it("should not emit stream_end if stream is already closed", async () => {
			const writeSpy = jest.spyOn(mockResponse, "write")

			// Close the stream manually
			adapter.close()

			// Try to emit completion
			await adapter.emitCompletion("Test message")

			// Should not have sent any events since stream is closed
			expect(writeSpy).not.toHaveBeenCalled()
		})

		it("should clear scheduled closure when stream is manually closed", () => {
			jest.useFakeTimers()

			// Start completion process
			adapter.emitCompletion("Test completion")

			// Manually close stream before timeout
			adapter.close()

			// Advance timers past both timeouts
			jest.advanceTimersByTime(200)

			// Stream should remain closed (no double-closure issues)
			expect(streamManager.hasActiveStream(jobId)).toBe(false)

			jest.useRealTimers()
		})
	})

	describe("backward compatibility", () => {
		it("should work with existing stream management", () => {
			// Verify stream is created and active
			expect(streamManager.hasActiveStream(jobId)).toBe(true)

			// Verify stream can be found
			const stream = streamManager.getStream(jobId)
			expect(stream).toBeDefined()
			expect(stream?.jobId).toBe(jobId)

			// Verify manual closure still works
			streamManager.closeStream(jobId)
			expect(streamManager.hasActiveStream(jobId)).toBe(false)
		})
	})
})
