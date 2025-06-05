import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@roo-code/types"

import { getCommand } from "../../utils/commands"
import { ApiStream } from "../transform/stream"
import { getPlatformServices, isVsCodeContext } from "../../core/adapters/PlatformServiceFactory"

import type { ApiHandler, SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

/**
 * Human Relay API processor
 * This processor does not directly call the API, but interacts with the model through human operations copy and paste.
 */
export class HumanRelayHandler implements ApiHandler, SingleCompletionHandler {
	countTokens(_content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		return Promise.resolve(0)
	}

	/**
	 * Create a message processing flow, display a dialog box to request human assistance
	 * @param systemPrompt System prompt words
	 * @param messages Message list
	 * @param metadata Optional metadata
	 */
	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Get the most recent user message
		const latestMessage = messages[messages.length - 1]

		if (!latestMessage) {
			throw new Error("No message to relay")
		}

		// If it is the first message, splice the system prompt word with the user message
		let promptText = ""
		if (messages.length === 1) {
			promptText = `${systemPrompt}\n\n${getMessageContent(latestMessage)}`
		} else {
			promptText = getMessageContent(latestMessage)
		}

		// Copy to clipboard
		const platformServices = await getPlatformServices()
		await platformServices.clipboard.writeText(promptText)

		// A dialog box pops up to request user action
		const response = await showHumanRelayDialog(promptText)

		if (!response) {
			// The user canceled the operation
			throw new Error("Human relay operation cancelled")
		}

		// Return to the user input reply
		yield { type: "text", text: response }
	}

	/**
	 * Get model information
	 */
	getModel(): { id: string; info: ModelInfo } {
		// Human relay does not depend on a specific model, here is a default configuration
		return {
			id: "human-relay",
			info: {
				maxTokens: 16384,
				contextWindow: 100000,
				supportsImages: true,
				supportsPromptCache: false,
				supportsComputerUse: true,
				inputPrice: 0,
				outputPrice: 0,
				description: "Calling web-side AI model through human relay",
			},
		}
	}

	/**
	 * Implementation of a single prompt
	 * @param prompt Prompt content
	 */
	async completePrompt(prompt: string): Promise<string> {
		// Copy to clipboard
		const platformServices = await getPlatformServices()
		await platformServices.clipboard.writeText(prompt)

		// A dialog box pops up to request user action
		const response = await showHumanRelayDialog(prompt)

		if (!response) {
			throw new Error("Human relay operation cancelled")
		}

		return response
	}
}

/**
 * Extract text content from message object
 * @param message
 */
function getMessageContent(message: Anthropic.Messages.MessageParam): string {
	if (typeof message.content === "string") {
		return message.content
	} else if (Array.isArray(message.content)) {
		return message.content
			.filter((item) => item.type === "text")
			.map((item) => (item.type === "text" ? item.text : ""))
			.join("\n")
	}
	return ""
}
/**
 * Displays the human relay dialog and waits for user response.
 * @param promptText The prompt text that needs to be copied.
 * @returns The user's input response or undefined (if canceled).
 */
async function showHumanRelayDialog(promptText: string): Promise<string | undefined> {
	if (!isVsCodeContext()) {
		// In CLI mode, prompt user for input
		console.log("\n📋 Prompt copied to clipboard. Please:")
		console.log("1. Paste the prompt into your AI model interface")
		console.log("2. Copy the AI's response")
		console.log("3. Enter the response below")
		console.log("\nPrompt:")
		console.log("---")
		console.log(promptText)
		console.log("---\n")

		const platformServices = await getPlatformServices()
		return await platformServices.userInterface.showInputBox({
			prompt: "Enter the AI's response",
			placeHolder: "Paste the response here...",
		})
	}

	// VSCode mode - use command-based dialog
	return new Promise<string | undefined>((resolve) => {
		// Create a unique request ID.
		const requestId = Date.now().toString()

		const setupPromise = async () => {
			try {
				const platformServices = await getPlatformServices()

				// Register a global callback function.
				await platformServices.commandExecutor.executeCommand(
					getCommand("registerHumanRelayCallback"),
					requestId,
					(response: string | undefined) => resolve(response),
				)

				// Open the dialog box directly using the current panel.
				await platformServices.commandExecutor.executeCommand(getCommand("showHumanRelayDialog"), {
					requestId,
					promptText,
				})
			} catch (error) {
				console.error("Failed to show human relay dialog:", error)
				resolve(undefined)
			}
		}

		// Call the async setup function
		setupPromise()
	})
}
