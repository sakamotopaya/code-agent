import path from "path"
import { isBinaryFile } from "isbinaryfile"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { getReadablePath } from "../../utils/path"
import { countFileLines } from "../../integrations/misc/line-counter"
import { readLines } from "../../integrations/misc/read-lines"
import { extractTextFromFile, addLineNumbers } from "../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../services/tree-sitter"
import { parseXml } from "../../utils/xml"
import { IFileSystem } from "../interfaces/IFileSystem"

// Helper functions for interface-compatible file operations
async function countFileLinesWithInterface(fs: IFileSystem, filePath: string): Promise<number> {
	try {
		const content = await fs.readFile(filePath, "utf8")
		return content.split("\n").length
	} catch (error) {
		throw new Error(`File not found: ${filePath}`)
	}
}

async function isBinaryFileWithInterface(fs: IFileSystem, filePath: string): Promise<boolean> {
	try {
		// Read first 1KB to check for binary content
		const content = await fs.readFile(filePath, "utf8")
		const firstKB = content.slice(0, 1024)

		// Simple binary detection: look for null bytes or high percentage of non-printable chars
		if (firstKB.includes("\0")) {
			return true
		}

		let nonPrintableCount = 0
		for (let i = 0; i < firstKB.length; i++) {
			const code = firstKB.charCodeAt(i)
			// Count chars that are not printable ASCII (except newlines, tabs, etc.)
			if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
				nonPrintableCount++
			}
		}

		// If more than 30% non-printable, consider it binary
		return nonPrintableCount / firstKB.length > 0.3
	} catch (error) {
		// If we can't read as text, assume it's binary
		return true
	}
}

async function readLinesWithInterface(
	fs: IFileSystem,
	filePath: string,
	endLine?: number,
	startLine?: number,
): Promise<string> {
	try {
		const content = await fs.readFile(filePath, "utf8")
		const lines = content.split("\n")

		const effectiveStartLine = startLine === undefined ? 0 : Math.max(0, Math.floor(startLine))
		const effectiveEndLine = endLine === undefined ? lines.length - 1 : Math.floor(endLine)

		if (effectiveStartLine > effectiveEndLine) {
			throw new RangeError(
				`startLine (${effectiveStartLine}) must be less than or equal to endLine (${effectiveEndLine})`,
			)
		}

		if (effectiveStartLine >= lines.length) {
			throw new RangeError(
				`Line with index ${effectiveStartLine} does not exist in '${filePath}'. Note that line indexing is zero-based`,
			)
		}

		const selectedLines = lines.slice(effectiveStartLine, effectiveEndLine + 1)
		return selectedLines.join("\n")
	} catch (error) {
		if (error instanceof RangeError) {
			throw error
		}
		throw new Error(`Failed to read lines from ${filePath}: ${error}`)
	}
}

export function getReadFileToolDescription(blockName: string, blockParams: any): string {
	// Handle both single path and multiple files via args
	if (blockParams.args) {
		try {
			const parsed = parseXml(blockParams.args) as any
			const files = Array.isArray(parsed.file) ? parsed.file : [parsed.file].filter(Boolean)
			const paths = files.map((f: any) => f?.path).filter(Boolean) as string[]

			if (paths.length === 0) {
				return `[${blockName} with no valid paths]`
			} else if (paths.length === 1) {
				// Modified part for single file
				return `[${blockName} for '${paths[0]}'. Reading multiple files at once is more efficient for the LLM. If other files are relevant to your current task, please read them simultaneously.]`
			} else if (paths.length <= 3) {
				const pathList = paths.map((p) => `'${p}'`).join(", ")
				return `[${blockName} for ${pathList}]`
			} else {
				return `[${blockName} for ${paths.length} files]`
			}
		} catch (error) {
			console.error("Failed to parse read_file args XML for description:", error)
			return `[${blockName} with unparseable args]`
		}
	} else if (blockParams.path) {
		// Fallback for legacy single-path usage
		// Modified part for single file (legacy)
		return `[${blockName} for '${blockParams.path}'. Reading multiple files at once is more efficient for the LLM. If other files are relevant to your current task, please read them simultaneously.]`
	} else {
		return `[${blockName} with missing path/args]`
	}
}
// Types
interface LineRange {
	start: number
	end: number
}

interface FileEntry {
	path?: string
	lineRanges?: LineRange[]
}

// New interface to track file processing state
interface FileResult {
	path: string
	status: "approved" | "denied" | "blocked" | "error" | "pending"
	content?: string
	error?: string
	notice?: string
	lineRanges?: LineRange[]
	xmlContent?: string // Final XML content for this file
	feedbackText?: string // User feedback text from approval/denial
	feedbackImages?: any[] // User feedback images from approval/denial
}

