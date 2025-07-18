import { IQuestionPresenter, QuestionData } from "../interfaces/IQuestionSystem"
import { QuestionOptions, ConfirmationOptions, InputOptions } from "../../interfaces/IUserInterface"
import { TaskMessaging } from "../../task/TaskMessaging"

/**
 * VSCode implementation of IQuestionPresenter
 * Wraps existing TaskMessaging functionality to present questions via webview
 */
export class VSCodeQuestionPresenter implements IQuestionPresenter {
	constructor(private taskMessaging: TaskMessaging) {}

	/**
	 * Present a multiple choice question to the user
	 */
	async presentQuestion(question: QuestionData): Promise<void> {
		const options = question.options as QuestionOptions

		// Format the question in the format expected by the webview
		const followupData = {
			questionId: question.id,
			questionType: "question",
			question: question.question,
			suggest: options?.choices?.map((choice) => ({ answer: choice })) || [],
		}

		// Use existing TaskMessaging to add the question message
		// All question types use "followup" ask type in VSCode
		await this.taskMessaging.addToClineMessages({
			ts: Date.now(),
			type: "ask",
			ask: "followup",
			text: JSON.stringify(followupData),
		})
	}

	/**
	 * Present a confirmation dialog to the user
	 */
	async presentConfirmation(question: QuestionData): Promise<void> {
		const options = question.options as ConfirmationOptions
		const yesText = options?.yesText || "Yes"
		const noText = options?.noText || "No"

		// Format as a confirmation question using followup format
		const confirmationData = {
			questionId: question.id,
			questionType: "confirmation",
			question: question.question,
			yesText,
			noText,
			suggest: [{ answer: yesText }, { answer: noText }],
		}

		// Use existing TaskMessaging to add the confirmation message
		await this.taskMessaging.addToClineMessages({
			ts: Date.now(),
			type: "ask",
			ask: "followup", // All questions use followup in VSCode
			text: JSON.stringify(confirmationData),
		})
	}

	/**
	 * Present an input prompt to the user
	 */
	async presentInput(question: QuestionData): Promise<void> {
		const options = question.options as InputOptions

		// Format as an input question using followup format
		const inputData = {
			questionId: question.id,
			questionType: "input",
			question: question.question,
			placeholder: options?.placeholder || "",
			defaultValue: options?.defaultValue || "",
			password: options?.password || false,
			suggest: options?.placeholder ? [{ answer: options.placeholder }] : [],
		}

		// Use existing TaskMessaging to add the input message
		await this.taskMessaging.addToClineMessages({
			ts: Date.now(),
			type: "ask",
			ask: "followup", // All questions use followup in VSCode
			text: JSON.stringify(inputData),
		})
	}
}
