/**
 * Workspace repository interface for managing project workspaces
 */

import { IRepository, QueryOptions } from "./IRepository"
import { Workspace, WorkspaceSettings, CreateWorkspaceRequest } from "../types/entities"

export interface CreateWorkspaceOptions {
	name?: string
	settings?: Partial<WorkspaceSettings>
	initializeDefaults?: boolean
}

export interface IWorkspaceRepository extends IRepository<Workspace> {
	/**
	 * Get the currently active workspace
	 */
	getCurrentWorkspace(): Promise<Workspace | null>

	/**
	 * Set the current active workspace
	 */
	setCurrentWorkspace(id: string): Promise<void>

	/**
	 * Get workspace by file system path
	 */
	getByPath(path: string): Promise<Workspace | null>

	/**
	 * Create workspace from a file system path
	 */
	createFromPath(path: string, options?: CreateWorkspaceOptions): Promise<Workspace>

	/**
	 * Get workspace settings
	 */
	getSettings(id: string): Promise<WorkspaceSettings>

	/**
	 * Update workspace settings
	 */
	updateSettings(id: string, settings: Partial<WorkspaceSettings>): Promise<void>

	/**
	 * Get all active workspaces
	 */
	getActiveWorkspaces(): Promise<Workspace[]>

	/**
	 * Activate a workspace
	 */
	activateWorkspace(id: string): Promise<void>

	/**
	 * Deactivate a workspace
	 */
	deactivateWorkspace(id: string): Promise<void>

	/**
	 * Import workspace configuration
	 */
	importWorkspace(config: any): Promise<Workspace>

	/**
	 * Export workspace configuration
	 */
	exportWorkspace(id: string): Promise<any>

	/**
	 * Validate workspace path
	 */
	validatePath(path: string): Promise<boolean>

	/**
	 * Get workspace statistics
	 */
	getWorkspaceStats(id: string): Promise<WorkspaceStats>
}

export interface WorkspaceStats {
	conversationCount: number
	messageCount: number
	taskCount: number
	contextCount: number
	lastActiveDate?: Date
	totalTokenUsage?: number
	diskUsage?: number
}
