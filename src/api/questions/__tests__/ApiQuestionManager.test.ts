import { ApiQuestionManager } from "../ApiQuestionManager"
import { promises as fs } from "fs"
import path from "path"
import { EventEmitter } from "events"

// Mock the storage path
jest.mock("../../../shared/paths", () => ({
	getStoragePath: () => "/tmp/test-storage",
}))

// Mock fs promises
jest.mock("fs", () => ({
	promises: {
		mkdir: jest.fn(),
		writeFile: jest.fn(),
		readFile: jest.fn(),
	},
}))

const mockFs = fs as jest.Mocked<typeof fs>

describe("ApiQuestionManager", () => {
	let questionManager: ApiQuestionManager
	let mockStorageDir: string

	beforeEach(() => {
		jest.clearAllMocks()
		mockStorageDir = "/tmp/test-storage/questions"
		questionManager = new ApiQuestionManager({
			storageDir: mockStorageDir,
			enableTimeout: false,
			maxConcurrentQuestions: 10,
		})

		// Mock successful storage operations
		mockFs.mkdir.mockResolvedValue(undefined)
		mockFs.writeFile.mockResolvedValue(undefined)
		mockFs.readFile.mockRejectedValue({ code: "ENOENT" }) // No existing file
	})

	afterEach(async () => {
		await questionManager.shutdown()
	})

	describe("createQuestion", () => {
		it("should create a question with unique ID", async () => {
			const { questionId, promise } = await questionManager.createQuestion("job1", "What is your name?", [
				{ answer: "Alice" },
				{ answer: "Bob" },
			])

			expect(questionId).toMatch(/^q_job1_\d+_\d+$/)
			expect(promise).toBeInstanceOf(Promise)

			const question = questionManager.getQuestion(questionId)
			expect(question).toMatchObject({
				id: questionId,
				jobId: "job1",
				question: "What is your name?",
				suggestions: [{ answer: "Alice" }, { answer: "Bob" }],
				state: "pending",
			})
		})

		it("should emit questionCreated event", async () => {
			const eventSpy = jest.fn()
			questionManager.on("questionCreated", eventSpy)

			await questionManager.createQuestion("job1", "Test question?")

			expect(eventSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					jobId: "job1",
					question: "Test question?",
					state: "pending",
				}),
			)
		})

		it("should reject when max concurrent questions exceeded", async () => {
			const manager = new ApiQuestionManager({ maxConcurrentQuestions: 2 })

			// Create 2 questions
			await manager.createQuestion("job1", "Question 1")
			await manager.createQuestion("job1", "Question 2")

			// Third should fail
			await expect(manager.createQuestion("job1", "Question 3")).rejects.toThrow(
				"Maximum concurrent questions (2) exceeded",
			)

			await manager.shutdown()
		})

		it("should support timeout configuration", async () => {
			const manager = new ApiQuestionManager({
				enableTimeout: true,
				defaultTimeout: 100,
			})

			const { promise } = await manager.createQuestion("job1", "Timeout test")

			await expect(promise).rejects.toThrow(/Question (expired|cancelled)/)

			await manager.shutdown()
		}, 10000)
	})

	describe("submitAnswer", () => {
		it("should resolve question promise with answer", async () => {
			const { questionId, promise } = await questionManager.createQuestion("job1", "What is 2+2?")

			const submitResult = await questionManager.submitAnswer(questionId, "4")
			const answer = await promise

			expect(submitResult).toBe(true)
			expect(answer).toBe("4")

			const question = questionManager.getQuestion(questionId)
			expect(question?.state).toBe("answered")
			expect(question?.answer).toBe("4")
			expect(question?.answeredAt).toBeInstanceOf(Date)
		})

		it("should emit questionAnswered event", async () => {
			const eventSpy = jest.fn()
			questionManager.on("questionAnswered", eventSpy)

			const { questionId } = await questionManager.createQuestion("job1", "Test question?")
			await questionManager.submitAnswer(questionId, "test answer")

			expect(eventSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					id: questionId,
					state: "answered",
					answer: "test answer",
				}),
			)
		})

		it("should return false for non-existent question", async () => {
			const result = await questionManager.submitAnswer("nonexistent", "answer")
			expect(result).toBe(false)
		})

		it("should return false for already answered question", async () => {
			const { questionId } = await questionManager.createQuestion("job1", "Test question?")

			await questionManager.submitAnswer(questionId, "first answer")
			const result = await questionManager.submitAnswer(questionId, "second answer")

			expect(result).toBe(false)
		})
	})

	describe("cancelQuestion", () => {
		it("should reject question promise with cancellation error", async () => {
			const { questionId, promise } = await questionManager.createQuestion("job1", "Test question?")

			const cancelResult = await questionManager.cancelQuestion(questionId, "User cancelled")

			expect(cancelResult).toBe(true)
			await expect(promise).rejects.toThrow("Question cancelled: User cancelled")

			const question = questionManager.getQuestion(questionId)
			expect(question?.state).toBe("cancelled")
		})

		it("should emit questionCancelled event", async () => {
			const eventSpy = jest.fn()
			questionManager.on("questionCancelled", eventSpy)

			const { questionId } = await questionManager.createQuestion("job1", "Test question?")
			await questionManager.cancelQuestion(questionId)

			expect(eventSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					id: questionId,
					state: "cancelled",
				}),
			)
		})

		it("should return false for non-existent question", async () => {
			const result = await questionManager.cancelQuestion("nonexistent")
			expect(result).toBe(false)
		})
	})

	describe("getQuestions", () => {
		it("should return questions for specific job", async () => {
			await questionManager.createQuestion("job1", "Question 1")
			await questionManager.createQuestion("job2", "Question 2")
			await questionManager.createQuestion("job1", "Question 3")

			const job1Questions = questionManager.getJobQuestions("job1")
			const job2Questions = questionManager.getJobQuestions("job2")

			expect(job1Questions).toHaveLength(2)
			expect(job2Questions).toHaveLength(1)
			expect(job1Questions[0].jobId).toBe("job1")
			expect(job1Questions[1].jobId).toBe("job1")
			expect(job2Questions[0].jobId).toBe("job2")
		})

		it("should return only pending questions", async () => {
			const { questionId: q1 } = await questionManager.createQuestion("job1", "Question 1")
			const { questionId: q2 } = await questionManager.createQuestion("job1", "Question 2")
			const { questionId: q3 } = await questionManager.createQuestion("job1", "Question 3")

			await questionManager.submitAnswer(q1, "answer")
			await questionManager.cancelQuestion(q2)

			const pendingQuestions = questionManager.getPendingQuestions("job1")

			expect(pendingQuestions).toHaveLength(1)
			expect(pendingQuestions[0].id).toBe(q3)
			expect(pendingQuestions[0].state).toBe("pending")
		})
	})

	describe("cancelJobQuestions", () => {
		it("should cancel all pending questions for a job", async () => {
			const { questionId: q1 } = await questionManager.createQuestion("job1", "Question 1")
			const { questionId: q2 } = await questionManager.createQuestion("job1", "Question 2")
			const { questionId: q3 } = await questionManager.createQuestion("job2", "Question 3")

			await questionManager.submitAnswer(q1, "answer") // Already answered

			const cancelledCount = await questionManager.cancelJobQuestions("job1", "Job cancelled")

			expect(cancelledCount).toBe(1) // Only q2 was pending and cancelled

			const q2Question = questionManager.getQuestion(q2)
			const q3Question = questionManager.getQuestion(q3)

			expect(q2Question?.state).toBe("cancelled")
			expect(q3Question?.state).toBe("pending") // Different job, not cancelled
		})
	})

	describe("getStats", () => {
		it("should return correct statistics", async () => {
			const { questionId: q1 } = await questionManager.createQuestion("job1", "Question 1")
			const { questionId: q2 } = await questionManager.createQuestion("job1", "Question 2")
			const { questionId: q3 } = await questionManager.createQuestion("job2", "Question 3")

			await questionManager.submitAnswer(q1, "answer")
			await questionManager.cancelQuestion(q2)

			const stats = questionManager.getStats()

			expect(stats).toEqual({
				total: 3,
				pending: 1,
				answered: 1,
				expired: 0,
				cancelled: 1,
				byJob: {
					job1: 2,
					job2: 1,
				},
			})
		})
	})

	describe("cleanupQuestions", () => {
		it("should remove old completed questions", async () => {
			const { questionId: q1 } = await questionManager.createQuestion("job1", "Old question")
			const { questionId: q2 } = await questionManager.createQuestion("job1", "Recent question")

			// Answer both questions
			await questionManager.submitAnswer(q1, "answer1")
			await questionManager.submitAnswer(q2, "answer2")

			// Mock old creation date for q1
			const q1Question = questionManager.getQuestion(q1)!
			q1Question.createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 days ago

			const removedCount = await questionManager.cleanupQuestions(30)

			expect(removedCount).toBe(1)
			expect(questionManager.getQuestion(q1)).toBeUndefined()
			expect(questionManager.getQuestion(q2)).toBeDefined()
		})

		it("should not remove pending questions", async () => {
			const { questionId } = await questionManager.createQuestion("job1", "Pending question")

			// Mock old creation date
			const question = questionManager.getQuestion(questionId)!
			question.createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 days ago

			const removedCount = await questionManager.cleanupQuestions(30)

			expect(removedCount).toBe(0)
			expect(questionManager.getQuestion(questionId)).toBeDefined()
		})
	})

	describe("persistence", () => {
		it("should persist questions to disk", async () => {
			await questionManager.createQuestion("job1", "Persistent question")

			// Verify that writeFile was called with correct structure
			expect(mockFs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining("questions.json"),
				expect.stringContaining('"questions"'),
				"utf8",
			)

			// Check the structure of persisted data
			const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0]
			const persistedData = JSON.parse(writeCall[1])

			expect(persistedData).toHaveProperty("questions")
			expect(persistedData).toHaveProperty("lastUpdated")
			expect(Array.isArray(persistedData.questions)).toBe(true)
			expect(persistedData.questions[0]).toMatchObject({
				jobId: "job1",
				question: "Persistent question",
				state: "pending",
			})
		})

		it("should load persisted questions on initialization", async () => {
			const mockPersistedData = {
				questions: [
					{
						id: "q_job1_123_1",
						jobId: "job1",
						question: "Persisted question",
						suggestions: [],
						state: "answered",
						createdAt: new Date().toISOString(),
						answeredAt: new Date().toISOString(),
						answer: "persisted answer",
					},
				],
				lastUpdated: new Date().toISOString(),
			}

			mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockPersistedData))

			const manager = new ApiQuestionManager({ storageDir: mockStorageDir })

			// Give it time to load
			await new Promise((resolve) => setTimeout(resolve, 50))

			const question = manager.getQuestion("q_job1_123_1")
			expect(question).toMatchObject({
				id: "q_job1_123_1",
				jobId: "job1",
				question: "Persisted question",
				state: "answered",
				answer: "persisted answer",
			})

			await manager.shutdown()
		}, 10000)
	})

	describe("shutdown", () => {
		it("should cancel all pending questions and clean up", async () => {
			const { questionId, promise } = await questionManager.createQuestion("job1", "Test question")

			await questionManager.shutdown()

			await expect(promise).rejects.toThrow("Question cancelled: System shutdown")

			const stats = questionManager.getStats()
			expect(stats.total).toBe(0)
		})
	})
})
