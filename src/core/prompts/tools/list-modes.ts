import { ToolArgs } from "./types"

export function getListModesDescription(args: ToolArgs): string {
	return `## list_modes
Description: Request to list all available modes (both built-in and custom modes) with comprehensive details. This tool provides information about mode capabilities, tool groups, restrictions, and usage guidelines.

Parameters:
- filter: (optional) Filter modes by slug, name, or description (case-insensitive contains match)

Usage:
<list_modes>
<filter>optional filter text</filter>
</list_modes>

Examples:

1. List all modes:
<list_modes>
</list_modes>

2. Filter modes containing "code":
<list_modes>
<filter>code</filter>
</list_modes>`
}
