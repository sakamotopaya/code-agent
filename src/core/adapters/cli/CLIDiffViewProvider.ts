import * as path from "path"
import * as fs from "fs/promises"
import { XMLBuilder } from "fast-xml-parser"
import { IDiffViewProvider } from "../../interfaces/IDiffViewProvider"
import { createDirectoriesForFile } from "../../../utils/fs"
import { getReadablePath } from "../../../utils/path"

/**
 * CLI implementation of diff view functionality that doesn't rely on VSCode APIs
 */
export class CLIDiffViewProvider implements IDiffViewProvider {
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing = false
	originalContent: string | undefined

	private createdDirs: string[] = []
	private relPath?: string
	private newContent?: string

	constructor(private cwd: string) {}

	async open(relPath: string): Promise<void> {
		this.relPath = relPath
		const absolutePath = path.resolve(this.cwd, relPath)
		this.isEditing = true

		// Check if file exists
		let fileExists = false
		try {
			await fs.access(absolutePath)
			fileExists = true
		} catch {
			fileExists = false
		}

		this.editType = fileExists ? "modify" : "create"

		if (fileExists) {
			this.originalContent = await fs.readFile(absolutePath, "utf-8")
		} else {
			this.originalContent = ""
		}

		// For new files, create any necessary directories
		this.createdDirs = await createDirectoriesForFile(absolutePath)

		// Make sure the file exists
		if (!fileExists) {
			await fs.writeFile(absolutePath, "")
		}
	}

	async update(accumulatedContent: string, isFinal: boolean): Promise<void> {
		if (!this.relPath) {
			throw new Error("Required values not set")
		}

		this.newContent = accumulatedContent

		if (isFinal) {
			// For CLI, we just store the final content - no streaming UI needed
			const absolutePath = path.resolve(this.cwd, this.relPath)
			await fs.writeFile(absolutePath, accumulatedContent, "utf-8")
		}
	}

	async saveChanges(): Promise<{
		newProblemsMessage: string | undefined
		userEdits: string | undefined
		finalContent: string | undefined
	}> {
		if (!this.relPath || !this.newContent) {
			return { newProblemsMessage: undefined, userEdits: undefined, finalContent: undefined }
		}

		const absolutePath = path.resolve(this.cwd, this.relPath)
		const finalContent = await fs.readFile(absolutePath, "utf-8")

		// For CLI, we don't have diagnostics or user editing capabilities
		// so we return minimal information
		this.newProblemsMessage = undefined
		this.userEdits = undefined

		return {
			newProblemsMessage: undefined,
			userEdits: undefined,
			finalContent,
		}
	}

	async revertChanges(): Promise<void> {
		if (!this.relPath) {
			return
		}

		const absolutePath = path.resolve(this.cwd, this.relPath)
		const fileExists = this.editType === "modify"

		if (!fileExists) {
			// Delete the file we created
			try {
				await fs.unlink(absolutePath)
			} catch (error) {
				console.error(`Failed to delete file ${absolutePath}:`, error)
			}

			// Remove only the directories we created, in reverse order
			for (let i = this.createdDirs.length - 1; i >= 0; i--) {
				try {
					await fs.rmdir(this.createdDirs[i])
				} catch (error) {
					// Directory might not be empty or already deleted, that's okay
				}
			}
		} else {
			// Restore original content
			if (this.originalContent !== undefined) {
				await fs.writeFile(absolutePath, this.originalContent, "utf-8")
			}
		}

		await this.reset()
	}

	async pushToolWriteResult(task: any, cwd: string, isNewFile: boolean): Promise<string> {
		if (!this.relPath) {
			throw new Error("No file path available in CLIDiffViewProvider")
		}

		// Build simple XML response for CLI - no user feedback since there's no UI
		const xmlObj = {
			file_write_result: {
				path: this.relPath,
				operation: isNewFile ? "created" : "modified",
				problems: this.newProblemsMessage || undefined,
				notice: {
					i: [
						"File operation completed successfully",
						"Proceeding with the task using these changes as the new baseline.",
					],
				},
			},
		}

		const builder = new XMLBuilder({
			format: true,
			indentBy: "",
			suppressEmptyNode: true,
			processEntities: false,
			tagValueProcessor: (name, value) => {
				if (typeof value === "string") {
					return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
				}
				return value
			},
			attributeValueProcessor: (name, value) => {
				if (typeof value === "string") {
					return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
				}
				return value
			},
		})

		return builder.build(xmlObj)
	}

	scrollToFirstDiff(): void {
		// No-op for CLI - there's no visual diff to scroll to
	}

	async reset(): Promise<void> {
		this.isEditing = false
		this.relPath = undefined
		this.newContent = undefined
		this.originalContent = undefined
		this.editType = undefined
		this.createdDirs = []
		this.newProblemsMessage = undefined
		this.userEdits = undefined
	}
}
