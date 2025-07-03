/**
 * Native context repository implementation using existing storage services
 */

import {
	IContextRepository,
	ContextQueryOptions,
	GitContextData,
	EnvironmentContextData,
	ContextStats,
} from "../../interfaces/IContextRepository"
import { QueryOptions } from "../../interfaces/IRepository"
import { Context, ContextType, ContextData, CreateContextRequest } from "../../types/entities"
import { NativeServicesConfig } from "../../RepositoryFactory"
import { IStorageService } from "../../../interfaces/IStorageService"
import * as crypto from "crypto"

export class NativeContextRepository implements IContextRepository {
	private storageService: IStorageService
	private readonly CONTEXTS_KEY = "contexts"

	constructor(services: NativeServicesConfig) {
		this.storageService = services.storageService
	}

	async initialize(): Promise<void> {
		// Initialize storage if needed
	}

	async dispose(): Promise<void> {
		// Cleanup if needed
	}

	private generateId(): string {
		return crypto.randomUUID()
	}

	private async getContexts(): Promise<Record<string, Context>> {
		return (await this.storageService.getGlobalState<Record<string, Context>>(this.CONTEXTS_KEY)) || {}
	}

	private async saveContexts(contexts: Record<string, Context>): Promise<void> {
		await this.storageService.setGlobalState(this.CONTEXTS_KEY, contexts)
	}

	async get(id: string): Promise<Context | null> {
		const contexts = await this.getContexts()
		return contexts[id] || null
	}

	async create(entity: Omit<Context, "id" | "createdAt" | "updatedAt">): Promise<Context> {
		const now = new Date()
		const context: Context = {
			...entity,
			id: this.generateId(),
			createdAt: now,
			updatedAt: now,
		}

		const contexts = await this.getContexts()
		contexts[context.id] = context
		await this.saveContexts(contexts)

		return context
	}

	async update(id: string, updates: Partial<Context>): Promise<Context> {
		const contexts = await this.getContexts()
		const existing = contexts[id]
		if (!existing) {
			throw new Error(`Context with id ${id} not found`)
		}

		const updated: Context = {
			...existing,
			...updates,
			id, // Ensure ID doesn't change
			updatedAt: new Date(),
		}

		contexts[id] = updated
		await this.saveContexts(contexts)

		return updated
	}

	async delete(id: string): Promise<void> {
		const contexts = await this.getContexts()
		if (!contexts[id]) {
			throw new Error(`Context with id ${id} not found`)
		}

		delete contexts[id]
		await this.saveContexts(contexts)
	}

