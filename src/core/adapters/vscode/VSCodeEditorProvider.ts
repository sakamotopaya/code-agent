import * as vscode from "vscode"
import path from "path"
import { IEditorProvider } from "../interfaces/IEditorProvider"

/**
 * VSCode implementation of IEditorProvider
 */
export class VSCodeEditorProvider implements IEditorProvider {
	getVisibleFilePaths(cwd: string, maxFiles: number = 200): string[] {
		return (
			vscode.window.visibleTextEditors
				?.map((editor) => editor.document?.uri?.fsPath)
				?.filter(Boolean)
				?.map((absolutePath) => path.relative(cwd, absolutePath))
				?.slice(0, maxFiles) || []
		)
	}

	getOpenTabPaths(cwd: string, maxTabs: number = 20): string[] {
		return vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(cwd, absolutePath).toPosix())
			.slice(0, maxTabs)
	}
}
