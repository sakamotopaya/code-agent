# Docker WASM Path Fix - Product Stories

## Epic: Fix Docker API WASM File Loading Issue

**Problem**: The Docker API deployment fails because tree-sitter WASM files cannot be found due to hardcoded path assumptions in the codebase.

**Goal**: Implement a robust solution that allows the API to find WASM files regardless of execution context, with proper configuration options for Docker deployments.

---

## Story 1: Add Environment Variable Override for WASM Directory

**As a** DevOps engineer deploying the API in Docker  
**I want** to explicitly configure the WASM file directory via environment variable  
**So that** the API can find tree-sitter WASM files regardless of the container's directory structure

### Acceptance Criteria

- [ ] Add support for `TREE_SITTER_WASM_DIR` environment variable in `languageParser.ts`
- [ ] Environment variable takes precedence over automatic detection
- [ ] Fallback to existing logic if environment variable is not set
- [ ] Add validation that the specified directory contains required WASM files
- [ ] Log the resolved WASM directory for debugging purposes

### Technical Tasks

- [ ] Modify `getWasmDirectory()` function in `src/services/tree-sitter/languageParser.ts`
- [ ] Add environment variable validation
- [ ] Update both `loadLanguage()` and `initializeParser()` functions
- [ ] Add error handling for invalid WASM directory paths

### Definition of Done

- [ ] Environment variable override works in all execution contexts
- [ ] Existing functionality remains unchanged when env var is not set
- [ ] Proper error messages when WASM files are not found
- [ ] Code is covered by unit tests

---

## Story 2: Update Docker Configuration

**As a** developer running the API in Docker  
**I want** the container to automatically set the correct WASM directory  
**So that** tree-sitter functionality works out of the box without manual configuration

### Acceptance Criteria

- [ ] Development Dockerfile sets `TREE_SITTER_WASM_DIR=/app/src/dist`
- [ ] Production Dockerfile sets `TREE_SITTER_WASM_DIR=/app/src/dist`
- [ ] Environment variable is documented in Docker configuration
- [ ] API starts successfully and can load WASM files
- [ ] Tree-sitter functionality works in containerized environment

### Technical Tasks

- [ ] Update `docker/development/Dockerfile`
- [ ] Update `docker/production/Dockerfile` (if exists)
- [ ] Add environment variable to docker-compose files
- [ ] Update Docker documentation

### Definition of Done

- [ ] Docker containers start without WASM-related errors
- [ ] Tree-sitter parsing works in Docker environment
- [ ] Environment variable is properly documented

---

## Story 3: Improve Context Detection Logic

**As a** developer working on the codebase  
**I want** robust WASM directory detection that doesn't rely on hardcoded path assumptions  
**So that** new execution contexts don't break WASM file loading

### Acceptance Criteria

- [ ] Replace hardcoded `/cli` path checking with intelligent detection
- [ ] Support for `/api` execution context
- [ ] Fallback mechanism that searches parent directories for WASM files
- [ ] Clear error messages when WASM files cannot be found
- [ ] Backward compatibility with existing VSCode extension and CLI contexts

### Technical Tasks

- [ ] Implement directory traversal logic to find WASM files
- [ ] Replace `isCliContext` logic with more robust detection
- [ ] Add comprehensive logging for debugging path resolution
- [ ] Handle edge cases (symlinks, unusual directory structures)

### Definition of Done

- [ ] Works correctly in all three contexts: VSCode extension, CLI, API
- [ ] No hardcoded path assumptions
- [ ] Comprehensive error handling and logging
- [ ] Performance impact is minimal

---

## Story 4: Add Comprehensive Testing

**As a** developer maintaining the tree-sitter functionality  
**I want** comprehensive tests for WASM file loading across all execution contexts  
**So that** future changes don't break WASM functionality in any environment

### Acceptance Criteria

- [ ] Unit tests for WASM directory resolution logic
- [ ] Integration tests for tree-sitter functionality in all contexts
- [ ] Docker-specific tests that verify WASM loading in containers
- [ ] Tests for environment variable override functionality
- [ ] Tests for error conditions (missing WASM files, invalid paths)

### Technical Tasks

- [ ] Create unit tests for `getWasmDirectory()` function
- [ ] Add integration tests for tree-sitter parsing in different contexts
- [ ] Create Docker test scenarios
- [ ] Add tests for environment variable configuration
- [ ] Mock file system operations for reliable testing

### Definition of Done

- [ ] Test coverage for all WASM loading scenarios
- [ ] Tests pass in CI/CD pipeline
- [ ] Docker tests verify container functionality
- [ ] Performance tests ensure no regression

---

## Story 5: Documentation and Configuration Guide

**As a** developer or DevOps engineer  
**I want** clear documentation on WASM file configuration options  
**So that** I can properly configure the application in different deployment scenarios

### Acceptance Criteria

- [ ] Document `TREE_SITTER_WASM_DIR` environment variable
- [ ] Explain WASM directory resolution logic
- [ ] Provide Docker deployment examples
- [ ] Include troubleshooting guide for WASM-related issues
- [ ] Update API deployment documentation

### Technical Tasks

- [ ] Update environment variable documentation
- [ ] Create Docker deployment guide
- [ ] Add troubleshooting section for WASM issues
- [ ] Update API configuration documentation
- [ ] Add examples for different deployment scenarios

### Definition of Done

- [ ] Complete documentation for WASM configuration
- [ ] Docker deployment examples work correctly
- [ ] Troubleshooting guide helps resolve common issues
- [ ] Documentation is reviewed and approved

---

## Implementation Priority

1. **Story 1 & 2** (High Priority): Quick fix for immediate Docker issue
2. **Story 3** (Medium Priority): Architectural improvement for long-term maintainability
3. **Story 4** (Medium Priority): Ensure reliability and prevent regressions
4. **Story 5** (Low Priority): Documentation and knowledge sharing

## Success Metrics

- [ ] Docker API deployment succeeds without WASM errors
- [ ] Tree-sitter functionality works in all execution contexts
- [ ] Zero regressions in existing VSCode extension and CLI functionality
- [ ] Reduced time to diagnose and fix similar path-related issues
- [ ] Improved developer experience for Docker deployments

## Risk Mitigation

- **Risk**: Breaking existing functionality in VSCode extension or CLI
    - **Mitigation**: Comprehensive testing and backward compatibility checks
- **Risk**: Performance impact from directory traversal
    - **Mitigation**: Cache resolved paths and benchmark performance
- **Risk**: Complex configuration for different deployment scenarios
    - **Mitigation**: Sensible defaults and clear documentation
