we are ready to work on issue #20 (docs/product-stories/cli-utility/story-20-performance-optimization.md) in repo https://github.com/sakamotopaya/code-agent.
follow the normal git flow. create a new local branch for the story.
code the tasks and unit tests that prove the task are complete.
if you need information about prior stories, you can find them locally here docs/product-stories/cli-utility
we often get rejected trying to push our changes. make sure and run a build and lint prior to trying to push. you will not be able to push the local branch if there are any lint warnings
when you are finished with the code and tests, update the issue with a new comment describing your work and then
push your branch and create a pull request for this branch against main
you should use regular git command but it might be best to create the PR using the mcp server

We need to resume work on issue #18 (docs/product-stories/cli-utility/story-18-update-documentation.md) in repo https://github.com/sakamotopaya/code-agent.

you were creating unit tests when you ran out of context. specifically you were editing src/cli/**tests**/unit/commands/HelpCommand.test.ts when you ran out of context

getting this error trying to run the client. any code that uses vscode as a dependency needs to be put behind an interface so that we can provide an implementation for the CLI
[copyLocales] Copied 34 locale files to /Users/eo/code/code-agent/src/dist/i18n/locales
[esbuild-problem-matcher#onEnd]
eo@m3x src % node dist/cli/index.js --help
node:internal/modules/cjs/loader:1228
throw err;
^

Error: Cannot find module 'vscode'
Require stack:

- /Users/eo/code/code-agent/src/dist/cli/index.js
  at Module.\_resolveFilename (node:internal/modules/cjs/loader:1225:15)
  at Module.\_load (node:internal/modules/cjs/loader:1051:27)
  at Module.require (node:internal/modules/cjs/loader:1311:19)
  at require (node:internal/modules/helpers:179:18)
  at utils/storage.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:190467:22)
  at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
  at api/providers/fetchers/modelCache.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:198348:5)
  at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
  at api/providers/router-provider.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:198409:5)
  at \_\_init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [ '/Users/eo/code/code-agent/src/dist/cli/index.js' ]
  }

Node.js v20.18.3
eo@m3x src % npm run build:cli

> roo-cline@3.19.1 build:cli
> node esbuild.mjs

[extension] Cleaning dist directory: /Users/eo/code/code-agent/src/dist
[esbuild-problem-matcher#onStart]
[copyPaths] Copied ../README.md to README.md
[copyPaths] Copied ../CHANGELOG.md to CHANGELOG.md
[copyPaths] Copied ../LICENSE to LICENSE
[copyPaths] Optional file not found: ../.env
[copyPaths] Copied 911 files from node_modules/vscode-material-icons/generated to assets/vscode-material-icons
[copyPaths] Copied 3 files from ../webview-ui/audio to webview-ui/audio
[copyWasms] Copied tiktoken WASMs to /Users/eo/code/code-agent/src/dist
[copyWasms] Copied tiktoken WASMs to /Users/eo/code/code-agent/src/dist/workers
[copyWasms] Copied tree-sitter.wasm to /Users/eo/code/code-agent/src/dist
[copyWasms] Copied 35 tree-sitter language wasms to /Users/eo/code/code-agent/src/dist
[copyLocales] Copied 34 locale files to /Users/eo/code/code-agent/src/dist/i18n/locales
[esbuild-problem-matcher#onEnd]
eo@m3x src % node dist/cli/index.js --help
Error processing directory /Users/eo/code/code-agent/src/dist/cli/i18n/locales: Error: ENOENT: no such file or directory, scandir '/Users/eo/code/code-agent/src/dist/cli/i18n/locales'
at Object.readdirSync (node:fs:1507:26)
at i18n/setup.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:190373:37)
at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
at i18n/index.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:190420:5)
at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
at utils/storage.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:190474:5)
at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
at api/providers/fetchers/modelCache.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:198351:5)
at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
at api/providers/router-provider.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:198412:5) {
errno: -2,
code: 'ENOENT',
syscall: 'scandir',
path: '/Users/eo/code/code-agent/src/dist/cli/i18n/locales'
}
node:internal/modules/cjs/loader:1228
throw err;
^

Error: Cannot find module 'vscode'
Require stack:

- /Users/eo/code/code-agent/src/dist/cli/index.js
  at Module.\_resolveFilename (node:internal/modules/cjs/loader:1225:15)
  at Module.\_load (node:internal/modules/cjs/loader:1051:27)
  at Module.require (node:internal/modules/cjs/loader:1311:19)
  at require (node:internal/modules/helpers:179:18)
  at api/providers/human-relay.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:198620:23)
  at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
  at api/providers/index.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:224236:5)
  at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
  at api/index.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:224309:5)
  at \_\_init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [ '/Users/eo/code/code-agent/src/dist/cli/index.js' ]
  }

Node.js v20.18.3
eo@m3x src % node dist/cli/index.js --help
Error processing directory /Users/eo/code/code-agent/src/dist/cli/i18n/locales: Error: ENOENT: no such file or directory, scandir '/Users/eo/code/code-agent/src/dist/cli/i18n/locales'
at Object.readdirSync (node:fs:1507:26)
at i18n/setup.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:190373:37)
at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
at i18n/index.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:190420:5)
at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
at utils/storage.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:190474:5)
at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
at api/providers/fetchers/modelCache.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:198351:5)
at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
at api/providers/router-provider.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:198412:5) {
errno: -2,
code: 'ENOENT',
syscall: 'scandir',
path: '/Users/eo/code/code-agent/src/dist/cli/i18n/locales'
}
node:internal/modules/cjs/loader:1228
throw err;
^

Error: Cannot find module 'vscode'
Require stack:

- /Users/eo/code/code-agent/src/dist/cli/index.js
  at Module.\_resolveFilename (node:internal/modules/cjs/loader:1225:15)
  at Module.\_load (node:internal/modules/cjs/loader:1051:27)
  at Module.require (node:internal/modules/cjs/loader:1311:19)
  at require (node:internal/modules/helpers:179:18)
  at api/providers/human-relay.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:198620:23)
  at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
  at api/providers/index.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:224236:5)
  at **init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56)
  at api/index.ts (/Users/eo/code/code-agent/src/dist/cli/index.js:224309:5)
  at \_\_init (/Users/eo/code/code-agent/src/dist/cli/index.js:15:56) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [ '/Users/eo/code/code-agent/src/dist/cli/index.js' ]
  }

Node.js v20.18.3
eo@m3x src %
