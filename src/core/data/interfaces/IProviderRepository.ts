/**
 * Provider repository interface for managing AI service providers
 */

import { IRepository, QueryOptions } from "./IRepository"
import { Provider, ProviderSettings, CreateProviderRequest, ProviderType } from "../types/entities"

export interface ProviderQueryOptions extends QueryOptions {
	type?: ProviderType
	isActive?: boolean
	isDefault?: boolean
}

export interface IProviderRepository extends IRepository<Provider> {
	/**
	 * Get the default provider
	 */
	getDefaultProvider(): Promise<Provider | null>

	/**
	 * Set a provider as default
	 */
	setDefaultProvider(id: string): Promise<void>

	/**
	 * Get providers by type
	 */
	getProvidersByType(type: ProviderType): Promise<Provider[]>

	/**
	 * Get active providers
	 */
	getActiveProviders(): Promise<Provider[]>

	/**
	 * Activate a provider
	 */
	activateProvider(id: string): Promise<void>

	/**
	 * Deactivate a provider
	 */
	deactivateProvider(id: string): Promise<void>

	/**
	 * Test provider connection
	 */
	testConnection(id: string): Promise<ConnectionTestResult>

	/**
	 * Get provider settings
	 */
	getSettings(id: string): Promise<ProviderSettings>

	/**
	 * Update provider settings
	 */
	updateSettings(id: string, settings: Partial<ProviderSettings>): Promise<void>

	/**
	 * Get available models for a provider
	 */
	getAvailableModels(id: string): Promise<ModelInfo[]>

	/**
	 * Validate provider configuration
	 */
	validateProvider(provider: Partial<Provider>): Promise<ValidationResult>

	/**
	 * Import provider configuration
	 */
	importProvider(config: any): Promise<Provider>

	/**
	 * Export provider configuration (without sensitive data)
	 */
	exportProvider(id: string): Promise<any>

	/**
	 * Get provider usage statistics
	 */
	getProviderStats(id: string, dateRange?: DateRange): Promise<ProviderStats>

	/**
	 * Get provider by name
	 */
	getByName(name: string): Promise<Provider | null>

	/**
	 * Check if provider name is available
	 */
	isNameAvailable(name: string, excludeId?: string): Promise<boolean>

	/**
	 * Clone provider configuration
	 */
	cloneProvider(id: string, newName: string): Promise<Provider>

	/**
	 * Reset provider to defaults
	 */
	resetToDefaults(id: string): Promise<Provider>
}

export interface ConnectionTestResult {
	success: boolean
	error?: string
	responseTime?: number
	models?: string[]
	metadata?: Record<string, any>
}

export interface ModelInfo {
	id: string
	name: string
	description?: string
	contextWindow?: number
	maxOutputTokens?: number
	inputCostPer1k?: number
	outputCostPer1k?: number
	capabilities?: string[]
	deprecated?: boolean
}

export interface ValidationResult {
	valid: boolean
	errors: ValidationError[]
	warnings: ValidationWarning[]
}

export interface ValidationError {
	field: string
	message: string
	code: string
}

export interface ValidationWarning {
	field: string
	message: string
	code: string
}

export interface ProviderStats {
	totalRequests: number
	successfulRequests: number
	failedRequests: number
	totalTokens: number
	inputTokens: number
	outputTokens: number
	totalCost: number
	averageResponseTime: number
	errorRate: number
	mostUsedModel?: string
	requestsByDay: Record<string, number>
}

export interface DateRange {
	start: Date
	end: Date
}
