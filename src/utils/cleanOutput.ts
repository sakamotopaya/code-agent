/**
 * Cleans output content by removing XML-like tags that should not be visible to users
 * @param content The content to clean
 * @returns Cleaned content without unwanted XML tags
 */
export function cleanOutput(content: string): string {
	if (!content) {
		return content
	}

	// Remove standalone XML-like tags that appear at the beginning
	// These are typically formatting directives that shouldn't be shown to users
	let cleaned = content
		// Remove <name> tags and their content when they appear at the start
		.replace(/^<name>.*?<\/name>\s*/i, "")
		// Remove standalone <name> tags without closing tags
		.replace(/^<name>\s*/i, "")
		// Remove <format> tags and their content when they appear at the start
		.replace(/^<format>.*?<\/format>\s*/i, "")
		// Remove standalone <format> tags without closing tags
		.replace(/^<format>\s*/i, "")
		// Remove other common XML-like directive tags at the start
		.replace(/^<[a-zA-Z][a-zA-Z0-9_-]*>\s*/i, "")
		// Remove multiple consecutive XML tags at the start
		.replace(/^(<[a-zA-Z][a-zA-Z0-9_-]*>\s*)+/i, "")

	// Note: Do not trim whitespace as it may be significant for content chunks
	// that are part of a continuous text stream
	return cleaned
}

/**
 * Extracts clean content from XML-formatted result text
 * Handles cases where the content might be wrapped in XML tags
 * @param xmlContent The XML-formatted content
 * @returns Clean text content without XML formatting tags
 */
export function extractCleanContent(xmlContent: string): string {
	if (!xmlContent) {
		return xmlContent
	}

	// Try to extract content from common XML wrapper patterns
	const patterns = [
		// Extract content from <result>...</result> tags
		/<result[^>]*>(.*?)<\/result>/is,
		// Extract content from <content>...</content> tags
		/<content[^>]*>(.*?)<\/content>/is,
		// Extract content from <text>...</text> tags
		/<text[^>]*>(.*?)<\/text>/is,
	]

	for (const pattern of patterns) {
		const match = xmlContent.match(pattern)
		if (match && match[1]) {
			return cleanOutput(match[1].trim())
		}
	}

	// If no XML wrapper found, just clean the content as-is
	return cleanOutput(xmlContent)
}
