/**
 * Platform abstraction for user interface operations
 */
export interface IUserInterfaceService {
	/**
	 * Show error message to user
	 */
	showError(message: string): void

	/**
	 * Show informational message to user
	 */
	showInfo(message: string): void

	/**
	 * Show warning message to user
	 */
	showWarning(message: string): void

	/**
	 * Log debug message (optional, for verbose mode)
	 */
	logDebug?(message: string): void
}
