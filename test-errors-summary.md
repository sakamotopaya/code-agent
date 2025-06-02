# Test Errors Summary

## WebAssembly/Tree-sitter Errors

../node_modules/.pnpm/web-tree-sitter@0.22.6/node_modules/web-tree-sitter/tree-sitter.js - failed to asynchronously prepare wasm: CompileError: WebAssembly.instantiate(): BufferSource argument is empty
../node_modules/.pnpm/web-tree-sitter@0.22.6/node_modules/web-tree-sitter/tree-sitter.js - Aborted(CompileError: WebAssembly.instantiate(): BufferSource argument is empty)

## File System Errors

./test-logs - Cleanup error: Error: ENOENT: no such file or directory, scandir './test-logs'

## API/Model Fetching Errors

/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Failed to fetch models in webviewMessageHandler requestRouterModels for requesty: Error: Requesty API error
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Failed to fetch models in webviewMessageHandler requestRouterModels for unbound: Error: Unbound API error
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Failed to fetch models in webviewMessageHandler requestRouterModels for litellm: Error: LiteLLM connection failed
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Failed to fetch models in webviewMessageHandler requestRouterModels for openrouter: Error: Structured error message
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Failed to fetch models in webviewMessageHandler requestRouterModels for requesty: String error message
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Failed to fetch models in webviewMessageHandler requestRouterModels for glama: { message: 'Object with message' }
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Error fetching models for requesty: Error: Requesty API error
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Error fetching models for unbound: Error: Unbound API error
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Error fetching models for litellm: Error: LiteLLM connection failed
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Error fetching models for openrouter: Error: Structured error message
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Error fetching models for requesty: String error message
/Users/eo/code/code-agent/src/core/webview/**tests**/webviewMessageHandler.test.ts - Error fetching models for glama: { message: 'Object with message' }

## MCP Settings Errors

unknown - errors.invalid_mcp_settings_syntax SyntaxError: "undefined" is not valid JSON

## Custom Modes Manager Errors

/test/storage/path/settings/custom_modes.yaml - [CustomModesManager] Failed to load modes from /test/storage/path/settings/custom_modes.yaml: Cannot read properties of undefined (reading 'length')
/mock/workspace/.roomodes - [CustomModesManager] Failed to load modes from /mock/workspace/.roomodes: File not found
/mock/settings/settings/custom_modes.yaml - [CustomModesManager] Failed to parse YAML from /mock/settings/settings/custom_modes.yaml: YAMLParseError: Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 35
/test/path/settings/custom_modes.yaml - [CustomModesManager] Failed to load modes from /test/path/settings/custom_modes.yaml: Cannot read properties of undefined (reading 'length')

## Theme Loading Errors

/Users/eo/code/code-agent/src/integrations/theme/getTheme.ts - Error loading color theme: TypeError: Cannot read properties of undefined (reading 'all')

## System Prompt Generation Errors

/Users/eo/code/code-agent/src/core/webview/generateSystemPrompt.ts - Error checking if model supports computer use: TypeError: Cannot read properties of undefined (reading 'getModel')

## Context Proxy Errors

/Users/eo/code/code-agent/src/core/config/ContextProxy.ts - [getModels] Error writing litellm models to file cache: Error: ContextProxy not initialized
/Users/eo/code/code-agent/src/core/config/ContextProxy.ts - [getModels] error reading litellm models from file cache Error: ContextProxy not initialized
/Users/eo/code/code-agent/src/core/config/ContextProxy.ts - [getModels] Error writing openrouter models to file cache: Error: ContextProxy not initialized
/Users/eo/code/code-agent/src/core/config/ContextProxy.ts - [getModels] error reading openrouter models from file cache Error: ContextProxy not initialized
/Users/eo/code/code-agent/src/core/config/ContextProxy.ts - [getModels] Error writing requesty models to file cache: Error: ContextProxy not initialized
/Users/eo/code/code-agent/src/core/config/ContextProxy.ts - [getModels] error reading requesty models from file cache Error: ContextProxy not initialized
/Users/eo/code/code-agent/src/core/config/ContextProxy.ts - [getModels] Error writing glama models to file cache: Error: ContextProxy not initialized
/Users/eo/code/code-agent/src/core/config/ContextProxy.ts - [getModels] error reading glama models from file cache Error: ContextProxy not initialized
/Users/eo/code/code-agent/src/core/config/ContextProxy.ts - [getModels] Error writing unbound models to file cache: Error: ContextProxy not initialized
/Users/eo/code/code-agent/src/core/config/ContextProxy.ts - [getModels] error reading unbound models from file cache Error: ContextProxy not initialized

