/**
 * Mock implementation of ripgrep service
 *
 * This mock prevents filesystem access and provides predictable behavior for tests
 */

export const getBinPath = jest.fn().mockResolvedValue("/mock/rg")

export const regexSearchFiles = jest.fn().mockResolvedValue("No results found")

export const truncateLine = jest.fn().mockImplementation((line: string, maxLength: number = 500) => {
	return line.length > maxLength ? line.substring(0, maxLength) + " [truncated...]" : line
})
