// Simple test to check if questions module can be imported
console.log("[TEST] Starting questions module import test")

try {
	const questionsModule = require("./src/core/questions")
	console.log("[TEST] Successfully imported questions module")

	const { createQuestionManager, detectQuestionSystemMode } = questionsModule
	console.log("[TEST] Successfully destructured functions:", {
		createQuestionManager: typeof createQuestionManager,
		detectQuestionSystemMode: typeof detectQuestionSystemMode,
	})

	// Test mode detection with null context
	const mode = detectQuestionSystemMode(null)
	console.log("[TEST] Detected mode with null context:", mode)
} catch (error) {
	console.error("[TEST] Failed to import questions module:", error)
	console.error("[TEST] Error stack:", error.stack)
}

console.log("[TEST] Test completed")
