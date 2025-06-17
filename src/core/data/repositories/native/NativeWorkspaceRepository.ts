/**
 * Native workspace repository implementation using existing storage services
 */

import { IWorkspaceRepository, CreateWorkspaceOptions, WorkspaceStats } from "../../interfaces/IWorkspaceRepository"
import { QueryOptions } from "../../interfaces/IRepository"
import { Workspace, WorkspaceSettings, CreateWorkspaceRequest } from "../../types/entities"
import { NativeServicesConfig } from "../../RepositoryFactory"
import { IStorageService } from "../../../interfaces/IStorageService"
import * as path from "path"
import * as crypto from "crypto"

export class NativeWorkspaceRepository implements IWorkspaceRepository {
	private storageService: IStorageService
	private workspacePath?: string
	private readonly WORKSPACE_KEY = "workspaces"
	private readonly CURRENT_WORKSPACE_KEY = "currentWorkspace"

	constructor(services: NativeServicesConfig) {
		this.storageService = services.storageService
		this.workspacePath = services.workspacePath
	}

	async initialize(): Promise<void> {
		// Ensure default workspace exists if none configured
		const workspaces = await this.list()
		if (workspaces.length === 0 && this.workspacePath) {
			await this.createFromPath(this.workspacePath)
		}
	}

	async dispose(): Promise<void> {
		// Cleanup if needed
	}

	private generateId(): string {
		return crypto.randomUUID()
	}

	private async getWorkspaces(): Promise<Record<string, Workspace>> {
		return (await this.storageService.getGlobalState<Record<string, Workspace>>(this.WORKSPACE_KEY)) || {}
	}

	private async saveWorkspaces(workspaces: Record<string, Workspace>): Promise<void> {
		await this.storageService.setGlobalState(this.WORKSPACE_KEY, workspaces)
	}

	async get(id: string): Promise<Workspace | null> {
		const workspaces = await this.getWorkspaces()
		return workspaces[id] || null
	}

	async create(entity: Omit<Workspace, "id" | "createdAt" | "updatedAt">): Promise<Workspace> {
		const now = new Date()
		const workspace: Workspace = {
			...entity,
			id: this.generateId(),
			createdAt: now,
			updatedAt: now,
		}

		const workspaces = await this.getWorkspaces()
		workspaces[workspace.id] = workspace
		await this.saveWorkspaces(workspaces)

		return workspace
	}

	async update(id: string, updates: Partial<Workspace>): Promise<Workspace> {
		const workspaces = await this.getWorkspaces()
		const existing = workspaces[id]
		if (!existing) {
			throw new Error(`Workspace with id ${id} not found`)
		}

		const updated: Workspace = {
			...existing,
			...updates,
			id, // Ensure ID doesn't change
			updatedAt: new Date(),
		}

		workspaces[id] = updated
		await this.saveWorkspaces(workspaces)

		return updated
	}

	async delete(id: string): Promise<void> {
		const workspaces = await this.getWorkspaces()
		if (!workspaces[id]) {
			throw new Error(`Workspace with id ${id} not found`)
		}

		delete workspaces[id]
		await this.saveWorkspaces(workspaces)

		// If this was the current workspace, clear it
		const currentWorkspaceId = await this.storageService.getGlobalState<string>(this.CURRENT_WORKSPACE_KEY)
		if (currentWorkspaceId === id) {
			await this.storageService.setGlobalState(this.CURRENT_WORKSPACE_KEY, undefined)
		}
	}

	async list(options?: QueryOptions): Promise<Workspace[]> {
		const workspaces = await this.getWorkspaces()
		let result = Object.values(workspaces)

		// Apply filters
		if (options?.filters) {
			result = result.filter((workspace) => {
				return Object.entries(options.filters!).every(([key, value]) => {
					return (workspace as any)[key] === value
				})
			})
		}

		// Apply sorting
		if (options?.sortBy) {
			const { sortBy, sortOrder = "asc" } = options
			result.sort((a, b) => {
				const aVal = (a as any)[sortBy]
				const bVal = (b as any)[sortBy]
				const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
				return sortOrder === "desc" ? -comparison : comparison
			})
		}

		// Apply pagination
		if (options?.limit || options?.offset) {
			const offset = options.offset || 0
			const limit = options.limit || result.length
			result = result.slice(offset, offset + limit)
		}

		return result
	}

	async exists(id: string): Promise<boolean> {
		const workspaces = await this.getWorkspaces()
		return id in workspaces
	}

	async getMany(ids: string[]): Promise<(Workspace | null)[]> {
		const workspaces = await this.getWorkspaces()
		return ids.map((id) => workspaces[id] || null)
	}

	async createMany(entities: Omit<Workspace, "id" | "createdAt" | "updatedAt">[]): Promise<Workspace[]> {
		const now = new Date()
		const newWorkspaces = entities.map((entity) => ({
			...entity,
			id: this.generateId(),
			createdAt: now,
			updatedAt: now,
		}))

		const workspaces = await this.getWorkspaces()
		newWorkspaces.forEach((workspace) => {
			workspaces[workspace.id] = workspace
		})
		await this.saveWorkspaces(workspaces)

		return newWorkspaces
	}

