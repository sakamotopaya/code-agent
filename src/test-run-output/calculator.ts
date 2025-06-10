/**
 * Basic calculator utility functions
 */

/**
 * Adds two numbers together
 * @param a - First number
 * @param b - Second number
 * @param debugMode - Optional debug mode to log the operation
 * @returns The sum of a and b
 */
export function add(a: number, b: number, debugMode: boolean = false): number {
	if (debugMode) {
		console.log(`Adding ${a} + ${b}`)
	}
	return a + b
}