export async function readFileTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	_removeClosingTag: RemoveClosingTag,
) {
	const argsXmlTag: string | undefined = block.params.args
	const legacyPath: string | undefined = block.params.path
	const legacyStartLineStr: string | undefined = block.params.start_line
	const legacyEndLineStr: string | undefined = block.params.end_line

	// Handle partial message first
	if (block.partial) {
		let filePath = ""
		// Prioritize args for partial, then legacy path
		if (argsXmlTag) {
			const match = argsXmlTag.match(/<file>.*?<path>([^<]+)<\/path>/s)
			if (match) filePath = match[1]
		}
		if (!filePath && legacyPath) {
			// If args didn't yield a path, try legacy
			filePath = legacyPath
		}

		const fullPath = filePath ? cline.fs.resolve(filePath) : ""
		const sharedMessageProps: ClineSayTool = {
			tool: "readFile",
			path: getReadablePath(cline.cwd, filePath),
			isOutsideWorkspace: filePath ? isPathOutsideWorkspace(fullPath) : false,
		}
		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			content: undefined,
		} satisfies ClineSayTool)
		await cline.ask("tool", partialMessage, block.partial).catch(() => {})
		return
	}

	const fileEntries: FileEntry[] = []

	if (argsXmlTag) {
		// Parse file entries from XML (new multi-file format)
		try {
			const parsed = parseXml(argsXmlTag) as any
			const files = Array.isArray(parsed.file) ? parsed.file : [parsed.file].filter(Boolean)

			for (const file of files) {
				if (!file.path) continue // Skip if no path in a file entry

				const fileEntry: FileEntry = {
					path: file.path,
					lineRanges: [],
				}

				if (file.line_range) {
					const ranges = Array.isArray(file.line_range) ? file.line_range : [file.line_range]
					for (const range of ranges) {
						const match = String(range).match(/(\d+)-(\d+)/) // Ensure range is treated as string
						if (match) {
							const [, start, end] = match.map(Number)
							if (!isNaN(start) && !isNaN(end)) {
								fileEntry.lineRanges?.push({ start, end })
							}
						}
					}
				}
				fileEntries.push(fileEntry)
			}
		} catch (error) {
			const errorMessage = `Failed to parse read_file XML args: ${error instanceof Error ? error.message : String(error)}`
			await handleError("parsing read_file args", new Error(errorMessage))
			pushToolResult(`<files><error>${errorMessage}</error></files>`)
			return
		}
	} else if (legacyPath) {
		// Handle legacy single file path as a fallback
		console.warn("[readFileTool] Received legacy 'path' parameter. Consider updating to use 'args' structure.")

		const fileEntry: FileEntry = {
			path: legacyPath,
			lineRanges: [],
		}

		if (legacyStartLineStr && legacyEndLineStr) {
			const start = parseInt(legacyStartLineStr, 10)
			const end = parseInt(legacyEndLineStr, 10)
			if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
				fileEntry.lineRanges?.push({ start, end })
			} else {
				console.warn(
					`[readFileTool] Invalid legacy line range for ${legacyPath}: start='${legacyStartLineStr}', end='${legacyEndLineStr}'`,
				)
			}
		}
		fileEntries.push(fileEntry)
	}

	// If, after trying both new and legacy, no valid file entries are found.
	if (fileEntries.length === 0) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("read_file")
		const errorMsg = await cline.sayAndCreateMissingParamError("read_file", "args (containing valid file paths)")
		pushToolResult(`<files><error>${errorMsg}</error></files>`)
		return
	}

	// Create an array to track the state of each file
	const fileResults: FileResult[] = fileEntries.map((entry) => ({
		path: entry.path || "",
		status: "pending",
		lineRanges: entry.lineRanges,
	}))

	// Function to update file result status
	const updateFileResult = (path: string, updates: Partial<FileResult>) => {
		const index = fileResults.findIndex((result) => result.path === path)
		if (index !== -1) {
			fileResults[index] = { ...fileResults[index], ...updates }
		}
	}

	try {
		// First validate all files and prepare for batch approval
		const filesToApprove: FileResult[] = []

		for (let i = 0; i < fileResults.length; i++) {
			const fileResult = fileResults[i]
			const relPath = fileResult.path
			const fullPath = cline.fs.resolve(relPath)

			// Validate line ranges first
			if (fileResult.lineRanges) {
				let hasRangeError = false
				for (const range of fileResult.lineRanges) {
					if (range.start > range.end) {
						const errorMsg = "Invalid line range: end line cannot be less than start line"
						updateFileResult(relPath, {
							status: "blocked",
							error: errorMsg,
							xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
						})
						await handleError(`reading file ${relPath}`, new Error(errorMsg))
						hasRangeError = true
						break
					}
					if (isNaN(range.start) || isNaN(range.end)) {
						const errorMsg = "Invalid line range values"
						updateFileResult(relPath, {
							status: "blocked",
							error: errorMsg,
							xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
						})
						await handleError(`reading file ${relPath}`, new Error(errorMsg))
						hasRangeError = true
						break
					}
				}
				if (hasRangeError) continue
			}

			// Then check RooIgnore validation
			if (fileResult.status === "pending") {
				const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
				if (!accessAllowed) {
					await cline.say("rooignore_error", relPath)
					const errorMsg = formatResponse.rooIgnoreError(relPath)
					updateFileResult(relPath, {
						status: "blocked",
						error: errorMsg,
						xmlContent: `<file><path>${relPath}</path><error>${errorMsg}</error></file>`,
					})
					continue
				}

				// Add to files that need approval
				filesToApprove.push(fileResult)
			}
		}

		// Handle batch approval if there are multiple files to approve
		if (filesToApprove.length > 1) {
			// Get state from provider in VSCode mode, use defaults in CLI mode
			let maxReadFileLine = -1
			if (cline.providerRef) {
				try {
					const state = await cline.providerRef.deref()?.getState()
					maxReadFileLine = state?.maxReadFileLine ?? -1
				} catch (error) {
					// Use default if state access fails (likely CLI mode)
					maxReadFileLine = -1
				}
			}

			// Prepare batch file data
			const batchFiles = filesToApprove.map((fileResult) => {
				const relPath = fileResult.path
				const fullPath = cline.fs.resolve(relPath)
				const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

				// Create line snippet for this file
				let lineSnippet = ""
				if (fileResult.lineRanges && fileResult.lineRanges.length > 0) {
					const ranges = fileResult.lineRanges.map((range) =>
						t("tools:readFile.linesRange", { start: range.start, end: range.end }),
					)
					lineSnippet = ranges.join(", ")
				} else if (maxReadFileLine === 0) {
					lineSnippet = t("tools:readFile.definitionsOnly")
				} else if (maxReadFileLine > 0) {
					lineSnippet = t("tools:readFile.maxLines", { max: maxReadFileLine })
				}

				const readablePath = getReadablePath(cline.cwd, relPath)
				const key = `${readablePath}${lineSnippet ? ` (${lineSnippet})` : ""}`

				return {
					path: readablePath,
					lineSnippet,
					isOutsideWorkspace,
					key,
					content: fullPath, // Include full path for content
				}
			})

			const completeMessage = JSON.stringify({
				tool: "readFile",
				batchFiles,
			} satisfies ClineSayTool)

			// In CLI mode, use the askApproval function which auto-approves
			// In VSCode mode, this will show the appropriate UI
			const approved = await askApproval("tool", completeMessage)

			if (approved) {
				// Approve all files
				filesToApprove.forEach((fileResult) => {
					updateFileResult(fileResult.path, {
						status: "approved",
					})
				})
			} else {
				// Deny all files
				cline.didRejectTool = true
				filesToApprove.forEach((fileResult) => {
					updateFileResult(fileResult.path, {
						status: "denied",
						xmlContent: `<file><path>${fileResult.path}</path><status>Denied by user</status></file>`,
					})
				})
			}

			// TODO: Skip the complex individual permissions handling for now
			// This code is temporarily disabled and should be implemented properly
			/*
			// Handle individual permissions from objectResponse
			try {
				const individualPermissions = JSON.parse("{}")
				let hasAnyDenial = false

				batchFiles.forEach((batchFile, index) => {
					const fileResult = filesToApprove[index]
					const approved = individualPermissions[batchFile.key] === true

					if (approved) {
						updateFileResult(fileResult.path, {
							status: "approved",
						})
					} else {
						hasAnyDenial = true
						updateFileResult(fileResult.path, {
							status: "denied",
							xmlContent: `<file><path>${fileResult.path}</path><status>Denied by user</status></file>`,
						})
						}
					})

					if (hasAnyDenial) {
						cline.didRejectTool = true
					}
				} catch (error) {
					// Fallback: if JSON parsing fails, deny all files
					console.error("Failed to parse individual permissions:", error)
					cline.didRejectTool = true
					filesToApprove.forEach((fileResult) => {
						updateFileResult(fileResult.path, {
							status: "denied",
							xmlContent: `<file><path>${fileResult.path}</path><status>Denied by user</status></file>`,
						})
					})
				}
			*/
		} else if (filesToApprove.length === 1) {
			// Handle single file approval (existing logic)
			const fileResult = filesToApprove[0]
			const relPath = fileResult.path
			const fullPath = cline.fs.resolve(relPath)
			const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)
			// Get state from provider in VSCode mode, use defaults in CLI mode
			let maxReadFileLine = -1
			if (cline.providerRef) {
				try {
					const state = await cline.providerRef.deref()?.getState()
					maxReadFileLine = state?.maxReadFileLine ?? -1
				} catch (error) {
					// Use default if state access fails (likely CLI mode)
					maxReadFileLine = -1
				}
			}

			// Create line snippet for approval message
			let lineSnippet = ""
			if (fileResult.lineRanges && fileResult.lineRanges.length > 0) {
				const ranges = fileResult.lineRanges.map((range) =>
					t("tools:readFile.linesRange", { start: range.start, end: range.end }),
				)
				lineSnippet = ranges.join(", ")
			} else if (maxReadFileLine === 0) {
				lineSnippet = t("tools:readFile.definitionsOnly")
			} else if (maxReadFileLine > 0) {
				lineSnippet = t("tools:readFile.maxLines", { max: maxReadFileLine })
			}

			const completeMessage = JSON.stringify({
				tool: "readFile",
				path: getReadablePath(cline.cwd, relPath),
				isOutsideWorkspace,
				content: fullPath,
				reason: lineSnippet,
			} satisfies ClineSayTool)

			// In CLI mode, use the askApproval function which auto-approves
			// In VSCode mode, this will show the appropriate UI
			const approved = await askApproval("tool", completeMessage)

			if (!approved) {
				// Handle denial
				cline.didRejectTool = true

				updateFileResult(relPath, {
					status: "denied",
					xmlContent: `<file><path>${relPath}</path><status>Denied by user</status></file>`,
				})
			} else {
				// Handle approval
				updateFileResult(relPath, {
					status: "approved",
					feedbackText: undefined,
					feedbackImages: undefined,
				})
			}
		}

		// Then process only approved files
		for (const fileResult of fileResults) {
			// Skip files that weren't approved
			if (fileResult.status !== "approved") {
				continue
			}

			const relPath = fileResult.path
			const fullPath = cline.fs.resolve(relPath)
			// Get state from provider in VSCode mode, use defaults in CLI mode
			let maxReadFileLine = 500
			if (cline.providerRef) {
				try {
					const state = await cline.providerRef.deref()?.getState()
					maxReadFileLine = state?.maxReadFileLine ?? 500
				} catch (error) {
					// Use default if state access fails (likely CLI mode)
					maxReadFileLine = 500
				}
			}

			// Process approved files
			try {
				const [totalLines, isBinary] = await Promise.all([
					countFileLinesWithInterface(cline.fs, fullPath),
					isBinaryFileWithInterface(cline.fs, fullPath),
				])

				// Handle binary files
				if (isBinary) {
					updateFileResult(relPath, {
						notice: "Binary file",
						xmlContent: `<file><path>${relPath}</path>\n<notice>Binary file</notice>\n</file>`,
					})
					continue
				}

				// Handle range reads (bypass maxReadFileLine)
				if (fileResult.lineRanges && fileResult.lineRanges.length > 0) {
					const rangeResults: string[] = []
					for (const range of fileResult.lineRanges) {
						const content = addLineNumbers(
							await readLinesWithInterface(cline.fs, fullPath, range.end - 1, range.start - 1),
							range.start,
						)
						const lineRangeAttr = ` lines="${range.start}-${range.end}"`
						rangeResults.push(`<content${lineRangeAttr}>\n${content}</content>`)
					}
					updateFileResult(relPath, {
						xmlContent: `<file><path>${relPath}</path>\n${rangeResults.join("\n")}\n</file>`,
					})
					continue
				}

				// Handle definitions-only mode
				if (maxReadFileLine === 0) {
					try {
						const defResult = await parseSourceCodeDefinitionsForFile(fullPath, cline.rooIgnoreController)
						if (defResult) {
							let xmlInfo = `<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines. Use line_range if you need to read more lines</notice>\n`
							updateFileResult(relPath, {
								xmlContent: `<file><path>${relPath}</path>\n<list_code_definition_names>${defResult}</list_code_definition_names>\n${xmlInfo}</file>`,
							})
						}
					} catch (error) {
						if (error instanceof Error && error.message.startsWith("Unsupported language:")) {
							console.warn(`[read_file] Warning: ${error.message}`)
						} else {
							console.error(
								`[read_file] Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					}
					continue
				}

				// Handle files exceeding line threshold
				if (maxReadFileLine > 0 && totalLines > maxReadFileLine) {
					const content = addLineNumbers(
						await readLinesWithInterface(cline.fs, fullPath, maxReadFileLine - 1, 0),
					)
					const lineRangeAttr = ` lines="1-${maxReadFileLine}"`
					let xmlInfo = `<content${lineRangeAttr}>\n${content}</content>\n`

					try {
						const defResult = await parseSourceCodeDefinitionsForFile(fullPath, cline.rooIgnoreController)
						if (defResult) {
							xmlInfo += `<list_code_definition_names>${defResult}</list_code_definition_names>\n`
						}
						xmlInfo += `<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines. Use line_range if you need to read more lines</notice>\n`
						updateFileResult(relPath, {
							xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}</file>`,
						})
					} catch (error) {
						if (error instanceof Error && error.message.startsWith("Unsupported language:")) {
							console.warn(`[read_file] Warning: ${error.message}`)
						} else {
							console.error(
								`[read_file] Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					}
					continue
				}

				// Handle normal file read
				const content = await extractTextFromFile(fullPath)
				const lineRangeAttr = ` lines="1-${totalLines}"`
				let xmlInfo = totalLines > 0 ? `<content${lineRangeAttr}>\n${content}</content>\n` : `<content/>`

				if (totalLines === 0) {
					xmlInfo += `<notice>File is empty</notice>\n`
				}

				// Track file read
				await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

				updateFileResult(relPath, {
					xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}</file>`,
				})
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error)
				updateFileResult(relPath, {
					status: "error",
					error: `Error reading file: ${errorMsg}`,
					xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
				})
				await handleError(`reading file ${relPath}`, error instanceof Error ? error : new Error(errorMsg))
			}
		}

		// Generate final XML result from all file results
		const xmlResults = fileResults.filter((result) => result.xmlContent).map((result) => result.xmlContent)
		const filesXml = `<files>\n${xmlResults.join("\n")}\n</files>`

		// Process all feedback in a unified way without branching
		let statusMessage = ""
		let feedbackImages: any[] = []

		// Handle denial with feedback (highest priority)
		const deniedWithFeedback = fileResults.find((result) => result.status === "denied" && result.feedbackText)

		if (deniedWithFeedback && deniedWithFeedback.feedbackText) {
			statusMessage = formatResponse.toolDeniedWithFeedback(deniedWithFeedback.feedbackText)
			feedbackImages = deniedWithFeedback.feedbackImages || []
		}
		// Handle generic denial
		else if (cline.didRejectTool) {
			statusMessage = formatResponse.toolDenied()
		}
		// Handle approval with feedback
		else {
			const approvedWithFeedback = fileResults.find(
				(result) => result.status === "approved" && result.feedbackText,
			)

			if (approvedWithFeedback && approvedWithFeedback.feedbackText) {
				statusMessage = formatResponse.toolApprovedWithFeedback(approvedWithFeedback.feedbackText)
				feedbackImages = approvedWithFeedback.feedbackImages || []
			}
		}

		// Push the result with appropriate formatting
		if (statusMessage) {
			const result = formatResponse.toolResult(statusMessage, feedbackImages)

			// Handle different return types from toolResult
			if (typeof result === "string") {
				pushToolResult(`${result}\n${filesXml}`)
			} else {
				// For block-based results, we need to convert the filesXml to a text block and append it
				const textBlock = { type: "text" as const, text: filesXml }
				pushToolResult([...result, textBlock])
			}
		} else {
			// No status message, just push the files XML
			pushToolResult(filesXml)
		}
	} catch (error) {
		// Handle all errors using per-file format for consistency
		const relPath = fileEntries[0]?.path || "unknown"
		const errorMsg = error instanceof Error ? error.message : String(error)

		// If we have file results, update the first one with the error
		if (fileResults.length > 0) {
			updateFileResult(relPath, {
				status: "error",
				error: `Error reading file: ${errorMsg}`,
				xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
			})
		}

		await handleError(`reading file ${relPath}`, error instanceof Error ? error : new Error(errorMsg))

		// Generate final XML result from all file results
		const xmlResults = fileResults.filter((result) => result.xmlContent).map((result) => result.xmlContent)

		pushToolResult(`<files>\n${xmlResults.join("\n")}\n</files>`)
	}
}
