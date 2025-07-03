/**
 * Native provider repository implementation wrapping ProviderSettingsManager
 */

import {
	IProviderRepository,
	ProviderQueryOptions,
	ConnectionTestResult,
	ModelInfo,
	ValidationResult,
	ValidationError,
	ValidationWarning,
	ProviderStats,
	DateRange,
} from "../../interfaces/IProviderRepository"
import { QueryOptions } from "../../interfaces/IRepository"
import { Provider, ProviderSettings, ProviderType } from "../../types/entities"
import { NativeServicesConfig } from "../../RepositoryFactory"
import { ProviderSettingsManager } from "../../../config/ProviderSettingsManager"
import { IStorageService } from "../../../interfaces/IStorageService"
import * as crypto from "crypto"

export class NativeProviderRepository implements IProviderRepository {
	private providerSettingsManager?: ProviderSettingsManager
	private storageService: IStorageService

	constructor(services: NativeServicesConfig) {
		this.providerSettingsManager = services.providerSettingsManager
		this.storageService = services.storageService
	}

	async initialize(): Promise<void> {
		if (this.providerSettingsManager && !this.providerSettingsManager.isInitialized) {
			await this.providerSettingsManager.waitForInitialization()
		}
	}

	async dispose(): Promise<void> {
		// Cleanup if needed
	}

	private generateId(): string {
		return crypto.randomUUID()
	}

	private async convertToProvider(profile: any): Promise<Provider> {
		const now = new Date()
		return {
			id: profile.id || this.generateId(),
			name: profile.name || "Unknown Provider",
			type: profile.apiProvider || "openai",
			apiKey: profile.apiKey || "",
			baseUrl: profile.apiBaseUrl,
			isDefault: false, // Will be determined by current config
			settings: {
				model: profile.apiModelId,
				temperature: profile.temperature,
				maxTokens: profile.maxTokens,
				rateLimitSeconds: profile.rateLimitSeconds,
				diffEnabled: profile.diffEnabled,
				fuzzyMatchThreshold: profile.fuzzyMatchThreshold,
				openAiHeaders: profile.openAiHeaders,
				...profile,
			},
			isActive: true,
			createdAt: now,
			updatedAt: now,
		}
	}

	async get(id: string): Promise<Provider | null> {
		if (!this.providerSettingsManager) {
			return null
		}

		try {
			const profile = await this.providerSettingsManager.getProfile({ id })
			return await this.convertToProvider(profile)
		} catch {
			return null
		}
	}

	async create(entity: Omit<Provider, "id" | "createdAt" | "updatedAt">): Promise<Provider> {
		if (!this.providerSettingsManager) {
			throw new Error("Provider settings manager not available")
		}

		const config = {
			apiProvider: entity.type,
			apiKey: entity.apiKey,
			apiBaseUrl: entity.baseUrl,
			apiModelId: entity.settings.model,
			temperature: entity.settings.temperature,
			maxTokens: entity.settings.maxTokens,
			rateLimitSeconds: entity.settings.rateLimitSeconds,
			diffEnabled: entity.settings.diffEnabled,
			fuzzyMatchThreshold: entity.settings.fuzzyMatchThreshold,
			openAiHeaders: entity.settings.openAiHeaders,
		}

		const id = await this.providerSettingsManager.saveConfig(entity.name, config)

		if (entity.isDefault) {
			await this.providerSettingsManager.activateProfile({ id })
		}

		return (await this.get(id)) as Provider
	}

	async update(id: string, updates: Partial<Provider>): Promise<Provider> {
		if (!this.providerSettingsManager) {
			throw new Error("Provider settings manager not available")
		}

		const existing = await this.get(id)
		if (!existing) {
			throw new Error(`Provider with id ${id} not found`)
		}

		const merged = { ...existing, ...updates }

		const config = {
			id,
			apiProvider: merged.type,
			apiKey: merged.apiKey,
			apiBaseUrl: merged.baseUrl,
			apiModelId: merged.settings.model,
			temperature: merged.settings.temperature,
			maxTokens: merged.settings.maxTokens,
			rateLimitSeconds: merged.settings.rateLimitSeconds,
			diffEnabled: merged.settings.diffEnabled,
			fuzzyMatchThreshold: merged.settings.fuzzyMatchThreshold,
			openAiHeaders: merged.settings.openAiHeaders,
		}

		await this.providerSettingsManager.saveConfig(merged.name, config)

		if (updates.isDefault) {
			await this.providerSettingsManager.activateProfile({ id })
		}

		return (await this.get(id)) as Provider
	}