## Model Cache Errors

/Users/eo/code/code-agent/src/api/providers/fetchers/**tests**/modelCache.test.ts - [getModels] Failed to fetch models in modelCache for litellm: Error: LiteLLM connection failed
/Users/eo/code/code-agent/src/api/providers/fetchers/modelCache.ts - [getModels] Failed to fetch models in modelCache for unknown: Error: Unknown provider: unknown

## ClineProvider Errors

/Users/eo/code/code-agent/src/core/webview/ClineProvider.ts - Error create new api configuration: this.providerSettingsManager.saveConfig is not a function
/Users/eo/code/code-agent/src/core/webview/**tests**/ClineProvider.test.ts - Error create new api configuration: Error: API handler error
/Users/eo/code/code-agent/src/core/webview/**tests**/ClineProvider.test.ts - Error getting system prompt: Error: Test error
/Users/eo/code/code-agent/src/core/webview/**tests**/ClineProvider.test.ts - Failed to fetch models in webviewMessageHandler requestRouterModels for requesty: Error: Requesty API error
/Users/eo/code/code-agent/src/core/webview/**tests**/ClineProvider.test.ts - Failed to fetch models in webviewMessageHandler requestRouterModels for unbound: Error: Unbound API error
/Users/eo/code/code-agent/src/core/webview/**tests**/ClineProvider.test.ts - Failed to fetch models in webviewMessageHandler requestRouterModels for litellm: Error: LiteLLM connection failed
/Users/eo/code/code-agent/src/core/webview/**tests**/ClineProvider.test.ts - Error fetching models for requesty: Error: Requesty API error
/Users/eo/code/code-agent/src/core/webview/**tests**/ClineProvider.test.ts - Error fetching models for unbound: Error: Unbound API error
/Users/eo/code/code-agent/src/core/webview/**tests**/ClineProvider.test.ts - Error fetching models for litellm: Error: LiteLLM connection failed

## Token Counting Errors

/Users/eo/code/code-agent/src/api/providers/vscode-lm.ts - Token counting error stack: TypeError: Right-hand side of 'instanceof' is not callable

## VSCode LM API Errors

/Users/eo/code/code-agent/src/api/providers/**tests**/vscode-lm.test.ts - API Error

## Provider Settings Errors

/Users/eo/code/code-agent/src/core/config/ProviderSettingsManager.ts - Error: Failed to initialize config: Error: Failed to read provider profiles from secrets: Error: Storage failed
/Users/eo/code/code-agent/src/core/config/ProviderSettingsManager.ts - Error: Failed to initialize config: Error: Failed to read provider profiles from secrets: Error: Read failed

## Cache Manager Errors

/Users/eo/code/code-agent/src/services/code-index/**tests**/cache-manager.test.ts - Failed to save cache: Error: Save failed

## LiteLLM API Errors

unknown - Error fetching LiteLLM models: Failed to fetch LiteLLM models: Unexpected response format.
unknown - Error fetching LiteLLM models: Failed to fetch LiteLLM models: 401 Unauthorized. Check base URL and API key.
unknown - Error fetching LiteLLM models: { request: {}, isAxiosError: true }

## File Parser Errors

/Users/eo/code/code-agent/src/services/code-index/processors/**tests**/parser.test.ts - Error reading file test.js: Error: File not found
/Users/eo/code/code-agent/src/services/code-index/processors/**tests**/parser.test.ts - Error loading language parser for test.js: Error: Load failed
unknown - Error parsing file: Error: Parsing error
