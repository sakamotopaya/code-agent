**Project Overview:**

This is a VS Code extension. It is a coding agent and we are adding the ability to run the code agent as a command line utility. we need to retain the existing extension capability and use interfaces and other patterns to allow the code to run as fully functional as possible as both a CLI utility and as an API.

When fixing issues and adding features it is incredibly important to remember that the code could have up to 3 use cases: VS Code extension, CLI utility, API endpoint.

All code paths have to be able to use the tools and mcp server functionality.

all along, our solution when, for instance, the CLI needs console, the API needs SSE, and the VS code extension uses UI.. is to use interfaces and adapters. it seems to me you are going beyond that and reimpleting core code when really the core code needs to use the interface

WE are only testing the CLI and API during development:
You can run the CLI by changing to src folder and then run:
npm run start:cli --silent -- --config $HOME/.agentz/agent-config.json --batch "use the github mcp server to summarize issue #8. you can run git status or git remote to get the repo name" --verbose

you can run the api by changing to the root of the project and running:
./run-api.sh

This is the test http client that is used for running the api endpoints. From the project root, run:
./test-api.js --stream "use the github mcp server to summarize issue #8. you can run git status or git remote to get the repo name"
