/**
 * File system related errors
 */

import { ErrorCategory, ErrorSeverity, ErrorContext } from "../types/error-types"
import { CLIError } from "./CLIError"

export class FileSystemError extends CLIError {
	readonly category = ErrorCategory.FILE_SYSTEM
	readonly severity = ErrorSeverity.HIGH
	readonly isRecoverable = true

	constructor(
		message: string,
		code: string,
		public readonly path?: string,
		public readonly operation?: string,
		context?: ErrorContext,
		cause?: Error,
	) {
		super(message, code, context, cause)
	}

	override getSuggestedActions(): string[] {
		const actions = ["Check file permissions", "Verify file path exists", "Ensure sufficient disk space"]

		if (this.path) {
			actions.push(`Verify path "${this.path}" is accessible`)
		}

		if (this.operation === "write") {
			actions.push("Check if file is locked by another process")
		}

		if (this.operation === "read") {
			actions.push("Ensure file exists and is readable")
		}

		return actions
	}

	override getDocumentationLinks(): string[] {
		return ["https://nodejs.org/api/fs.html", "https://docs.npmjs.com/cli/v8/commands/npm-config#files"]
	}

	override getUserFriendlyMessage(): string {
		if (this.path && this.operation) {
			return `Failed to ${this.operation} file "${this.path}": ${this.message}`
		}
		return `File system error: ${this.message}`
	}
}

// Specific file system error types
export class FileNotFoundError extends FileSystemError {
	constructor(path: string, context?: ErrorContext, cause?: Error) {
		super(`File not found: ${path}`, "FS_FILE_NOT_FOUND", path, "read", context, cause)
	}

	override getSuggestedActions(): string[] {
		return [
			`Check if file "${this.path}" exists`,
			"Verify the file path is correct",
			"Ensure you have read permissions for the directory",
		]
	}
}

export class PermissionDeniedError extends FileSystemError {
	constructor(path: string, operation: string, context?: ErrorContext, cause?: Error) {
		super(`Permission denied: cannot ${operation} ${path}`, "FS_PERMISSION_DENIED", path, operation, context, cause)
	}

	override getSuggestedActions(): string[] {
		return [
			`Check permissions for "${this.path}"`,
			"Run with appropriate privileges if needed",
			"Ensure you own the file or have necessary permissions",
		]
	}
}

export class DiskSpaceError extends FileSystemError {
	constructor(path: string, context?: ErrorContext, cause?: Error) {
		super(`Insufficient disk space to write to ${path}`, "FS_DISK_SPACE", path, "write", context, cause)
	}

	override getSuggestedActions(): string[] {
		return ["Free up disk space", "Choose a different location with more space", "Clean up temporary files"]
	}
}
