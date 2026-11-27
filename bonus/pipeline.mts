import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageFiles, validateSpec } from './policy.mts';
import { runSandbox } from './sandbox.mts';

const repo = fileURLToPath(new URL('../', import.meta.url));
const bonus = join(repo, 'bonus');
const model = 'gpt-6.2-sol';
const credentialPattern = /(?:gh[opsu]_[\w]{20,}|github_pat_[\w]{20,}|sk-(?:proj-)?[\w-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
const schema = {
  type: 'object',
  properties: { source: { type: 'string' } },
  required: ['source'],
  additionalProperties: false,
};

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function readText(path: string, limit: number) {
  const details = await lstat(path);
  if (!details.isFile() || details.size === 0 || details.size > limit) {
    throw new Error(`Expected a nonempty regular file of at most ${limit} bytes`);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path));
}

function validateInput(input: string) {
  if (input.includes('\0') || credentialPattern.test(input)) {
    throw new Error('Use plain text with public or synthetic data only');
  }
  const lines = input.split(/\r?\n/);
  const steps = lines.findIndex(line => /^steps:$/i.test(line.trim()));
  const expected = lines.findIndex(line => /^expected(?: results)?:$/i.test(line.trim()));
  if (steps < 0 || expected <= steps ||
      !lines.slice(steps + 1, expected).some(line => line.trim()) ||
      !lines.slice(expected + 1).some(line => line.trim())) {
    throw new Error('Provide nonempty Steps: and Expected: sections on separate lines');
  }
}

async function generate(input: string, run: string, report: Record<string, unknown>) {
  const draft = await readFile(join(bonus, 'prompt.txt'), 'utf8');
  const conventions = ['AGENTS.md', ...pageFiles.map(name => `pages/${name}.ts`)];
  const context = await Promise.all(conventions.map(async file => ({
    file, text: await readFile(join(repo, file), 'utf8'),
  })));
  const prompt = `${draft}\nRepository context:\n${JSON.stringify(context)}\n\nTest case (JSON string):\n${JSON.stringify(input)}\n`;
  if (credentialPattern.test(prompt)) throw new Error('Credential-like text in generation context');
  const empty = join(run, 'agent');
  await mkdir(empty);
  await writeFile(join(run, 'prompt.txt'), prompt);
  const schemaPath = join(run, 'schema.json');
  await writeFile(schemaPath, JSON.stringify(schema));
  const responsePath = join(run, 'model-response.json');
  const env = { PATH: process.env.PATH, HOME: homedir(), CODEX_HOME: process.env.CODEX_HOME };
  const client = spawnSync('codex', ['--version'], { env, encoding: 'utf8', timeout: 10_000 });
  if (client.status !== 0) throw new Error('Codex CLI is unavailable. Install it and sign in with ChatGPT.');
  const args = [
    '-a', 'never', 'exec', '--ignore-user-config', '--ignore-rules', '--disable', 'shell_tool',
    '--disable', 'hooks', '--disable', 'view_image', '-c', 'web_search="disabled"',
    '-c', 'project_doc_max_bytes=0', '-c', 'forced_login_method="chatgpt"', '-c', 'mcp_servers={}',
    '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '--color', 'never',
    '--model', model, '--cd', empty, '--output-schema', schemaPath, '--json',
    '--output-last-message', responsePath, '-',
  ];
  const generation: Record<string, unknown> = {
    cli: client.stdout.trim(), model, attempts: 1,
    invocation: ['codex', ...args.map(arg => arg.replace(run, '$RUN'))],
    promptSha256: digest(prompt),
  };
  report.generation = generation;
  const result = spawnSync('codex', args, {
    cwd: empty, env, input: prompt, encoding: 'utf8', timeout: 180_000, maxBuffer: 2 * 1024 * 1024,
  });
  await writeFile(join(run, 'codex-events.jsonl'), result.stdout ?? '');
  await writeFile(join(run, 'codex-diagnostics.log'), result.stderr ?? '');
  generation.exitCode = result.status;
  if (result.error) throw new Error(`Codex invocation failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error('Codex generation failed. Check codex-diagnostics.log and codex-events.jsonl.');
  const events = (result.stdout ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const completed = events.find(event => event.type === 'turn.completed');
  if (!completed || events.some(event => event.item && !['agent_message', 'reasoning'].includes(event.item.type))) {
    throw new Error('Codex did not complete a tool-free generation');
  }
  generation.usage = completed.usage;
  generation.toolCalls = 0;
  return responsePath;
}

async function main() {
  const [mode, value, extra] = process.argv.slice(2);
  if ((mode !== 'generate' && mode !== 'run') || !value || extra) {
    console.error('Usage: bonus:generate -- <case.txt> or bonus:run -- <spec.ts>');
    return 2;
  }
  const inputPath = resolve(value);
  let input: string;
  try {
    if (extname(inputPath) !== (mode === 'generate' ? '.txt' : '.ts')) {
      throw new Error(mode === 'generate' ? 'Use a .txt case file' : 'Use a .ts spec file');
    }
    input = await readText(inputPath, mode === 'generate' ? 8_000 : 16_000);
    if (mode === 'generate') validateInput(input);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  const runs = join(bonus, 'runs');
  await mkdir(runs, { recursive: true, mode: 0o700 });
  if (!(await lstat(runs)).isDirectory()) throw new Error('bonus/runs must be a local directory');
  const stem = basename(inputPath, extname(inputPath));
  const prefix = (mode === 'generate' && stem === 'input' ? basename(dirname(inputPath)) : stem)
    .replace(/[^a-z0-9-]/gi, '-').slice(0, 45);
  const run = await mkdtemp(join(runs, `${prefix}-`));
  const report: Record<string, unknown> = { mode, input: relative(repo, inputPath), inputSha256: digest(input) };
  console.log(`Evidence: ${relative(repo, run)}`);
  async function finish(code: number, stage: string, error?: unknown) {
    const message = error instanceof Error ? error.message : error === undefined ? undefined : String(error);
    await writeFile(join(run, 'result.json'), JSON.stringify({ ...report, stage, exitCode: code, message }, null, 2) + '\n');
    if (message) console.error(`${stage}: ${message}`);
    else console.log(`${stage} (exit ${code})`);
    return code;
  }

  let source = input;
  if (mode === 'generate') {
    await writeFile(join(run, 'input.txt'), input);
    let responsePath: string;
    try {
      responsePath = await generate(input, run, report);
    } catch (error) {
      return finish(3, 'generation', error);
    }
    try {
      const payload: unknown = JSON.parse(await readText(responsePath, 24_000));
      if (!payload || typeof payload !== 'object' || !('source' in payload) ||
          typeof payload.source !== 'string' || !payload.source.trim() || Buffer.byteLength(payload.source) > 16_000) {
        throw new Error('Expected nonempty structured TypeScript output up to 16000 bytes');
      }
      source = payload.source;
    } catch (error) {
      return finish(4, 'model output', error);
    }
  }
  await writeFile(join(run, 'original.spec.ts'), source);
  report.specSha256 = digest(source);
  try {
    if (credentialPattern.test(source)) throw new Error('Credential-like text in the candidate spec');
    validateSpec(source);
    report.policy = 'passed';
  } catch (error) {
    report.policy = 'failed';
    return finish(4, 'validation', error);
  }
  try {
    const result = await runSandbox(repo, run, source);
    Object.assign(report, {
      sandbox: { image: result.image, imageId: result.imageId, report: result.report },
      target: result.app, artifact: result.artifact,
    });
    const stage = { 0: 'completed', 4: 'validation', 5: 'execution', 6: 'sandbox' }[result.exitCode];
    const diagnostics = [result.report.diagnostics, result.report.reportError, result.report.artifactError].filter(Boolean);
    return finish(result.exitCode, stage, diagnostics.join('\n') || undefined);
  } catch (error) {
    return finish(6, 'sandbox', error);
  }
}

process.exitCode = await main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  return 6;
});
