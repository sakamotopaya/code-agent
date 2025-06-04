/**
 * Tests for FileSystemError and its subclasses
 */

import { FileSystemError, FileNotFoundError, PermissionDeniedError, DiskSpaceError } from "../FileSystemError"
import { ErrorCategory, ErrorSeverity } from "../../types/error-types"

describe("FileSystemError", () => {
	describe("basic FileSystemError", () => {
		const error = new FileSystemError("File operation failed", "FS_ERROR", "/test/path", "read")

		it("should have correct properties", () => {
			expect(error.category).toBe(ErrorCategory.FILE_SYSTEM)
			expect(error.severity).toBe(ErrorSeverity.HIGH)
			expect(error.isRecoverable).toBe(true)
			expect(error.path).toBe("/test/path")
			expect(error.operation).toBe("read")
		})

		it("should provide suggested actions", () => {
			const actions = error.getSuggestedActions()
			expect(actions).toContain("Check file permissions")
			expect(actions).toContain("Verify file path exists")
			expect(actions).toContain("Ensure sufficient disk space")
			expect(actions).toContain('Verify path "/test/path" is accessible')
			expect(actions).toContain("Ensure file exists and is readable")
		})

		it("should provide documentation links", () => {
			const links = error.getDocumentationLinks()
			expect(links).toContain("https://nodejs.org/api/fs.html")
		})

		it("should provide user-friendly message", () => {
			const message = error.getUserFriendlyMessage()
			expect(message).toBe('Failed to read file "/test/path": File operation failed')
		})

		it("should handle write operations differently", () => {
			const writeError = new FileSystemError("Write failed", "FS_WRITE_ERROR", "/test/write", "write")

			const actions = writeError.getSuggestedActions()
			expect(actions).toContain("Check if file is locked by another process")
		})
	})

	describe("FileNotFoundError", () => {
		const error = new FileNotFoundError("/missing/file.txt")

		it("should have correct properties", () => {
			expect(error.code).toBe("FS_FILE_NOT_FOUND")
			expect(error.path).toBe("/missing/file.txt")
			expect(error.operation).toBe("read")
			expect(error.message).toBe("File not found: /missing/file.txt")
		})

		it("should provide specific suggested actions", () => {
			const actions = error.getSuggestedActions()
			expect(actions).toContain('Check if file "/missing/file.txt" exists')
			expect(actions).toContain("Verify the file path is correct")
			expect(actions).toContain("Ensure you have read permissions for the directory")
		})
	})

	describe("PermissionDeniedError", () => {
		const error = new PermissionDeniedError("/protected/file.txt", "write")

		it("should have correct properties", () => {
			expect(error.code).toBe("FS_PERMISSION_DENIED")
			expect(error.path).toBe("/protected/file.txt")
			expect(error.operation).toBe("write")
			expect(error.message).toBe("Permission denied: cannot write /protected/file.txt")
		})

		it("should provide specific suggested actions", () => {
			const actions = error.getSuggestedActions()
			expect(actions).toContain('Check permissions for "/protected/file.txt"')
			expect(actions).toContain("Run with appropriate privileges if needed")
			expect(actions).toContain("Ensure you own the file or have necessary permissions")
		})
	})

	describe("DiskSpaceError", () => {
		const error = new DiskSpaceError("/full/disk/file.txt")

		it("should have correct properties", () => {
			expect(error.code).toBe("FS_DISK_SPACE")
			expect(error.path).toBe("/full/disk/file.txt")
			expect(error.operation).toBe("write")
			expect(error.message).toBe("Insufficient disk space to write to /full/disk/file.txt")
		})

		it("should provide specific suggested actions", () => {
			const actions = error.getSuggestedActions()
			expect(actions).toContain("Free up disk space")
			expect(actions).toContain("Choose a different location with more space")
			expect(actions).toContain("Clean up temporary files")
		})
	})

	describe("error inheritance", () => {
		it("should properly inherit from FileSystemError", () => {
			const fileNotFound = new FileNotFoundError("/test.txt")
			const permissionDenied = new PermissionDeniedError("/test.txt", "read")
			const diskSpace = new DiskSpaceError("/test.txt")

			expect(fileNotFound).toBeInstanceOf(FileSystemError)
			expect(permissionDenied).toBeInstanceOf(FileSystemError)
			expect(diskSpace).toBeInstanceOf(FileSystemError)

			expect(fileNotFound.category).toBe(ErrorCategory.FILE_SYSTEM)
			expect(permissionDenied.category).toBe(ErrorCategory.FILE_SYSTEM)
			expect(diskSpace.category).toBe(ErrorCategory.FILE_SYSTEM)
		})
	})

	describe("error serialization", () => {
		it("should serialize to JSON correctly", () => {
			const error = new FileNotFoundError("/test.txt")
			const json = error.toJSON()

			expect(json.name).toBe("FileNotFoundError")
			expect(json.code).toBe("FS_FILE_NOT_FOUND")
			expect(json.category).toBe(ErrorCategory.FILE_SYSTEM)
			expect(json.severity).toBe(ErrorSeverity.HIGH)
			expect(json.isRecoverable).toBe(true)
		})
	})
})
