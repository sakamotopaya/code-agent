import { IAnswerCollector } from "../interfaces/IQuestionSystem"
import { TaskMessaging } from "../../task/TaskMessaging"
import pWaitFor from "p-wait-for"

/**
 * VSCode implementation of IAnswerCollector
 * Wraps existing TaskMessaging polling mechanism to collect answers from webview
 */
export class VSCodeAnswerCollector implements IAnswerCollector {
	private pendingQuestions = new Map<
		string,
		{
			resolve: (answer: string) => void
			reject: (error: Error) => void
			timestamp: number
		}
	>()

	constructor(private taskMessaging: TaskMessaging) {}

	/**
	 * Wait for an answer to a specific question
	 * This integrates with the existing VSCode polling mechanism
	 */
	async waitForAnswer(questionId: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			// Store the promise handlers for this question
			this.pendingQuestions.set(questionId, {
				resolve,
				reject,
				timestamp: Date.now(),
			})

			// Set up the existing VSCode polling mechanism
			this.setupVSCodePolling(questionId)
				.then((answer) => {
					// Clean up and resolve
					this.pendingQuestions.delete(questionId)
					resolve(answer)
				})
				.catch((error) => {
					// Clean up and reject
					this.pendingQuestions.delete(questionId)
					reject(error)
				})
		})
	}

	/**
	 * Cancel a pending question
	 */
	cancelQuestion(questionId: string): void {
		const pending = this.pendingQuestions.get(questionId)
		if (pending) {
			this.pendingQuestions.delete(questionId)
			pending.reject(new Error(`Question ${questionId} was cancelled`))
		}
	}

	/**
	 * Cleanup any resources
	 */
	cleanup(): void {
		// Cancel all pending questions
		const pendingIds = Array.from(this.pendingQuestions.keys())
		pendingIds.forEach((id) => this.cancelQuestion(id))
	}

	/**
	 * Set up the existing VSCode polling mechanism
	 * This mimics the logic in TaskMessaging.ask()
	 */
	private async setupVSCodePolling(questionId: string): Promise<string> {
		const askTs = Date.now()
		this.taskMessaging.lastMessageTs = askTs

		// Reset ask response state (like TaskMessaging does)
		this.resetAskResponse()

		// Wait for response using existing polling mechanism
		await pWaitFor(() => this.hasAskResponse() || this.taskMessaging.lastMessageTs !== askTs, { interval: 100 })

		// Check if the question was superseded
		if (this.taskMessaging.lastMessageTs !== askTs) {
			throw new Error("Question was superseded by a newer question")
		}

		// Get the response
		const response = this.getAskResponse()

		// Clean up response state
		this.resetAskResponse()

		return response
	}

	/**
	 * Check if we have an ask response (accessing private TaskMessaging state)
	 */
	private hasAskResponse(): boolean {
		// We need to access the private askResponse property
		// This is a bit of a hack but necessary for the adapter pattern
		return (this.taskMessaging as any).askResponse !== undefined
	}

	/**
	 * Get the ask response text
	 */
	private getAskResponse(): string {
		const askResponseText = (this.taskMessaging as any).askResponseText
		return askResponseText || ""
	}

	/**
	 * Reset the ask response state
	 */
	private resetAskResponse(): void {
		// Reset the private properties (similar to TaskMessaging.ask())
		;(this.taskMessaging as any).askResponse = undefined
		;(this.taskMessaging as any).askResponseText = undefined
		;(this.taskMessaging as any).askResponseImages = undefined
	}

	/**
	 * Get statistics about pending questions
	 */
	getStatistics(): {
		pendingQuestions: number
		oldestQuestionAge: number
	} {
		const pending = Array.from(this.pendingQuestions.values())
		const now = Date.now()

		return {
			pendingQuestions: pending.length,
			oldestQuestionAge: pending.length > 0 ? Math.min(...pending.map((p) => now - p.timestamp)) : 0,
		}
	}
}
