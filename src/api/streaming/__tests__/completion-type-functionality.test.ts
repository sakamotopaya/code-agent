/**
 * Tests for SSEOutputAdapter completion type functionality
 * Verifies that intermediate completions keep streams alive while final completions close them
 */

import { StreamManager } from "../StreamManager"
import { SSEOutputAdapter } from "../SSEOutputAdapter"
import { ApiQuestionManager } from "../../questions/ApiQuestionManager"
import { ServerResponse } from "http"
import { EventEmitter } from "events"

// Mock ServerResponse
class MockServerResponse extends EventEmitter {
	public headersSent = false
	public destroyed = false
	private chunks: string[] = []

	write(chunk: string): boolean {
		if (this.destroyed) {
			throw new Error("Cannot write to destroyed response")
		}
		this.chunks.push(chunk)
		return true
	}

	end(): void {
		this.destroyed = true
		this.emit("finish")
	}

	setHeader(): void {
		// No-op for testing
	}

	getChunks(): string[] {
		return [...this.chunks]
	}
}

describe("SSEOutputAdapter - Completion Type Functionality", () => {
	let streamManager: StreamManager
	let adapter: SSEOutputAdapter
	let mockResponse: MockServerResponse
	let questionManager: ApiQuestionManager
	const jobId = "test-job-123"

	beforeEach(() => {
		streamManager = new StreamManager()
		questionManager = new ApiQuestionManager()
		mockResponse = new MockServerResponse()

		// Create stream
		streamManager.createStream(mockResponse as any as ServerResponse, jobId)

		// Create adapter
		adapter = new SSEOutputAdapter(streamManager, jobId, false, questionManager)
	})

	afterEach(() => {
		streamManager.closeAllStreams()
	})

	describe("intermediate completion type", () => {
		it("should NOT schedule stream closure for intermediate completions", async () => {
			// Verify stream is active initially
			expect(streamManager.hasActiveStream(jobId)).toBe(true)

			// Emit intermediate completion
			await adapter.emitCompletion("Progress update", undefined, undefined, "intermediate")

			// Stream should still be active immediately
			expect(streamManager.hasActiveStream(jobId)).toBe(true)
			expect(mockResponse.destroyed).toBe(false)

			// Wait longer than the normal 50ms timeout to ensure no closure
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Stream should still be active after timeout period
			expect(streamManager.hasActiveStream(jobId)).toBe(true)
			expect(mockResponse.destroyed).toBe(false)
		})

		it("should emit completion event for intermediate completions", async () => {
			await adapter.emitCompletion("Intermediate progress", { step: 1 }, undefined, "intermediate")

			const chunks = mockResponse.getChunks()
			expect(chunks).toHaveLength(1)

			const eventData = JSON.parse(chunks[0].replace("data: ", "").trim())
			expect(eventData.type).toBe("completion")
			expect(eventData.message).toBe("Intermediate progress")
			expect(eventData.jobId).toBe(jobId)
		})

		it("should allow multiple intermediate completions", async () => {
			// Multiple intermediate completions
			await adapter.emitCompletion("Step 1 complete", undefined, undefined, "intermediate")
			await adapter.emitCompletion("Step 2 complete", undefined, undefined, "intermediate")
			await adapter.emitCompletion("Step 3 complete", undefined, undefined, "intermediate")

			// Stream should still be active
			expect(streamManager.hasActiveStream(jobId)).toBe(true)
			expect(mockResponse.destroyed).toBe(false)

			// Should have emitted 3 completion events
			const chunks = mockResponse.getChunks()
			expect(chunks).toHaveLength(3)

			// Verify all events are completion type
			chunks.forEach((chunk, index) => {
				const eventData = JSON.parse(chunk.replace("data: ", "").trim())
				expect(eventData.type).toBe("completion")
				expect(eventData.message).toBe(`Step ${index + 1} complete`)
			})
		})
	})

	describe("final completion type", () => {
		it("should schedule stream closure for final completions", async () => {
			// Verify stream is active initially
			expect(streamManager.hasActiveStream(jobId)).toBe(true)

			// Emit final completion
			await adapter.emitCompletion("Task completed", undefined, undefined, "final")

			// Stream should still be active immediately
			expect(streamManager.hasActiveStream(jobId)).toBe(true)
			expect(mockResponse.destroyed).toBe(false)

			// Wait for the 50ms timeout
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Stream should be closed after timeout
			expect(streamManager.hasActiveStream(jobId)).toBe(false)
			expect(mockResponse.destroyed).toBe(true)
		})

		it("should emit both completion and stream_end events", async () => {
			await adapter.emitCompletion("Final result", { success: true }, undefined, "final")

			// Wait for stream_end event
			await new Promise((resolve) => setTimeout(resolve, 100))

			const chunks = mockResponse.getChunks()
			expect(chunks.length).toBeGreaterThanOrEqual(2)

			// First event should be completion
			const completionEvent = JSON.parse(chunks[0].replace("data: ", "").trim())
			expect(completionEvent.type).toBe("completion")
			expect(completionEvent.message).toBe("Final result")

			// Should contain a stream_end event
			const streamEndChunk = chunks.find((chunk) => {
				try {
					const event = JSON.parse(chunk.replace("data: ", "").trim())
					return event.type === "stream_end"
				} catch {
					return false
				}
			})
			expect(streamEndChunk).toBeDefined()
		})
	})

	describe("default behavior (backward compatibility)", () => {
		it("should default to final completion when no type specified", async () => {
			// Emit completion without specifying type (should default to 'final')
			await adapter.emitCompletion("Default completion")

			// Stream should still be active immediately
			expect(streamManager.hasActiveStream(jobId)).toBe(true)

			// Wait for the 50ms timeout
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Stream should be closed (default behavior)
			expect(streamManager.hasActiveStream(jobId)).toBe(false)
			expect(mockResponse.destroyed).toBe(true)
		})
	})

	describe("mixed completion scenario", () => {
		it("should handle intermediate followed by final completion", async () => {
			// Multiple intermediate completions
			await adapter.emitCompletion("Analyzing request", undefined, undefined, "intermediate")
			await adapter.emitCompletion("Processing data", undefined, undefined, "intermediate")

			// Verify stream still active
			expect(streamManager.hasActiveStream(jobId)).toBe(true)

			// Final completion
			await adapter.emitCompletion("Task completed successfully", undefined, undefined, "final")

			// Wait for final completion timeout
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Stream should now be closed
			expect(streamManager.hasActiveStream(jobId)).toBe(false)
			expect(mockResponse.destroyed).toBe(true)

			// Should have emitted multiple completion events plus stream_end
			const chunks = mockResponse.getChunks()
			expect(chunks.length).toBeGreaterThanOrEqual(3)
		})
	})
})
