import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { getAllModes } from "../../shared/modes"
import { ModeConfig } from "@roo-code/types"

/**
 * Implements the list_modes tool.
 *
 * @param cline - The instance of Task that is executing this tool.
 * @param block - The block of assistant message content that specifies the
 *   parameters for this tool.
 * @param askApproval - A function that asks the user for approval to show a
 *   message.
 * @param handleError - A function that handles an error that occurred while
 *   executing this tool.
 * @param pushToolResult - A function that pushes the result of this tool to the
 *   conversation.
 * @param removeClosingTag - A function that removes a closing tag from a string.
 */

export async function listModesTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const filter: string | undefined = block.params.filter

	const sharedMessageProps: ClineSayTool = {
		tool: "listModes",
		path: getReadablePath(cline.cwd, "modes"),
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			cline.consecutiveMistakeCount = 0

			// Get all modes (built-in + custom)
			const customModes = await getCustomModesForContext(cline)
			const allModes = getAllModes(customModes)

			// Apply filtering if specified
			const filteredModes = filter
				? allModes.filter(
						(mode) =>
							mode.slug.toLowerCase().includes(filter.toLowerCase()) ||
							mode.name.toLowerCase().includes(filter.toLowerCase()) ||
							mode.roleDefinition?.toLowerCase().includes(filter.toLowerCase()) ||
							mode.whenToUse?.toLowerCase().includes(filter.toLowerCase()) ||
							mode.customInstructions?.toLowerCase().includes(filter.toLowerCase()),
					)
				: allModes

			const result = formatModesOutput(filteredModes, customModes, filter)

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: result } satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(result)
		}
	} catch (error) {
		await handleError("listing modes", error)
	}
}

/**
 * Get custom modes for the current context
 */
async function getCustomModesForContext(cline: Task): Promise<ModeConfig[]> {
	try {
		// Check if the Task instance has a custom modes service
		if (cline.customModesService) {
			const customModes = await cline.customModesService.loadCustomModes()
			return customModes
		}

		// Fallback: return empty array if no custom modes service is available
		return []
	} catch (error) {
		console.warn("Failed to load custom modes:", error)
		return []
	}
}

/**
 * Format the modes output for display
 */
function formatModesOutput(modes: ModeConfig[], customModes: ModeConfig[], filter?: string): string {
	const builtInModes = modes.filter((mode) => !isCustomMode(mode, customModes))
	const customModesFiltered = modes.filter((mode) => isCustomMode(mode, customModes))

	let output = "Available Modes:\n\n"

	// Built-in modes section
	if (builtInModes.length > 0) {
		output += "## Built-in Modes\n\n"
		for (const mode of builtInModes) {
			output += formatModeDetails(mode)
		}
	}

	// Custom modes section
	if (customModesFiltered.length > 0) {
		output += "## Custom Modes\n\n"
		for (const mode of customModesFiltered) {
			output += formatModeDetails(mode)
		}
	}

	// Summary
	const totalBuiltIn = builtInModes.length
	const totalCustom = customModesFiltered.length
	const totalModes = totalBuiltIn + totalCustom

	output += `\nTotal: ${totalModes} modes (${totalBuiltIn} built-in, ${totalCustom} custom)`

	if (filter) {
		output += `\nShowing ${modes.length} modes matching filter "${filter}"`
	}

	return output
}

/**
 * Format individual mode details
 */
function formatModeDetails(mode: ModeConfig): string {
	let output = `### ${mode.name} (${mode.slug})\n`

	if (mode.roleDefinition) {
		output += `- **Role**: ${mode.roleDefinition}\n`
	}

	if (mode.groups && mode.groups.length > 0) {
		const toolGroups = mode.groups
			.map((group) => {
				if (typeof group === "string") {
					return group
				} else {
					// Handle group with options (like file restrictions)
					const [groupName, options] = group
					if (options?.description) {
						return `${groupName} (${options.description})`
					}
					return groupName
				}
			})
			.join(", ")
		output += `- **Tools**: ${toolGroups}\n`
	}

	if (mode.whenToUse) {
		output += `- **When to Use**: ${mode.whenToUse}\n`
	}

	// Show if it's a custom mode and its source
	if (mode.source) {
		output += `- **Source**: Custom (${mode.source})\n`
	}

	if (mode.customInstructions) {
		// Truncate long custom instructions for readability
		const instructions =
			mode.customInstructions.length > 200
				? mode.customInstructions.substring(0, 200) + "..."
				: mode.customInstructions
		output += `- **Custom Instructions**: ${instructions}\n`
	}

	output += "\n"
	return output
}

/**
 * Check if a mode is a custom mode
 */
function isCustomMode(mode: ModeConfig, customModes: ModeConfig[]): boolean {
	return customModes.some((customMode) => customMode.slug === mode.slug)
}
