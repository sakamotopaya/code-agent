/**
 * Exit codes for CLI operations
 */
export enum ExitCode {
	SUCCESS = 0,
	GENERAL_ERROR = 1,
	INVALID_ARGUMENTS = 2,
	COMMAND_NOT_FOUND = 3,
	PERMISSION_DENIED = 4,
	FILE_NOT_FOUND = 5,
	TIMEOUT = 6,
	INTERRUPTED = 7,
	BATCH_PARTIAL_FAILURE = 8,
	BATCH_COMPLETE_FAILURE = 9,
	CONFIGURATION_ERROR = 10,
}

/**
 * Exit code utilities
 */
export class ExitCodeHelper {
	/**
	 * Get human-readable description for exit code
	 */
	static getDescription(code: ExitCode): string {
		switch (code) {
			case ExitCode.SUCCESS:
				return "Operation completed successfully"
			case ExitCode.GENERAL_ERROR:
				return "General error occurred"
			case ExitCode.INVALID_ARGUMENTS:
				return "Invalid command line arguments"
			case ExitCode.COMMAND_NOT_FOUND:
				return "Command not found"
			case ExitCode.PERMISSION_DENIED:
				return "Permission denied"
			case ExitCode.FILE_NOT_FOUND:
				return "File not found"
			case ExitCode.TIMEOUT:
				return "Operation timed out"
			case ExitCode.INTERRUPTED:
				return "Operation was interrupted"
			case ExitCode.BATCH_PARTIAL_FAILURE:
				return "Batch operation partially failed"
			case ExitCode.BATCH_COMPLETE_FAILURE:
				return "Batch operation completely failed"
			case ExitCode.CONFIGURATION_ERROR:
				return "Configuration error"
			default:
				return "Unknown error"
		}
	}

	/**
	 * Exit the process with the given code and optional message
	 */
	static exit(code: ExitCode, message?: string): never {
		if (message) {
			if (code === ExitCode.SUCCESS) {
				console.log(message)
			} else {
				console.error(message)
			}
		}
		process.exit(code)
	}
}
