/**
 * Interface for diff view functionality that can be implemented for both VSCode and CLI contexts
 */
export interface IDiffViewProvider {
	/**
	 * Opens a diff view for editing a file
	 * @param relPath Relative path to the file
	 */
	open(relPath: string): Promise<void>

	/**
	 * Updates the content being edited
	 * @param accumulatedContent The accumulated content so far
	 * @param isFinal Whether this is the final update
	 */
	update(accumulatedContent: string, isFinal: boolean): Promise<void>

	/**
	 * Saves the changes and returns information about the operation
	 */
	saveChanges(): Promise<{
		newProblemsMessage: string | undefined
		userEdits: string | undefined
		finalContent: string | undefined
	}>

	/**
	 * Reverts any changes made
	 */
	revertChanges(): Promise<void>

	/**
	 * Resets the provider state
	 */
	reset(): Promise<void>

	/**
	 * Scrolls to the first difference in the diff view
	 */
	scrollToFirstDiff(): void

	/**
	 * Formats a standardized response for file write operations
	 * @param task The task instance
	 * @param cwd Current working directory for path resolution
	 * @param isNewFile Whether this is a new file or an existing file being modified
	 * @returns Formatted message for UI feedback
	 */
	pushToolWriteResult(task: any, cwd: string, isNewFile: boolean): Promise<string>

	/**
	 * Properties for storing operation results
	 */
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing: boolean
	originalContent: string | undefined
}
