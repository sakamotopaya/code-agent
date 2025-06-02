

**Code Organization:**

- Refactor files that reach 300-500 lines into smaller units, adhering to SOLID principles.

**Logging and Error Handling:**

- Ensure robust logging and error handling in all generated code.
  - Renderer Logger: `/Users/eo/code/promptlunde/src/renderer/utils/LoggerUtil.ts`
  - Main Logger: `/Users/eo/code/promptlunde/src/main/utils/LoggerUtil.ts`
  - when you encounter console.log,error,etc. replace with our logger patterns

**API References:**

- Refer to the IPC API documentation as needed: `/Users/eo/code/promptlunde/docs/technical/ipc-api-reference.md`

**Development**
- Always run `npm run build` and address any build errors before declaring a task complete
- Running `npm run dev` is slow but can be used when reviewing the ui

**UI Development:**

- Implement theme styling for all new UI code using the theme provider system.
  - Theme definitions: `src/renderer/theme.css`
- Use the i18n localization system and string resource files for UI code.
  - Translations: `src/locales/en/translation.json`
- We use modern styling patterns. do not use inline styles. 
- Our Main component is `src/renderer/components/MainV2.tsx`
- The UI paradigm
  - all data lives under the workspace umbrella. `src/renderer/components/WorkspaceSelector.tsx`
  - a main treeview: `src/renderer/components/MainTreeview.tsx`
  - and a tabbed document container for content: `src/renderer/components/DocumentContainer.tsx`
- state management:
  - src/renderer/services/WorkspaceStateManager.ts
  - src/renderer/models/ApplicationStateTree.ts
- For tab titles:
  - Limit tab titles to 25-30 characters maximum
  - Use ellipsis for truncation when titles exceed the maximum length
  - Implement Material UI Tooltip components to show the full title on hover
- Always use theme-aware styling for tooltips to ensure readability in both light and dark themes
- do not use debounce to prevent event loops, I consider adding debounce as hiding the root problem.
- We should not fire events if nothing changed, we should not process received events if nothing has changed
- we should use state management over eventing when it makes sense

**Testing:**

- Generate or edit unit tests for new code where applicable.
  - Unit Test Framework: Jest
  - Jest Configuration: `/Users/eo/code/promptlunde/jest.config.js`
- Note: Do not run Jest tests; they will be executed separately.

**Documentation:**

- Write technical documentation for code changes and save in `docs/technical`.
- Update user documentation for any changes impacting users in `docs/user`.
- Document all requested changes in `docs/fixes`.
- You may read files in `docs/marketing` and `docs/design` but do not overwrite them.

**Additional Preferences:**

- In .NET development, prefer using `var` for variable declarations.
