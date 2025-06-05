export { AnthropicVertexHandler } from "./anthropic-vertex"
export { AnthropicHandler } from "./anthropic"
export { AwsBedrockHandler } from "./bedrock"
export { ChutesHandler } from "./chutes"
export { DeepSeekHandler } from "./deepseek"
export { FakeAIHandler } from "./fake-ai"
export { GeminiHandler } from "./gemini"
export { GlamaHandler } from "./glama"
export { GroqHandler } from "./groq"
export { HumanRelayHandler } from "./human-relay"
export { LiteLLMHandler } from "./lite-llm"
export { LmStudioHandler } from "./lm-studio"
export { MistralHandler } from "./mistral"
export { OllamaHandler } from "./ollama"
export { OpenAiNativeHandler } from "./openai-native"
export { OpenAiHandler } from "./openai"
export { OpenRouterHandler } from "./openrouter"
export { RequestyHandler } from "./requesty"
export { UnboundHandler } from "./unbound"
export { VertexHandler } from "./vertex"
export { XAIHandler } from "./xai"

// Conditional exports for VSCode-specific providers
let VsCodeLmHandler: any = null

try {
	// Only export VSCode LM handler if in VSCode context
	if (typeof require !== "undefined") {
		// Try to require vscode to check if we're in VSCode context
		require("vscode")
		VsCodeLmHandler = require("./vscode-lm").VsCodeLmHandler
	}
} catch (error) {
	// VSCode not available (CLI mode)
	VsCodeLmHandler = null
}

export { VsCodeLmHandler }
