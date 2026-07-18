# ClipFlow Script Generator

Generates structured short-form video scripts using OpenAI's GPT-4o-mini.

## Setup

```bash
# Install dependencies (from project root)
cd /home/team/shared/clipflow
bun install   # or npm install

# Set your OpenAI API key
export OPENAI_API_KEY="sk-..."
```

## Usage

### CLI

```bash
npx tsx src/script-generator/cli.ts --topic "why morning routines fail"
npx tsx src/script-generator/cli.ts --topic "fitness myths" --tone "humorous" --duration 30
```

Output is JSON printed to stdout:

```json
{
  "hook": "Stop setting your alarm for 5 AM...",
  "body": "Most morning routines fail because...",
  "cta": "Follow for more evidence-based productivity tips...",
  "estimatedDurationSec": 48,
  "topic": "why morning routines fail"
}
```

### Programmatic

```ts
import { generateScript } from "./src/script-generator/generator.js";

const script = await generateScript("why morning routines fail", {
  tone: "casual",
  durationSec: 45,
});

console.log(script.hook);
console.log(script.body);
console.log(script.cta);
console.log(`~${script.estimatedDurationSec}s of spoken content`);
```

## Script Structure

| Field | Description |
|-------|-------------|
| `hook` | Attention-grabbing opening (~first 3s) |
| `body` | Main content delivering value |
| `cta` | Call-to-action driving engagement |
| `estimatedDurationSec` | Estimated spoken duration (2.5 words/sec) |
| `topic` | Original topic string |

## API

### `generateScript(topic, options?)`

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `topic` | `string` | Yes | — | The video topic or idea |
| `options.tone` | `string` | No | — | Desired tone (e.g. "professional", "casual") |
| `options.durationSec` | `number` | No | `45` | Target duration 30–60 seconds |

**Returns**: `Promise<Script>`

**Throws**: Descriptive error if `OPENAI_API_KEY` is missing or if the API fails after a retry.

## Environment

- `OPENAI_API_KEY` — Your OpenAI API key (required)

## Testing

```bash
bun run test
```
