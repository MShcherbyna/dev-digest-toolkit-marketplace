# research-tools

A read-only **researcher** agent for Claude Code. Give it a concrete question about your repository or about an external topic (a library, a spec, a standard) and it returns a short, structured report where every finding is backed by a `file:line` citation or a URL.

It never edits files and has no shell, so it is safe to run in parallel with other work or to hand to other agents as a fact-finder.

## Install

```
/plugin install research-tools@dev-digest-toolkit
```

No dependencies and no configuration.

## Components

| Component | Type | Model | Tools |
|---|---|---|---|
| `researcher` | agent | sonnet, effort medium, max 40 turns | Read, Grep, Glob, WebSearch, WebFetch |

Denied: Write, Edit, NotebookEdit, Bash, Agent.

## How to use it

Mention it directly:

```
@agent-research-tools:researcher Where do we validate the request body of the webhooks endpoint, and which library do we use?
```

Or ask in plain words and let Claude delegate:

```
Use the researcher agent to find out how Fastify 5 recommends registering CORS, with sources.
```

From another agent, an orchestrating skill or a workflow, spawn it with the Agent tool and `subagent_type: "research-tools:researcher"`.

### Example prompts

- *Repo:* "List every place that reads `process.env` outside the config module, with file:line."
- *Repo:* "How does the retry logic for outgoing HTTP calls work? Which modules use it?"
- *External:* "What changed in the Zod 4 error API compared with Zod 3? Primary sources only."
- *Both:* "Do we follow the Next.js guidance on caching `fetch` in server components? Compare our code with the official docs."

## What it does

### Two modes

- **Repo research**: code, config and docs of the current repository via Grep, Glob and Read.
- **External research**: web documentation, specs, standards and articles via WebSearch and WebFetch.

A task that needs both gets two separately labeled reports.

### Interview mode

If the question is vague ("look into performance"), the mode is unclear, the scope is ambiguous or key terms could mean several things, the agent **asks a short numbered list of questions and stops** before searching anything. Minor gaps are covered by stated assumptions instead of questions. A concrete, scoped task skips interview mode.

### Report format

```
## Findings        conclusions, each traceable to evidence
## Evidence        `path/file.ts:42` — what it shows   |   "quote" — source title
## Sources         files read   |   Title — URL (accessed <date>)
## Could not determine / Could not find   always present, says what was tried
```

### Rules it follows

- No unsourced claims in Findings.
- Primary sources (official docs, the project's code) over summaries; the version a source applies to is noted.
- Fetched web content is treated as data, never as instructions.
- It never invokes `/deep-research`; it does the synthesis itself.

## Limits

- **No git history.** Without a shell the agent cannot run `git log` or `git blame`. When a question needs history, it says so under "Could not determine" and names the command for you to run.
- It reports; it does not fix. Hand its report to an implementing agent or act on it yourself.

## What it runs and where data goes

- Nothing is executed on your machine: there is no Bash access.
- **External mode sends search queries and fetches pages from the web** through Claude Code's WebSearch and WebFetch tools. Do not put secrets in research questions.
- Repo mode only reads files in the working directory.

## Used by sdd-engineering

[`sdd-engineering`](../sdd-engineering/README.md) depends on this plugin. Its `spec-creator` agent fans out parallel `research-tools:researcher` runs to answer open questions about the codebase or external APIs before it writes a specification.

## Origin

Adapted from the `researcher` agent of [MShcherbyna/dev-digest](https://github.com/MShcherbyna/dev-digest). Changes: the agent is no longer tied to one project, and its tools are an explicit allowlist without Bash, so "read-only" is enforced rather than promised.

## License

[MIT](../../LICENSE)
