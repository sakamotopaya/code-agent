import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals"
import { QuestionEventHandler } from "../QuestionEventHandler"
import { QuestionEventData, ApiClientOptions } from "../types/api-client-types"
import inquirer from "inquirer"

// Mock inquirer
jest.mock("inquirer", () => ({
	prompt: jest.fn(),
}))

const mockInquirer = inquirer as jest.Mocked<typeof inquirer>

describe("QuestionEventHandler", () => {
	let handler: QuestionEventHandler
	let mockOptions: ApiClientOptions
	let mockHttpRequest: jest.Mock

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Mock the makeHttpRequest method
		mockHttpRequest = jest.fn()
		;(mockHttpRequest as any).mockResolvedValue({
			statusCode: 200,
			body: "OK",
		})

		// Create test options
		mockOptions = {
			useStream: true,
			host: "localhost",
			port: 3000,
			mode: "code",
			restartTask: false,
			replMode: false,
			verbose: false,
			showThinking: false,
			showTools: false,
			showSystem: false,
			showResponse: false,
			showCompletion: false,
			showMcpUse: false,
			showTokenUsage: false,
			hideTokenUsage: false,
			showTiming: false,
			logSystemPrompt: false,
			logLlm: false,
		}

		// Reset singleton instance
		QuestionEventHandler.resetInstance()

		// Create new handler instance
		handler = new QuestionEventHandler(mockOptions)

		// Mock the private makeHttpRequest method
		;(handler as any).makeHttpRequest = mockHttpRequest
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	// Helper function to create valid QuestionEventData
	const createQuestionData = (overrides: Partial<QuestionEventData> = {}): QuestionEventData => ({
		type: "question",
		questionId: "test-question",
		questionType: "select",
		question: "Choose an option",
		timestamp: new Date().toISOString(),
		choices: ["option1", "option2"],
		...overrides,
	})

	describe("presentSelectQuestion", () => {
		it("should return zero-based index for basic selection", async () => {
			// Mock inquirer response
			mockInquirer.prompt.mockResolvedValue({ selection: "red" })

			const questionData = createQuestionData({
				questionId: "test-question-1",
				question: "Choose a color",
				choices: ["blue", "red", "green", "purple"],
			})

			// Process the question
			await handler.processQuestion(questionData)

			// Verify HTTP request was called with correct answer (index "1" for "red")
			expect(mockHttpRequest).toHaveBeenCalledWith(
				"http://localhost:3000/api/questions/test-question-1/answer",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ answer: "1" }),
				}),
			)
		})

		it("should return '0' for first choice", async () => {
			mockInquirer.prompt.mockResolvedValue({ selection: "first" })

			const questionData = createQuestionData({
				questionId: "test-question-2",
				question: "Choose an option",
				choices: ["first", "second", "third"],
			})

			await handler.processQuestion(questionData)

			expect(mockHttpRequest).toHaveBeenCalledWith(
				"http://localhost:3000/api/questions/test-question-2/answer",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ answer: "0" }),
				}),
			)
		})

		it("should return correct index for last choice", async () => {
			mockInquirer.prompt.mockResolvedValue({ selection: "third" })

			const questionData = createQuestionData({
				questionId: "test-question-3",
				question: "Choose an option",
				choices: ["first", "second", "third"],
			})

			await handler.processQuestion(questionData)

			expect(mockHttpRequest).toHaveBeenCalledWith(
				"http://localhost:3000/api/questions/test-question-3/answer",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ answer: "2" }),
				}),
			)
		})

		it("should return custom text for custom options", async () => {
			// Mock selection of custom option, then custom input
			mockInquirer.prompt
				.mockResolvedValueOnce({ selection: "Custom (specify)" })
				.mockResolvedValueOnce({ customValue: "My custom answer" })

			const questionData = createQuestionData({
				questionId: "test-question-4",
				question: "Choose an option",
				choices: ["Option A", "Option B", "Custom (specify)"],
			})

			await handler.processQuestion(questionData)

			expect(mockHttpRequest).toHaveBeenCalledWith(
				"http://localhost:3000/api/questions/test-question-4/answer",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ answer: "My custom answer" }),
				}),
			)
		})

		it("should return custom text for 'Other' options", async () => {
			mockInquirer.prompt
				.mockResolvedValueOnce({ selection: "Other" })
				.mockResolvedValueOnce({ customValue: "Something else" })

			const questionData = createQuestionData({
				questionId: "test-question-5",
				question: "Choose an option",
				choices: ["Yes", "No", "Other"],
			})

			await handler.processQuestion(questionData)

			expect(mockHttpRequest).toHaveBeenCalledWith(
				"http://localhost:3000/api/questions/test-question-5/answer",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ answer: "Something else" }),
				}),
			)
		})

		it("should return '0' for single choice", async () => {
			mockInquirer.prompt.mockResolvedValue({ selection: "Only Option" })

			const questionData = createQuestionData({
				questionId: "test-question-6",
				question: "Choose an option",
				choices: ["Only Option"],
			})

			await handler.processQuestion(questionData)

			expect(mockHttpRequest).toHaveBeenCalledWith(
				"http://localhost:3000/api/questions/test-question-6/answer",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ answer: "0" }),
				}),
			)
		})

		it("should throw error for invalid selection", async () => {
			mockInquirer.prompt.mockResolvedValue({ selection: "invalid choice" })

			const questionData = createQuestionData({
				questionId: "test-question-7",
				question: "Choose an option",
				choices: ["valid1", "valid2"],
			})

			await expect(handler.processQuestion(questionData)).rejects.toThrow(
				'Selected choice "invalid choice" not found in choices array',
			)
		})

		it("should throw error for empty choices array", async () => {
			const questionData = createQuestionData({
				questionId: "test-question-8",
				question: "Choose an option",
				choices: [],
			})

			await expect(handler.processQuestion(questionData)).rejects.toThrow(
				"Select questions must have choices array",
			)
		})

		it("should throw error for missing choices array", async () => {
			const questionData = createQuestionData({
				questionId: "test-question-9",
				question: "Choose an option",
				choices: undefined,
			})

			await expect(handler.processQuestion(questionData)).rejects.toThrow(
				"Select questions must have choices array",
			)
		})

		it("should handle duplicate choices correctly", async () => {
			mockInquirer.prompt.mockResolvedValue({ selection: "duplicate" })

			const questionData = createQuestionData({
				questionId: "test-question-10",
				question: "Choose an option",
				choices: ["unique", "duplicate", "duplicate", "another"],
			})

			await handler.processQuestion(questionData)

			// Should return index of first occurrence
			expect(mockHttpRequest).toHaveBeenCalledWith(
				"http://localhost:3000/api/questions/test-question-10/answer",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ answer: "1" }),
				}),
			)
		})
	})

	describe("question validation", () => {
		it("should validate question data structure", async () => {
			const invalidData = {
				// Missing required fields
				questionType: "select",
			}

			await expect(handler.handleQuestionEvent(invalidData as any)).rejects.toThrow()
		})

		it("should validate select question has choices", async () => {
			const invalidData = createQuestionData({
				questionId: "test-invalid",
				question: "Choose something",
				choices: undefined,
			})

			await expect(handler.handleQuestionEvent(invalidData)).rejects.toThrow()
		})
	})

	describe("HTTP request handling", () => {
		it("should handle HTTP request failures with retries", async () => {
			mockInquirer.prompt.mockResolvedValue({ selection: "test" })

			// Mock HTTP request to fail initially, then succeed
			;(mockHttpRequest as any).mockRejectedValueOnce(new Error("Network error")).mockResolvedValueOnce({
				statusCode: 200,
				body: "OK",
			})

			const questionData = createQuestionData({
				questionId: "test-retry",
				question: "Choose an option",
				choices: ["test", "option"],
			})

			await handler.processQuestion(questionData)

			// Should have made 2 HTTP requests (1 failed, 1 succeeded)
			expect(mockHttpRequest).toHaveBeenCalledTimes(2)
		})
	})
})