	async list(options?: QueryOptions): Promise<Context[]> {
		const contexts = await this.getContexts()
		let result = Object.values(contexts)

		// Apply filters
		if (options?.filters) {
			result = result.filter((context) => {
				return Object.entries(options.filters!).every(([key, value]) => {
					return (context as any)[key] === value
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
		const contexts = await this.getContexts()
		return id in contexts
	}

	async getMany(ids: string[]): Promise<(Context | null)[]> {
		const contexts = await this.getContexts()
		return ids.map((id) => contexts[id] || null)
	}

	async createMany(entities: Omit<Context, "id" | "createdAt" | "updatedAt">[]): Promise<Context[]> {
		const now = new Date()
		const newContexts = entities.map((entity) => ({
			...entity,
			id: this.generateId(),
			createdAt: now,
			updatedAt: now,
		}))

		const contexts = await this.getContexts()
		newContexts.forEach((context) => {
			contexts[context.id] = context
		})
		await this.saveContexts(contexts)

		return newContexts
	}

	async updateMany(updates: Array<{ id: string; data: Partial<Context> }>): Promise<Context[]> {
		const contexts = await this.getContexts()
		const updated: Context[] = []

		for (const { id, data } of updates) {
			const existing = contexts[id]
			if (existing) {
				const updatedContext = {
					...existing,
					...data,
					id,
					updatedAt: new Date(),
				}
				contexts[id] = updatedContext
				updated.push(updatedContext)
			}
		}

		await this.saveContexts(contexts)
		return updated
	}

	async deleteMany(ids: string[]): Promise<void> {
		const contexts = await this.getContexts()
		ids.forEach((id) => {
			if (contexts[id]) {
				delete contexts[id]
			}
		})
		await this.saveContexts(contexts)
	}

	async count(options?: QueryOptions): Promise<number> {
		const contexts = await this.list(options)
		return contexts.length
	}

	async getContextsByWorkspace(workspaceId: string, options?: ContextQueryOptions): Promise<Context[]> {
		return await this.list({
			...options,
			filters: { ...options?.filters, workspaceId },
		})
	}

	async getContextsByType(type: ContextType, workspaceId?: string): Promise<Context[]> {
		const filters: any = { type }
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}
		return await this.list({ filters })
	}

	async getActiveContexts(workspaceId: string): Promise<Context[]> {
		return await this.list({
			filters: { workspaceId, isActive: true },
		})
	}

	async activateContext(id: string): Promise<void> {
		await this.update(id, { isActive: true })
	}

	async deactivateContext(id: string): Promise<void> {
		await this.update(id, { isActive: false })
	}

	async getContextByPath(workspaceId: string, path: string): Promise<Context | null> {
		const contexts = await this.getContextsByWorkspace(workspaceId)
		return contexts.find((ctx) => ctx.data.path === path) || null
	}

	async updateContextData(id: string, data: Partial<ContextData>): Promise<void> {
		const context = await this.get(id)
		if (!context) {
			throw new Error(`Context with id ${id} not found`)
		}

		await this.update(id, {
			data: {
				...context.data,
				...data,
			},
		})
	}

	async searchContexts(workspaceId: string, query: string): Promise<Context[]> {
		const contexts = await this.getContextsByWorkspace(workspaceId)
		const lowerQuery = query.toLowerCase()

		return contexts.filter((context) => {
			return (
				context.name.toLowerCase().includes(lowerQuery) ||
				context.description?.toLowerCase().includes(lowerQuery) ||
				JSON.stringify(context.data).toLowerCase().includes(lowerQuery)
			)
		})
	}

	async getFileContexts(workspaceId: string): Promise<Context[]> {
		return await this.getContextsByType("file", workspaceId)
	}

	async addFileContext(workspaceId: string, filePath: string, content?: string): Promise<Context> {
		return await this.create({
			workspaceId,
			type: "file",
			name: filePath,
			description: `File context for ${filePath}`,
			data: {
				path: filePath,
				content,
				metadata: {
					fileType: filePath.split(".").pop(),
					addedAt: new Date().toISOString(),
				},
			},
			isActive: true,
		})
	}

	async removeFileContext(workspaceId: string, filePath: string): Promise<void> {
		const context = await this.getContextByPath(workspaceId, filePath)
		if (context) {
			await this.delete(context.id)
		}
	}

	async updateFileContext(workspaceId: string, filePath: string, content: string): Promise<void> {
		const context = await this.getContextByPath(workspaceId, filePath)
		if (context) {
			await this.updateContextData(context.id, { content })
		}
	}

	async getDirectoryContexts(workspaceId: string): Promise<Context[]> {
		return await this.getContextsByType("directory", workspaceId)
	}

	async addDirectoryContext(workspaceId: string, dirPath: string, metadata?: Record<string, any>): Promise<Context> {
		return await this.create({
			workspaceId,
			type: "directory",
			name: dirPath,
			description: `Directory context for ${dirPath}`,
			data: {
				path: dirPath,
				metadata: {
					...metadata,
					addedAt: new Date().toISOString(),
				},
			},
			isActive: true,
		})
	}

	async getGitContext(workspaceId: string): Promise<Context | null> {
		const gitContexts = await this.getContextsByType("git", workspaceId)
		return gitContexts[0] || null
	}

	async updateGitContext(workspaceId: string, gitData: GitContextData): Promise<Context> {
		const existing = await this.getGitContext(workspaceId)

		if (existing) {
			return await this.update(existing.id, { data: gitData })
		} else {
			return await this.create({
				workspaceId,
				type: "git",
				name: "Git Context",
				description: "Git repository context",
				data: gitData,
				isActive: true,
			})
		}
	}

	async getEnvironmentContext(workspaceId: string): Promise<Context | null> {
		const envContexts = await this.getContextsByType("environment", workspaceId)
		return envContexts[0] || null
	}

	async updateEnvironmentContext(workspaceId: string, envData: EnvironmentContextData): Promise<Context> {
		const existing = await this.getEnvironmentContext(workspaceId)

		if (existing) {
			return await this.update(existing.id, { data: envData })
		} else {
			return await this.create({
				workspaceId,
				type: "environment",
				name: "Environment Context",
				description: "Environment and system context",
				data: envData,
				isActive: true,
			})
		}
	}

	async createCustomContext(workspaceId: string, name: string, data: ContextData): Promise<Context> {
		return await this.create({
			workspaceId,
			type: "custom",
			name,
			description: `Custom context: ${name}`,
			data,
			isActive: true,
		})
	}

	async getContextReferences(id: string): Promise<string[]> {
		const context = await this.get(id)
		if (!context) {
			return []
		}
		return context.data.references || []
	}

	async addContextReference(id: string, reference: string): Promise<void> {
		const context = await this.get(id)
		if (!context) {
			throw new Error(`Context with id ${id} not found`)
		}

		const references = context.data.references || []
		if (!references.includes(reference)) {
			references.push(reference)
			await this.updateContextData(id, { references })
		}
	}

	async removeContextReference(id: string, reference: string): Promise<void> {
		const context = await this.get(id)
		if (!context) {
			throw new Error(`Context with id ${id} not found`)
		}

		const references = context.data.references || []
		const index = references.indexOf(reference)
		if (index > -1) {
			references.splice(index, 1)
			await this.updateContextData(id, { references })
		}
	}

	async getContextStats(workspaceId: string): Promise<ContextStats> {
		const contexts = await this.getContextsByWorkspace(workspaceId)
		const activeContexts = contexts.filter((ctx) => ctx.isActive)

		const contextsByType = contexts.reduce(
			(acc, ctx) => {
				acc[ctx.type] = (acc[ctx.type] || 0) + 1
				return acc
			},
			{} as Record<ContextType, number>,
		)

		const totalSize = contexts.reduce((size, ctx) => {
			return size + JSON.stringify(ctx.data).length
		}, 0)

		// Find most recently used and largest contexts
		const sortedByDate = contexts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
		const sortedBySize = contexts.sort((a, b) => JSON.stringify(b.data).length - JSON.stringify(a.data).length)

		return {
			totalContexts: contexts.length,
			activeContexts: activeContexts.length,
			contextsByType,
			mostRecentlyUsed: sortedByDate[0],
			largestContext: sortedBySize[0],
			totalSize,
		}
	}

	async cleanupInactiveContexts(workspaceId: string, olderThan: Date): Promise<number> {
		const contexts = await this.getContextsByWorkspace(workspaceId)
		const toDelete = contexts.filter((ctx) => !ctx.isActive && ctx.updatedAt < olderThan)

		await this.deleteMany(toDelete.map((ctx) => ctx.id))
		return toDelete.length
	}

	async exportContexts(workspaceId: string): Promise<any> {
		const contexts = await this.getContextsByWorkspace(workspaceId)
		return {
			contexts,
			exportedAt: new Date().toISOString(),
			workspaceId,
		}
	}

	async importContexts(workspaceId: string, data: any): Promise<Context[]> {
		const contextsToImport = data.contexts || []
		return await this.createMany(
			contextsToImport.map((ctx: any) => ({
				...ctx,
				workspaceId,
				id: undefined, // Will be generated
				createdAt: undefined,
				updatedAt: undefined,
			})),
		)
	}
}
