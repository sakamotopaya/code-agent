import { IQuestionPresenter, QuestionData } from "../interfaces/IQuestionSystem"
import { QuestionOptions, ConfirmationOptions, InputOptions } from "../../interfaces/IUserInterface"
import { SSEOutputAdapter } from "../../../api/streaming/SSEOutputAdapter"

/**
 * API/SSE implementation of IQuestionPresenter
 * Emits SSE events for questions without creating conflicting promises
 */
export class SSEQuestionPresenter implements IQuestionPresenter {
	constructor(private sseAdapter: SSEOutputAdapter) {}

	/**
	 * Present a multiple choice question to the user
	 * Emits the question as a log event with structured data
	 */
	async presentQuestion(question: QuestionData): Promise<void> {
		const options = question.options as QuestionOptions

		const questionEvent = {
			type: "question",
			questionId: question.id,
			questionType: "question",
			question: question.question,
			choices: options?.choices || [],
			defaultChoice: options?.defaultChoice,
			timestamp: question.timestamp.toISOString(),
		}

		// Use the log method to emit structured question data
		await this.sseAdapter.log(`QUESTION_EVENT: ${JSON.stringify(questionEvent)}`)
	}

	/**
	 * Present a confirmation dialog to the user
	 */
	async presentConfirmation(question: QuestionData): Promise<void> {
		const options = question.options as ConfirmationOptions
		const yesText = options?.yesText || "Yes"
		const noText = options?.noText || "No"

		const questionEvent = {
			type: "question",
			questionId: question.id,
			questionType: "confirmation",
			question: question.question,
			choices: [yesText, noText],
			yesText,
			noText,
			timestamp: question.timestamp.toISOString(),
		}

		await this.sseAdapter.log(`QUESTION_EVENT: ${JSON.stringify(questionEvent)}`)
	}

	/**
	 * Present an input prompt to the user
	 */
	async presentInput(question: QuestionData): Promise<void> {
		const options = question.options as InputOptions

		const questionEvent = {
			type: "question",
			questionId: question.id,
			questionType: "input",
			question: question.question,
			placeholder: options?.placeholder,
			defaultValue: options?.defaultValue,
			password: options?.password || false,
			timestamp: question.timestamp.toISOString(),
		}

		await this.sseAdapter.log(`QUESTION_EVENT: ${JSON.stringify(questionEvent)}`)
	}
}
