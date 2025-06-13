/**
 * Centralized path utilities for consistent storage locations
 * across CLI and API contexts
 */

import * as os from "os"
import * as path from "path"

/**
 * Get the global storage path for the application
 * Uses .agentz directory for consistency with CLI config
 */
export function getGlobalStoragePath(): string {
	const homeDir = os.homedir()
	return path.join(homeDir, ".agentz")
}

/**
 * Get the fallback storage path for environments without home directory
 */
export function getFallbackStoragePath(): string {
	return path.join("/tmp", ".agentz")
}

/**
 * Get the appropriate storage path based on environment
 */
export function getStoragePath(): string {
	try {
		return getGlobalStoragePath()
	} catch {
		return getFallbackStoragePath()
	}
}
