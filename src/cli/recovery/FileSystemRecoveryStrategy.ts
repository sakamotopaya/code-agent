/**
 * File system error recovery strategy
 */

import * as fs from "fs"
import * as path from "path"
import { ErrorContext, RecoveryResult } from "../types/error-types"
import { FileSystemError, FileNotFoundError, PermissionDeniedError, DiskSpaceError } from "../errors/FileSystemError"
import { BaseRecoveryStrategy } from "./RecoveryStrategy"

export class FileSystemRecoveryStrategy extends BaseRecoveryStrategy {
	canRecover(error: Error, context: ErrorContext): boolean {
		if (!(error instanceof FileSystemError)) {
			return false
		}

		// Can attempt recovery for most file system errors
		return true
	}

	async recover(error: FileSystemError, context: ErrorContext): Promise<RecoveryResult> {
		this.logRecoveryAttempt(error, 1, context)

		try {
			if (error instanceof FileNotFoundError) {
				return await this.recoverFromFileNotFound(error, context)
			}

			if (error instanceof PermissionDeniedError) {
				return await this.recoverFromPermissionDenied(error, context)
			}

			if (error instanceof DiskSpaceError) {
				return await this.recoverFromDiskSpace(error, context)
			}

			// Generic file system error recovery
			return await this.recoverGenericFileSystemError(error, context)
		} catch (recoveryError) {
			return {
				success: false,
				finalError: recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)),
				suggestions: error.getSuggestedActions(),
			}
		}
	}

	async rollback(error: FileSystemError, context: ErrorContext): Promise<void> {
		// Clean up any temporary files or partial operations
		console.debug("File system recovery rollback completed", {
			errorType: error.constructor.name,
			operationId: context.operationId,
			path: error.path,
		})
	}

	private async recoverFromFileNotFound(error: FileNotFoundError, context: ErrorContext): Promise<RecoveryResult> {
		if (!error.path) {
			return { success: false, suggestions: ["Path information not available for recovery"] }
		}

		const suggestions: string[] = []

		// Try to create parent directories if they don't exist
		const dir = path.dirname(error.path)
		try {
			if (!fs.existsSync(dir)) {
				await fs.promises.mkdir(dir, { recursive: true })
				suggestions.push(`Created missing directory: ${dir}`)

				// If this was a directory creation operation, we've succeeded
				if (error.operation === "read" && error.path.endsWith("/")) {
					return { success: true, suggestions }
				}
			}
		} catch (mkdirError) {
			suggestions.push(`Failed to create directory ${dir}: ${mkdirError}`)
		}

		// Check if file exists in alternative locations
		const alternativePaths = this.getAlternativePaths(error.path)
		for (const altPath of alternativePaths) {
			if (fs.existsSync(altPath)) {
				suggestions.push(`File found at alternative location: ${altPath}`)
			}
		}

		return {
			success: false,
			suggestions: [...error.getSuggestedActions(), ...suggestions],
		}
	}

	private async recoverFromPermissionDenied(
		error: PermissionDeniedError,
		context: ErrorContext,
	): Promise<RecoveryResult> {
		if (!error.path) {
			return { success: false, suggestions: ["Path information not available for recovery"] }
		}

		const suggestions: string[] = []

		try {
			// Check current permissions
			const stats = await fs.promises.stat(error.path)
			const mode = stats.mode.toString(8)
			suggestions.push(`Current file permissions: ${mode}`)

			// Suggest alternative paths with write access
			const dir = path.dirname(error.path)
			const filename = path.basename(error.path)
			const tempPath = path.join(dir, `.tmp_${filename}`)

			try {
				// Test if we can write to a temporary file in the same directory
				await fs.promises.writeFile(tempPath, "")
				await fs.promises.unlink(tempPath)
				suggestions.push("Directory is writable - permission issue may be file-specific")
			} catch {
				// Try alternative writable locations
				const alternatives = this.getWritableAlternatives(error.path)
				suggestions.push(...alternatives.map((alt) => `Alternative writable location: ${alt}`))
			}
		} catch (statError) {
			suggestions.push(`Cannot access file information: ${statError}`)
		}

		return {
			success: false,
			suggestions: [...error.getSuggestedActions(), ...suggestions],
		}
	}

	private async recoverFromDiskSpace(error: DiskSpaceError, context: ErrorContext): Promise<RecoveryResult> {
		const suggestions: string[] = []

		try {
			// Get disk space information
			const stats = await fs.promises.statfs(error.path || process.cwd())
			const freeSpace = stats.bavail * stats.bsize
			const totalSpace = stats.blocks * stats.bsize
			const usedPercentage = (((totalSpace - freeSpace) / totalSpace) * 100).toFixed(1)

			suggestions.push(`Disk usage: ${usedPercentage}% (${this.formatBytes(freeSpace)} free)`)

			// Suggest cleanup actions
			if (freeSpace < 100 * 1024 * 1024) {
				// Less than 100MB
				suggestions.push("Critical: Less than 100MB free space available")
				suggestions.push("Immediate cleanup required")
			} else if (freeSpace < 1024 * 1024 * 1024) {
				// Less than 1GB
				suggestions.push("Warning: Less than 1GB free space available")
			}

			// Suggest alternative locations with more space
			const alternatives = await this.findAlternativeLocationsWithSpace()
			suggestions.push(...alternatives)
		} catch (statError) {
			suggestions.push(`Cannot get disk space information: ${statError}`)
		}

		return {
			success: false,
			suggestions: [...error.getSuggestedActions(), ...suggestions],
		}
	}

	private async recoverGenericFileSystemError(
		error: FileSystemError,
		context: ErrorContext,
	): Promise<RecoveryResult> {
		return {
			success: false,
			suggestions: error.getSuggestedActions(),
		}
	}

	private getAlternativePaths(originalPath: string): string[] {
		const dir = path.dirname(originalPath)
		const filename = path.basename(originalPath)
		const ext = path.extname(filename)
		const name = path.basename(filename, ext)

		return [
			path.join(dir, `${name}.bak${ext}`),
			path.join(dir, `${name}_backup${ext}`),
			path.join(process.cwd(), filename),
			path.join(process.env.HOME || "~", filename),
		]
	}

	private getWritableAlternatives(originalPath: string): string[] {
		const filename = path.basename(originalPath)

		return [
			path.join(process.cwd(), filename),
			path.join(process.env.TMPDIR || "/tmp", filename),
			path.join(process.env.HOME || "~", filename),
		].filter((p) => {
			try {
				fs.accessSync(path.dirname(p), fs.constants.W_OK)
				return true
			} catch {
				return false
			}
		})
	}

	private async findAlternativeLocationsWithSpace(): Promise<string[]> {
		const locations = [process.env.TMPDIR || "/tmp", process.env.HOME || "~", "/var/tmp"]

		const alternatives: string[] = []

		for (const location of locations) {
			try {
				if (fs.existsSync(location)) {
					const stats = await fs.promises.statfs(location)
					const freeSpace = stats.bavail * stats.bsize
					if (freeSpace > 1024 * 1024 * 1024) {
						// More than 1GB
						alternatives.push(`${location} (${this.formatBytes(freeSpace)} free)`)
					}
				}
			} catch {
				// Ignore errors checking alternative locations
			}
		}

		return alternatives
	}

	private formatBytes(bytes: number): string {
		const units = ["B", "KB", "MB", "GB", "TB"]
		let size = bytes
		let unitIndex = 0

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024
			unitIndex++
		}

		return `${size.toFixed(1)}${units[unitIndex]}`
	}
}
