import { IEditorProvider } from "../interfaces/IEditorProvider"

/**
 * CLI implementation of IEditorProvider
 * In CLI context, there are no "visible files" or "open tabs" in the VSCode sense
 */
export class CLIEditorProvider implements IEditorProvider {
	getVisibleFilePaths(cwd: string, maxFiles: number = 200): string[] {
		// In CLI context, there are no visible files in the editor sense
		return []
	}

	getOpenTabPaths(cwd: string, maxTabs: number = 20): string[] {
		// In CLI context, there are no open tabs
		return []
	}
}