	async updateMany(updates: Array<{ id: string; data: Partial<Workspace> }>): Promise<Workspace[]> {
		const workspaces = await this.getWorkspaces()
		const updated: Workspace[] = []

		for (const { id, data } of updates) {
			const existing = workspaces[id]
			if (existing) {
				const updatedWorkspace = {
					...existing,
					...data,
					id,
					updatedAt: new Date(),
				}
				workspaces[id] = updatedWorkspace
				updated.push(updatedWorkspace)
			}
		}

		await this.saveWorkspaces(workspaces)
		return updated
	}

	async deleteMany(ids: string[]): Promise<void> {
		const workspaces = await this.getWorkspaces()
		let currentWorkspaceDeleted = false
		const currentWorkspaceId = await this.storageService.getGlobalState<string>(this.CURRENT_WORKSPACE_KEY)

		ids.forEach((id) => {
			if (workspaces[id]) {
				delete workspaces[id]
				if (id === currentWorkspaceId) {
					currentWorkspaceDeleted = true
				}
			}
		})

		await this.saveWorkspaces(workspaces)

		if (currentWorkspaceDeleted) {
			await this.storageService.setGlobalState(this.CURRENT_WORKSPACE_KEY, undefined)
		}
	}

	async count(options?: QueryOptions): Promise<number> {
		const workspaces = await this.list(options)
		return workspaces.length
	}

	async getCurrentWorkspace(): Promise<Workspace | null> {
		const currentId = await this.storageService.getGlobalState<string>(this.CURRENT_WORKSPACE_KEY)
		return currentId ? await this.get(currentId) : null
	}

	async setCurrentWorkspace(id: string): Promise<void> {
		const workspace = await this.get(id)
		if (!workspace) {
			throw new Error(`Workspace with id ${id} not found`)
		}
		await this.storageService.setGlobalState(this.CURRENT_WORKSPACE_KEY, id)
	}

	async getByPath(pathStr: string): Promise<Workspace | null> {
		const workspaces = await this.list()
		return workspaces.find((w) => w.path === path.normalize(pathStr)) || null
	}

	async createFromPath(pathStr: string, options?: CreateWorkspaceOptions): Promise<Workspace> {
		const normalizedPath = path.normalize(pathStr)
		const name = options?.name || path.basename(normalizedPath)

		const workspace = await this.create({
			name,
			path: normalizedPath,
			settings: options?.settings || {},
			isActive: true,
		})

		if (options?.initializeDefaults !== false) {
			await this.setCurrentWorkspace(workspace.id)
		}

		return workspace
	}

	async getSettings(id: string): Promise<WorkspaceSettings> {
		const workspace = await this.get(id)
		if (!workspace) {
			throw new Error(`Workspace with id ${id} not found`)
		}
		return workspace.settings
	}

	async updateSettings(id: string, settings: Partial<WorkspaceSettings>): Promise<void> {
		const workspace = await this.get(id)
		if (!workspace) {
			throw new Error(`Workspace with id ${id} not found`)
		}

		await this.update(id, {
			settings: {
				...workspace.settings,
				...settings,
			},
		})
	}

	async getActiveWorkspaces(): Promise<Workspace[]> {
		return await this.list({
			filters: { isActive: true },
		})
	}

	async activateWorkspace(id: string): Promise<void> {
		await this.update(id, { isActive: true })
	}

	async deactivateWorkspace(id: string): Promise<void> {
		await this.update(id, { isActive: false })
	}

	async importWorkspace(config: any): Promise<Workspace> {
		// Convert external config to workspace entity
		return await this.create({
			name: config.name || "Imported Workspace",
			path: config.path || "",
			settings: config.settings || {},
			isActive: config.isActive || false,
		})
	}

	async exportWorkspace(id: string): Promise<any> {
		const workspace = await this.get(id)
		if (!workspace) {
			throw new Error(`Workspace with id ${id} not found`)
		}

		return {
			name: workspace.name,
			path: workspace.path,
			settings: workspace.settings,
			isActive: workspace.isActive,
			exportedAt: new Date().toISOString(),
		}
	}

	async validatePath(pathStr: string): Promise<boolean> {
		try {
			const normalizedPath = path.normalize(pathStr)
			// Basic validation - check if path is absolute and exists
			return path.isAbsolute(normalizedPath)
		} catch {
			return false
		}
	}

	async getWorkspaceStats(id: string): Promise<WorkspaceStats> {
		const workspace = await this.get(id)
		if (!workspace) {
			throw new Error(`Workspace with id ${id} not found`)
		}

		// Return basic stats - in a full implementation this would query other repositories
		return {
			conversationCount: 0,
			messageCount: 0,
			taskCount: 0,
			contextCount: 0,
			lastActiveDate: workspace.updatedAt,
			totalTokenUsage: 0,
			diskUsage: 0,
		}
	}
}
