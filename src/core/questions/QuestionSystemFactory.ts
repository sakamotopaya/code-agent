import { UnifiedQuestionManager } from "./UnifiedQuestionManager"
import {
	IQuestionPresenter,
	IAnswerCollector,
	IQuestionStore,
	UnifiedQuestionManagerConfig,
} from "./interfaces/IQuestionSystem"
import { InMemoryQuestionStore } from "./stores/InMemoryQuestionStore"

/**
 * Runtime modes supported by the question system
 */
export type QuestionSystemMode = "vscode" | "api" | "cli"

/**
 * Configuration for creating a question system
 */
export interface QuestionSystemFactoryConfig extends UnifiedQuestionManagerConfig {
	mode: QuestionSystemMode
	context?: any // Runtime-specific context (e.g., TaskMessaging, SSEOutputAdapter, etc.)
}

/**
 * Factory for creating unified question managers with appropriate adapters
 */
export class QuestionSystemFactory {
	/**
	 * Create a unified question manager for the specified runtime mode
	 */
	static create(config: QuestionSystemFactoryConfig): UnifiedQuestionManager {
		const { mode, context, ...managerConfig } = config

		const presenter = this.createPresenter(mode, context)
		const collector = this.createCollector(mode, context)
		const store = this.createStore(mode, context)

		return new UnifiedQuestionManager(presenter, collector, store, managerConfig)
	}

	/**
	 * Create a presenter for the specified mode
	 */
	private static createPresenter(mode: QuestionSystemMode, context?: any): IQuestionPresenter {
		switch (mode) {
			case "vscode": {
				if (!context) {
					throw new Error("VSCode mode requires TaskMessaging context")
				}
				const { VSCodeQuestionPresenter } = require("./adapters/VSCodeQuestionPresenter")
				return new VSCodeQuestionPresenter(context)
			}

			case "api": {
				if (!context || !context.sseAdapter) {
					throw new Error("API mode requires context with sseAdapter")
				}
				const { SSEQuestionPresenter } = require("./adapters/SSEQuestionPresenter")
				return new SSEQuestionPresenter(context.sseAdapter)
			}

			case "cli":
				throw new Error("CLI mode not yet implemented")

			default:
				throw new Error(`Unknown question system mode: ${mode}`)
		}
	}

	/**
	 * Create a collector for the specified mode
	 */
	private static createCollector(mode: QuestionSystemMode, context?: any): IAnswerCollector {
		switch (mode) {
			case "vscode": {
				if (!context) {
					throw new Error("VSCode mode requires TaskMessaging context")
				}
				const { VSCodeAnswerCollector } = require("./adapters/VSCodeAnswerCollector")
				return new VSCodeAnswerCollector(context)
			}

			case "api": {
				if (!context || !context.questionManager) {
					throw new Error("API mode requires context with questionManager")
				}
				const { ApiAnswerCollector } = require("./adapters/ApiAnswerCollector")
				return new ApiAnswerCollector(context.questionManager)
			}

			case "cli":
				throw new Error("CLI mode not yet implemented")

			default:
				throw new Error(`Unknown question system mode: ${mode}`)
		}
	}

	/**
	 * Create a store for the specified mode
	 */
	private static createStore(mode: QuestionSystemMode, context?: any): IQuestionStore {
		switch (mode) {
			case "vscode":
				// VSCode uses in-memory storage
				return new InMemoryQuestionStore()

			case "api": {
				if (!context || !context.questionManager) {
					throw new Error("API mode requires context with questionManager")
				}
				const { PersistentQuestionStore } = require("./adapters/PersistentQuestionStore")
				return new PersistentQuestionStore(context.questionManager)
			}

			case "cli":
				// CLI uses in-memory storage
				return new InMemoryQuestionStore()

			default:
				throw new Error(`Unknown question system mode: ${mode}`)
		}
	}

	/**
	 * Create a question manager for VSCode mode
	 */
	static createForVSCode(taskMessaging: any, config?: UnifiedQuestionManagerConfig): UnifiedQuestionManager {
		return this.create({
			mode: "vscode",
			context: taskMessaging,
			...config,
		})
	}

	/**
	 * Create a question manager for API mode
	 */
	static createForAPI(
		sseAdapter: any,
		questionManager: any,
		config?: UnifiedQuestionManagerConfig,
	): UnifiedQuestionManager {
		return this.create({
			mode: "api",
			context: { sseAdapter, questionManager },
			...config,
		})
	}

	/**
	 * Create a question manager for CLI mode
	 */
	static createForCLI(config?: UnifiedQuestionManagerConfig): UnifiedQuestionManager {
		return this.create({
			mode: "cli",
			...config,
		})
	}
}

/**
 * Helper function to determine the runtime mode from context
 */
export function detectQuestionSystemMode(context?: any): QuestionSystemMode {
	if (!context) {
		return "cli" // Default to CLI if no context
	}

	// Check for VSCode context (TaskMessaging)
	if (context.addToClineMessages && context.handleWebviewAskResponse) {
		return "vscode"
	}

	// Check for API context (SSEOutputAdapter)
	if (context.sseAdapter && context.questionManager) {
		return "api"
	}

	// Check for single API context
	if (context.emitEvent && context.jobId) {
		return "api"
	}

	// Default to CLI
	return "cli"
}

/**
 * Helper function to create a question manager with auto-detection
 */
export function createQuestionManager(context?: any, config?: UnifiedQuestionManagerConfig): UnifiedQuestionManager {
	const mode = detectQuestionSystemMode(context)

	return QuestionSystemFactory.create({
		mode,
		context,
		...config,
	})
}
