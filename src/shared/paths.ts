/**
 * Centralized path utilities for consistent storage locations
 * across CLI and API contexts
 */

import * as os from "os"
import * as path from "path"

/**
 * The default directory name for Roo configuration and storage
 * Change this constant to update the directory name across the entire application
 */
export const AGENTZ_DIR_NAME = ".agentz"

/**
 * Get the global storage path for the application
 * Uses ${AGENTZ_DIR_NAME} directory for consistency with CLI config
 */
export function getGlobalStoragePath(): string {
	// Check for container/environment override first (Docker, etc.)
	if (process.env.ROO_GLOBAL_STORAGE_PATH) {
		return process.env.ROO_GLOBAL_STORAGE_PATH
	}
	if (process.env.API_STORAGE_ROOT) {
		return process.env.API_STORAGE_ROOT
	}

	// Default behavior (backwards compatible)
	const homeDir = os.homedir()
	return path.join(homeDir, AGENTZ_DIR_NAME)
}

/**
 * Get the fallback storage path for environments without home directory
 */
export function getFallbackStoragePath(): string {
	return path.join("/tmp", AGENTZ_DIR_NAME)
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
