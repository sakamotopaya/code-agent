/**
 * Context repository interface for managing workspace context
 */

import { IRepository, QueryOptions } from "./IRepository"
import { Context, ContextType, ContextData, CreateContextRequest } from "../types/entities"

export interface ContextQueryOptions extends QueryOptions {
	workspaceId?: string
	type?: ContextType
	isActive?: boolean
	path?: string
}

export interface IContextRepository extends IRepository<Context> {
	/**
	 * Get contexts by workspace
	 */
	getContextsByWorkspace(workspaceId: string, options?: ContextQueryOptions): Promise<Context[]>

	/**
	 * Get contexts by type
	 */
	getContextsByType(type: ContextType, workspaceId?: string): Promise<Context[]>

	/**
	 * Get active contexts for a workspace
	 */
	getActiveContexts(workspaceId: string): Promise<Context[]>

	/**
	 * Activate a context
	 */
	activateContext(id: string): Promise<void>

	/**
	 * Deactivate a context
	 */
	deactivateContext(id: string): Promise<void>

	/**
	 * Get context by path
	 */
	getContextByPath(workspaceId: string, path: string): Promise<Context | null>

	/**
	 * Update context data
	 */
	updateContextData(id: string, data: Partial<ContextData>): Promise<void>

	/**
	 * Search contexts
	 */
	searchContexts(workspaceId: string, query: string): Promise<Context[]>

	/**
	 * Get file contexts for a workspace
	 */
	getFileContexts(workspaceId: string): Promise<Context[]>

	/**
	 * Add file to context tracking
	 */
	addFileContext(workspaceId: string, filePath: string, content?: string): Promise<Context>

	/**
	 * Remove file from context tracking
	 */
	removeFileContext(workspaceId: string, filePath: string): Promise<void>

	/**
	 * Update file context content
	 */
	updateFileContext(workspaceId: string, filePath: string, content: string): Promise<void>

	/**
	 * Get directory contexts
	 */
	getDirectoryContexts(workspaceId: string): Promise<Context[]>

	/**
	 * Add directory to context tracking
	 */
	addDirectoryContext(workspaceId: string, dirPath: string, metadata?: Record<string, any>): Promise<Context>

	/**
	 * Get Git context for workspace
	 */
	getGitContext(workspaceId: string): Promise<Context | null>

	/**
	 * Update Git context
	 */
	updateGitContext(workspaceId: string, gitData: GitContextData): Promise<Context>

	/**
	 * Get environment context
	 */
	getEnvironmentContext(workspaceId: string): Promise<Context | null>

	/**
	 * Update environment context
	 */
	updateEnvironmentContext(workspaceId: string, envData: EnvironmentContextData): Promise<Context>

	/**
	 * Create custom context
	 */
	createCustomContext(workspaceId: string, name: string, data: ContextData): Promise<Context>

	/**
	 * Get context references
	 */
	getContextReferences(id: string): Promise<string[]>

	/**
	 * Add context reference
	 */
	addContextReference(id: string, reference: string): Promise<void>

	/**
	 * Remove context reference
	 */
	removeContextReference(id: string, reference: string): Promise<void>

	/**
	 * Get context usage statistics
	 */
	getContextStats(workspaceId: string): Promise<ContextStats>

	/**
	 * Clean up inactive contexts
	 */
	cleanupInactiveContexts(workspaceId: string, olderThan: Date): Promise<number>

	/**
	 * Export context data
	 */
	exportContexts(workspaceId: string): Promise<any>

	/**
	 * Import context data
	 */
	importContexts(workspaceId: string, data: any): Promise<Context[]>
}

export interface GitContextData extends ContextData {
	branch?: string
	commit?: string
	remotes?: string[]
	status?: string
	changedFiles?: string[]
}

export interface EnvironmentContextData extends ContextData {
	variables?: Record<string, string>
	platform?: string
	architecture?: string
	nodeVersion?: string
	workingDirectory?: string
}

export interface ContextStats {
	totalContexts: number
	activeContexts: number
	contextsByType: Record<ContextType, number>
	mostRecentlyUsed?: Context
	largestContext?: Context
	totalSize: number
}
