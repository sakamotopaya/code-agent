/* eslint-env node */
/* global module */
// Mock tiktoken implementation for CLI context
// Provides reasonable token estimation without WebAssembly dependencies

const TOKEN_FUDGE_FACTOR = 1.5

/**
 * Simple character-based token estimation
 * This mimics the tiktoken API but uses character counting instead of WASM
 */
class MockTiktoken {
	constructor(bpe_ranks, special_tokens, pat_str) {
		// No initialization needed for character-based counting
		this.bpe_ranks = bpe_ranks || {}
		this.special_tokens = special_tokens || {}
		this.pat_str = pat_str || ""
	}

	encode(text) {
		// Rough approximation: ~4 characters per token for English text
		const tokens = Math.ceil(text.length / 4)
		return new Array(tokens).fill(0)
	}
}

/**
 * Mock tiktoken function that provides reasonable token estimates
 * @param {Array} content - Array of content blocks
 * @returns {Promise<number>} - Estimated token count
 */
async function tiktoken(content) {
	if (!content || content.length === 0) {
		return 0
	}

	let totalTokens = 0
	const encoder = new MockTiktoken()

	for (const block of content) {
		if (block.type === "text") {
			const text = block.text || ""
			if (text.length > 0) {
				const tokens = encoder.encode(text)
				totalTokens += tokens.length
			}
		} else if (block.type === "image") {
			// For images, calculate based on data size
			const imageSource = block.source
			if (imageSource && typeof imageSource === "object" && "data" in imageSource) {
				const base64Data = imageSource.data
				totalTokens += Math.ceil(Math.sqrt(base64Data.length))
			} else {
				totalTokens += 300 // Conservative estimate for unknown images
			}
		}
	}

	// Add a fudge factor to account for estimation inaccuracy
	return Math.ceil(totalTokens * TOKEN_FUDGE_FACTOR)
}

// Mock o200k_base encoder data
const mockO200kBase = {
	bpe_ranks: {},
	special_tokens: {},
	pat_str: "",
}

// Export structure for tiktoken/lite
module.exports.Tiktoken = MockTiktoken

// Export structure for tiktoken/encoders/o200k_base (default export)
module.exports.default = mockO200kBase

// Also export for direct tiktoken usage
module.exports.tiktoken = tiktoken
