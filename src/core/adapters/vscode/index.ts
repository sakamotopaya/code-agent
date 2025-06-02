import * as vscode from "vscode"
import { CoreInterfaces, InterfaceFactory, InterfaceConfig } from "../../interfaces"
import { VsCodeUserInterface } from "./VsCodeUserInterface"
import { VsCodeFileSystem } from "./VsCodeFileSystem"
import { VsCodeTerminal } from "./VsCodeTerminal"
import { VsCodeBrowser } from "./VsCodeBrowser"

/**
 * Factory function to create VS Code adapter implementations
 * of the core interfaces.
 */
export const createVsCodeAdapters: InterfaceFactory = async (): Promise<CoreInterfaces> => {
	const context = getVsCodeContext()

	return {
		userInterface: new VsCodeUserInterface(context),
		fileSystem: new VsCodeFileSystem(context),
		terminal: new VsCodeTerminal(context),
		browser: new VsCodeBrowser(context),
	}
}

/**
 * Factory function with configuration options
 */
export const createVsCodeAdaptersWithConfig = async (config: InterfaceConfig): Promise<CoreInterfaces> => {
	const context = config.platform?.vscodeContext || getVsCodeContext()

	return {
		userInterface: new VsCodeUserInterface(context),
		fileSystem: new VsCodeFileSystem(context),
		terminal: new VsCodeTerminal(context),
		browser: new VsCodeBrowser(context),
	}
}

/**
 * Get the current VS Code extension context
 * This should be set by the extension when it activates
 */
let currentContext: vscode.ExtensionContext | undefined

export function setVsCodeContext(context: vscode.ExtensionContext): void {
	currentContext = context
}

export function getVsCodeContext(): vscode.ExtensionContext {
	if (!currentContext) {
		throw new Error("VS Code extension context not set. Call setVsCodeContext() first.")
	}
	return currentContext
}

/**
 * Re-export all adapter classes for direct use
 */
export { VsCodeUserInterface } from "./VsCodeUserInterface"
export { VsCodeFileSystem } from "./VsCodeFileSystem"
export { VsCodeTerminal } from "./VsCodeTerminal"
export { VsCodeBrowser } from "./VsCodeBrowser"
