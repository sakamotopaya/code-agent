import React, { useState, useEffect } from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { useAppTranslation } from "@/i18n/TranslationContext"

import { VSCodeCheckbox, VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { vscode } from "@/utils/vscode"
import { CodebaseIndexConfig, CodebaseIndexModels, ProviderSettings } from "../../../../src/schemas"
import { EmbedderProvider } from "../../../../src/shared/embeddingModels"
import { z } from "zod"

import { SetCachedStateField } from "./types"

interface CodeIndexSettingsProps {
	codebaseIndexModels: CodebaseIndexModels | undefined
	codebaseIndexConfig: CodebaseIndexConfig | undefined
	apiConfiguration: ProviderSettings
	setCachedStateField: SetCachedStateField<"codebaseIndexConfig">
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
	areSettingsCommitted: boolean
}

interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: {
		systemStatus: string
		message?: string
		processedItems: number
		totalItems: number
		currentItemUnit?: string
	}
}

export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({
	codebaseIndexModels,
	codebaseIndexConfig,
	apiConfiguration,
	setCachedStateField,
	setApiConfigurationField,
	areSettingsCommitted,
}) => {
	const { t } = useAppTranslation()
	const [indexingStatus, setIndexingStatus] = useState({
		systemStatus: "Standby",
		message: "",
		processedItems: 0,
		totalItems: 0,
		currentItemUnit: "items",
	})

	// Safely calculate available models for current provider
	const currentProvider = codebaseIndexConfig?.codebaseIndexEmbedderProvider
	const modelsForProvider =
		currentProvider === "openai" || currentProvider === "ollama"
			? codebaseIndexModels?.[currentProvider]
			: codebaseIndexModels?.openai
	const availableModelIds = Object.keys(modelsForProvider || {})

	useEffect(() => {
		// Request initial indexing status from extension host
		vscode.postMessage({ type: "requestIndexingStatus" })

		// Set up interval for periodic status updates

		// Set up message listener for status updates
		const handleMessage = (event: MessageEvent<IndexingStatusUpdateMessage>) => {
			if (event.data.type === "indexingStatusUpdate") {
				setIndexingStatus({
					systemStatus: event.data.values.systemStatus,
					message: event.data.values.message || "",
					processedItems: event.data.values.processedItems,
					totalItems: event.data.values.totalItems,
					currentItemUnit: event.data.values.currentItemUnit || "items",
				})
			}
		}

		window.addEventListener("message", handleMessage)

		// Cleanup function
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [codebaseIndexConfig, codebaseIndexModels])

	function validateIndexingConfig(config: CodebaseIndexConfig | undefined, apiConfig: ProviderSettings): boolean {
		if (!config) return false

		const baseSchema = z.object({
			codebaseIndexQdrantUrl: z.string().url("Qdrant URL must be a valid URL"),
			codebaseIndexEmbedderModelId: z.string().min(1, "Model ID is required"),
		})

		const providerSchemas = {
			openai: baseSchema.extend({
				codebaseIndexEmbedderProvider: z.literal("openai"),
				codeIndexOpenAiKey: z.string().min(1, "OpenAI key is required"),
			}),
			ollama: baseSchema.extend({
				codebaseIndexEmbedderProvider: z.literal("ollama"),
				codebaseIndexEmbedderBaseUrl: z.string().url("Ollama URL must be a valid URL"),
			}),
		}

		try {
			const schema =
				config.codebaseIndexEmbedderProvider === "openai" ? providerSchemas.openai : providerSchemas.ollama

			schema.parse({
				...config,
				codeIndexOpenAiKey: apiConfig.codeIndexOpenAiKey,
			})
			return true
		} catch {
			return false
		}
	}

	const progressPercentage =
		indexingStatus.totalItems > 0
			? (indexingStatus.processedItems / indexingStatus.totalItems) * 100
			: indexingStatus.totalItems === 0 && indexingStatus.processedItems === 0
				? 100
				: 0

	const transformValue = 100 - progressPercentage
	const transformStyleString = `translateX(-${transformValue}%)`

	return (
		<>
			<div>
				<div className="flex items-center gap-2">
					<VSCodeCheckbox
						checked={codebaseIndexConfig?.codebaseIndexEnabled}
						onChange={(e: any) =>
							setCachedStateField("codebaseIndexConfig", {
								...codebaseIndexConfig,
								codebaseIndexEnabled: e.target.checked,
							})
						}>
						<span className="font-medium">{t("settings:codeIndex.enableLabel")}</span>
					</VSCodeCheckbox>
				</div>
				<p className="text-vscode-descriptionForeground text-sm mt-0">
					{t("settings:codeIndex.enableDescription")}
				</p>
			</div>

			{codebaseIndexConfig?.codebaseIndexEnabled && (
				<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
					<div className="text-sm text-vscode-descriptionForeground">
						<span
							className={`
								inline-block w-3 h-3 rounded-full mr-2
								${
									indexingStatus.systemStatus === "Standby"
										? "bg-gray-400"
										: indexingStatus.systemStatus === "Indexing"
											? "bg-yellow-500 animate-pulse"
											: indexingStatus.systemStatus === "Indexed"
												? "bg-green-500"
												: indexingStatus.systemStatus === "Error"
													? "bg-red-500"
													: "bg-gray-400"
								}
							`}></span>
						{indexingStatus.systemStatus}
						{indexingStatus.message ? ` - ${indexingStatus.message}` : ""}
					</div>

					{indexingStatus.systemStatus === "Indexing" && (
						<div className="space-y-1">
							<ProgressPrimitive.Root
								className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
								value={progressPercentage}>
								<ProgressPrimitive.Indicator
									className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-in-out"
									style={{
										transform: transformStyleString,
									}}
								/>
							</ProgressPrimitive.Root>
						</div>
					)}

					<div className="flex items-center gap-4 font-bold">
						<div>{t("settings:codeIndex.providerLabel")}</div>
					</div>
					<div>
						<div className="flex items-center gap-2">
							<Select
								value={codebaseIndexConfig?.codebaseIndexEmbedderProvider || "openai"}
								onValueChange={(value) => {
									const newProvider = value as EmbedderProvider
									const models = codebaseIndexModels?.[newProvider]
									const modelIds = models ? Object.keys(models) : []
									const defaultModelId = modelIds.length > 0 ? modelIds[0] : "" // Use empty string if no models

									if (codebaseIndexConfig) {
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											codebaseIndexEmbedderProvider: newProvider,
											codebaseIndexEmbedderModelId: defaultModelId,
										})
									}
								}}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t("settings:codeIndex.selectProviderPlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="openai">{t("settings:codeIndex.openaiProvider")}</SelectItem>
									<SelectItem value="ollama">{t("settings:codeIndex.ollamaProvider")}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{codebaseIndexConfig?.codebaseIndexEmbedderProvider === "openai" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.openaiKeyLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									type="password"
									value={apiConfiguration.codeIndexOpenAiKey || ""}
									onInput={(e: any) => setApiConfigurationField("codeIndexOpenAiKey", e.target.value)}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
					)}

					<div className="flex items-center gap-4 font-bold">
						<div>{t("settings:codeIndex.modelLabel")}</div>
					</div>
					<div>
						<div className="flex items-center gap-2">
							<Select
								value={codebaseIndexConfig?.codebaseIndexEmbedderModelId || ""}
								onValueChange={(value) =>
									setCachedStateField("codebaseIndexConfig", {
										...codebaseIndexConfig,
										codebaseIndexEmbedderModelId: value,
									})
								}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t("settings:codeIndex.selectModelPlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									{availableModelIds.map((modelId) => (
										<SelectItem key={modelId} value={modelId}>
											{modelId}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{codebaseIndexConfig?.codebaseIndexEmbedderProvider === "ollama" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.ollamaUrlLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									value={codebaseIndexConfig.codebaseIndexEmbedderBaseUrl || ""}
									onInput={(e: any) =>
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											codebaseIndexEmbedderBaseUrl: e.target.value,
										})
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
					)}

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-4 font-bold">
							<div>{t("settings:codeIndex.qdrantUrlLabel")}</div>
						</div>
						<div>
							<VSCodeTextField
								value={codebaseIndexConfig.codebaseIndexQdrantUrl}
								onInput={(e: any) =>
									setCachedStateField("codebaseIndexConfig", {
										...codebaseIndexConfig,
										codebaseIndexQdrantUrl: e.target.value,
									})
								}
								style={{ width: "100%" }}></VSCodeTextField>
						</div>
					</div>

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-4 font-bold">
							<div>{t("settings:codeIndex.qdrantKeyLabel")}</div>
						</div>
						<div>
							<VSCodeTextField
								type="password"
								value={apiConfiguration.codeIndexQdrantApiKey}
								onInput={(e: any) => setApiConfigurationField("codeIndexQdrantApiKey", e.target.value)}
								style={{ width: "100%" }}></VSCodeTextField>
						</div>
					</div>

					<div className="flex gap-2">
						{(indexingStatus.systemStatus === "Error" || indexingStatus.systemStatus === "Standby") && (
							<VSCodeButton
								onClick={() => vscode.postMessage({ type: "startIndexing" })}
								disabled={
									!areSettingsCommitted ||
									!validateIndexingConfig(codebaseIndexConfig, apiConfiguration)
								}>
								{t("settings:codeIndex.startIndexingButton")}
							</VSCodeButton>
						)}
						{(indexingStatus.systemStatus === "Indexed" || indexingStatus.systemStatus === "Error") && (
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<VSCodeButton appearance="secondary">
										{t("settings:codeIndex.clearIndexDataButton")}
									</VSCodeButton>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											{t("settings:codeIndex.clearDataDialog.title")}
										</AlertDialogTitle>
										<AlertDialogDescription>
											{t("settings:codeIndex.clearDataDialog.description")}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>
											{t("settings:codeIndex.clearDataDialog.cancelButton")}
										</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => vscode.postMessage({ type: "clearIndexData" })}>
											{t("settings:codeIndex.clearDataDialog.confirmButton")}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						)}
					</div>
				</div>
			)}
		</>
	)
}