	async delete(id: string): Promise<void> {
		if (!this.providerSettingsManager) {
			throw new Error("Provider settings manager not available")
		}

		const provider = await this.get(id)
		if (!provider) {
			throw new Error(`Provider with id ${id} not found`)
		}

		// Note: ProviderSettingsManager uses name-based deletion
		// This is a limitation of the current implementation
		await this.providerSettingsManager.deleteConfig(provider.name)
	}

	async list(options?: QueryOptions): Promise<Provider[]> {
		if (!this.providerSettingsManager) {
			return []
		}

		const configs = await this.providerSettingsManager.listConfig()
		const providers = await Promise.all(
			configs.map(async (config) => {
				const profile = await this.providerSettingsManager!.getProfile({ id: config.id })
				return await this.convertToProvider({ ...profile, name: config.name })
			}),
		)

		// Apply filters and sorting similar to workspace repository
		let result = providers

		if (options?.filters) {
			result = result.filter((provider) => {
				return Object.entries(options.filters!).every(([key, value]) => {
					return (provider as any)[key] === value
				})
			})
		}

		if (options?.sortBy) {
			const { sortBy, sortOrder = "asc" } = options
			result.sort((a, b) => {
				const aVal = (a as any)[sortBy]
				const bVal = (b as any)[sortBy]
				const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
				return sortOrder === "desc" ? -comparison : comparison
			})
		}

		if (options?.limit || options?.offset) {
			const offset = options.offset || 0
			const limit = options.limit || result.length
			result = result.slice(offset, offset + limit)
		}

		return result
	}

	async exists(id: string): Promise<boolean> {
		return (await this.get(id)) !== null
	}

	async getMany(ids: string[]): Promise<(Provider | null)[]> {
		return await Promise.all(ids.map((id) => this.get(id)))
	}

	async createMany(entities: Omit<Provider, "id" | "createdAt" | "updatedAt">[]): Promise<Provider[]> {
		return await Promise.all(entities.map((entity) => this.create(entity)))
	}

	async updateMany(updates: Array<{ id: string; data: Partial<Provider> }>): Promise<Provider[]> {
		return await Promise.all(updates.map(({ id, data }) => this.update(id, data)))
	}

	async deleteMany(ids: string[]): Promise<void> {
		await Promise.all(ids.map((id) => this.delete(id)))
	}

	async count(options?: QueryOptions): Promise<number> {
		const providers = await this.list(options)
		return providers.length
	}

	async getDefaultProvider(): Promise<Provider | null> {
		if (!this.providerSettingsManager) {
			return null
		}

		try {
			const configs = await this.providerSettingsManager.listConfig()
			// In the current implementation, we'd need to check the current active config
			// This is a simplified approach
			if (configs.length > 0) {
				return await this.get(configs[0].id)
			}
		} catch {
			// Ignore errors
		}

		return null
	}

	async setDefaultProvider(id: string): Promise<void> {
		if (!this.providerSettingsManager) {
			throw new Error("Provider settings manager not available")
		}

		await this.providerSettingsManager.activateProfile({ id })
	}

	async getProvidersByType(type: ProviderType): Promise<Provider[]> {
		return await this.list({
			filters: { type },
		})
	}

	async getActiveProviders(): Promise<Provider[]> {
		return await this.list({
			filters: { isActive: true },
		})
	}

	async activateProvider(id: string): Promise<void> {
		await this.update(id, { isActive: true })
	}

	async deactivateProvider(id: string): Promise<void> {
		await this.update(id, { isActive: false })
	}

	async testConnection(id: string): Promise<ConnectionTestResult> {
		// Basic implementation - in real scenario would test actual API connection
		const provider = await this.get(id)
		if (!provider) {
			return {
				success: false,
				error: "Provider not found",
			}
		}

		return {
			success: true,
			responseTime: 100,
			models: ["gpt-4", "gpt-3.5-turbo"], // Mock data
			metadata: {},
		}
	}

	async getSettings(id: string): Promise<ProviderSettings> {
		const provider = await this.get(id)
		if (!provider) {
			throw new Error(`Provider with id ${id} not found`)
		}
		return provider.settings
	}

	async updateSettings(id: string, settings: Partial<ProviderSettings>): Promise<void> {
		const provider = await this.get(id)
		if (!provider) {
			throw new Error(`Provider with id ${id} not found`)
		}

		await this.update(id, {
			settings: {
				...provider.settings,
				...settings,
			},
		})
	}

	async getAvailableModels(id: string): Promise<ModelInfo[]> {
		// Mock implementation - would fetch from actual provider
		return [
			{
				id: "gpt-4",
				name: "GPT-4",
				contextWindow: 8192,
				maxOutputTokens: 4096,
				capabilities: ["text", "reasoning"],
			},
			{
				id: "gpt-3.5-turbo",
				name: "GPT-3.5 Turbo",
				contextWindow: 4096,
				maxOutputTokens: 2048,
				capabilities: ["text"],
			},
		]
	}

	async validateProvider(provider: Partial<Provider>): Promise<ValidationResult> {
		const errors: ValidationError[] = []
		const warnings: ValidationWarning[] = []

		if (!provider.name) {
			errors.push({ field: "name", message: "Provider name is required", code: "REQUIRED" })
		}

		if (!provider.apiKey) {
			errors.push({ field: "apiKey", message: "API key is required", code: "REQUIRED" })
		}

		if (!provider.type) {
			errors.push({ field: "type", message: "Provider type is required", code: "REQUIRED" })
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		}
	}

	async importProvider(config: any): Promise<Provider> {
		return await this.create({
			name: config.name || "Imported Provider",
			type: config.type || "openAI",
			apiKey: config.apiKey || "",
			baseUrl: config.baseUrl,
			isDefault: config.isDefault || false,
			settings: config.settings || {},
			isActive: config.isActive !== false,
		})
	}

	async exportProvider(id: string): Promise<any> {
		const provider = await this.get(id)
		if (!provider) {
			throw new Error(`Provider with id ${id} not found`)
		}

		return {
			name: provider.name,
			type: provider.type,
			baseUrl: provider.baseUrl,
			isDefault: provider.isDefault,
			settings: provider.settings,
			isActive: provider.isActive,
			exportedAt: new Date().toISOString(),
			// Note: apiKey is excluded for security
		}
	}

	async getProviderStats(id: string, dateRange?: DateRange): Promise<ProviderStats> {
		// Mock implementation - would integrate with actual usage tracking
		return {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			totalTokens: 0,
			inputTokens: 0,
			outputTokens: 0,
			totalCost: 0,
			averageResponseTime: 0,
			errorRate: 0,
			requestsByDay: {},
		}
	}

	async getByName(name: string): Promise<Provider | null> {
		const providers = await this.list()
		return providers.find((p) => p.name === name) || null
	}

	async isNameAvailable(name: string, excludeId?: string): Promise<boolean> {
		const provider = await this.getByName(name)
		return !provider || provider.id === excludeId
	}

	async cloneProvider(id: string, newName: string): Promise<Provider> {
		const existing = await this.get(id)
		if (!existing) {
			throw new Error(`Provider with id ${id} not found`)
		}

		return await this.create({
			...existing,
			name: newName,
			isDefault: false,
		})
	}

	async resetToDefaults(id: string): Promise<Provider> {
		const provider = await this.get(id)
		if (!provider) {
			throw new Error(`Provider with id ${id} not found`)
		}

		const defaultSettings: ProviderSettings = {
			temperature: 0.7,
			maxTokens: 4096,
			rateLimitSeconds: 0,
			diffEnabled: true,
			fuzzyMatchThreshold: 1.0,
		}

		return await this.update(id, {
			settings: defaultSettings,
		})
	}
}
