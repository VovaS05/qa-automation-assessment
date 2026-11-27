import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, copyFile, cp, lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { pageFiles } from './policy.mts';

const origin = 'https://www.saucedemo.com';
const dependencies = ['@playwright/test', 'playwright', 'playwright-core', 'typescript', '@types/node', 'undici-types'];

export type SandboxReport = {
  typecheck: string;
  discovery: string | { expected: number; actual: number };
  execution: string | { status: string; exitCode: number | null; stats?: Record<string, number | string> };
  diagnostics?: string;
  reportError?: string;
  artifactError?: string;
  isolation?: unknown;
};

async function snapshot(stage: string) {
  const target = join(stage, 'snapshot');
  await mkdir(join(target, 'assets'), { recursive: true });
  const resources: { path: string; sha256: string }[] = [];
  async function capture(path: string, targetFile: string) {
    const response = await fetch(`${origin}${path}`, { redirect: 'error', signal: AbortSignal.timeout(12_000) });
    if (!response.ok || !response.body) throw new Error(`SauceDemo capture failed for ${path} (HTTP ${response.status})`);
    const chunks: Uint8Array[] = [];
    let length = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > 2_000_000) throw new Error(`SauceDemo resource exceeds the capture limit: ${path}`);
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = Buffer.concat(chunks);
    await writeFile(targetFile, bytes);
    resources.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
    return bytes;
  }
  const html = await capture('/', join(target, 'index.html'));
  const paths = new Set(Array.from(html.toString().matchAll(/(?:src|href)=["'](\/assets\/[\w.-]+\.(?:js|css))["']/g), match => match[1]));
  if (!Array.from(paths).some(path => path.endsWith('.js')) || paths.size > 12) {
    throw new Error('Expected a bundled SauceDemo entry point with same-origin scripts');
  }
  const assets: Record<string, string> = {};
  for (const path of paths) {
    assets[path] = path.endsWith('.js') ? 'text/javascript' : 'text/css';
    await capture(path, join(target, path));
  }
  await writeFile(join(target, 'assets.json'), JSON.stringify(assets));
  return { origin, resources };
}

async function setStagePermissions(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await setStagePermissions(path);
    } else if (entry.isFile()) {
      const { mode } = await lstat(path);
      await chmod(path, mode & 0o111 ? 0o755 : 0o644);
    }
  }
  await chmod(directory, 0o755);
}

export async function runSandbox(repo: string, run: string, source: string) {
  const env = { PATH: process.env.PATH, HOME: homedir(), DOCKER_CONFIG: process.env.DOCKER_CONFIG };
  const context = process.env.BONUS_DOCKER_CONTEXT ||
    spawnSync('docker', ['context', 'show'], { env, encoding: 'utf8', timeout: 10_000 }).stdout?.trim();
  if (!context) throw new Error('A local Docker context is required for bonus execution');
  function docker(args: string[], timeout = 20_000, input?: Buffer) {
    return spawnSync('docker', ['--context', context!, ...args], {
      env, timeout, input, maxBuffer: 32 * 1024 * 1024,
    });
  }
  function successful(args: string[], timeout?: number, input?: Buffer): Buffer {
    const result = docker(args, timeout, input);
    if (result.status !== 0) {
      throw new Error(result.error?.message || result.stderr?.toString().trim() || `docker ${args[0]} failed`);
    }
    return result.stdout;
  }

  const endpoint = successful(['context', 'inspect', context, '--format', '{{.Endpoints.docker.Host}}']).toString().trim();
  if (!endpoint.startsWith('unix:///')) throw new Error('Bonus execution requires a local Docker Unix socket');

  const { version } = JSON.parse(await readFile(join(repo, 'node_modules/@playwright/test/package.json'), 'utf8'));
  const image = `mcr.microsoft.com/playwright:v${version}-noble`;
  const imageResult = docker(['image', 'inspect', image, '--format', '{{.Id}}']);
  if (imageResult.status !== 0) throw new Error(`Local Playwright image is unavailable. Pull ${image} in the selected Docker context.`);
  const imageId = imageResult.stdout.toString().trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('Docker returned an invalid image ID');

  const temporary = await mkdtemp(join(tmpdir(), 'qa-bonus-suite-'));
  const stage = join(temporary, 'suite');
  let container: string | undefined;
  try {
    const app = await snapshot(stage);
    await mkdir(join(stage, 'pages'));
    for (const name of pageFiles) {
      await copyFile(join(repo, 'pages', `${name}.ts`), join(stage, 'pages', `${name}.ts`));
    }
    for (const name of dependencies) {
      await cp(join(repo, 'node_modules', name), join(stage, 'node_modules', name), { recursive: true });
    }
    for (const name of ['playwright.config.ts', 'sandbox.cjs']) {
      await copyFile(join(repo, 'bonus', name), join(stage, name));
    }
    await writeFile(join(stage, 'generated.spec.ts'), source);
    await writeFile(join(stage, 'generated-tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext', types: ['node'] },
      files: ['generated.spec.ts'],
    }));
    await setStagePermissions(stage);
    // Docker can preserve source ownership, so set root ownership in the archive.
    const archiver = process.platform === 'darwin'
      ? { command: '/usr/bin/tar', options: ['--uid', '0', '--gid', '0',
        '--no-xattrs', '--no-acls', '--no-fflags', '--no-mac-metadata'] }
      : { command: 'tar', options: ['--owner=0', '--group=0', '--numeric-owner'] };
    const stagedArchive = spawnSync(archiver.command, ['-czf', '-', ...archiver.options, '-C', stage, '.'], {
      env, timeout: 20_000, maxBuffer: 32 * 1024 * 1024,
    });
    if (stagedArchive.status !== 0) {
      throw new Error(stagedArchive.error?.message || stagedArchive.stderr?.toString().trim() || 'Could not archive the staged suite');
    }
    const id = successful([
      'create', '--pull=never', '--network=none', '--user=1000:1000', '--init',
      '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=192',
      '--memory=2g', '--cpus=2', '--shm-size=256m', '--workdir=/suite', '--env=HOME=/tmp',
      '--entrypoint=node', imageId, 'sandbox.cjs',
    ]).toString().trim();
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Docker returned an invalid container ID');
    container = id;
    successful(['cp', '-', `${container}:/suite`], 45_000, stagedArchive.stdout);
    const settings = JSON.parse(successful(['inspect', container]).toString())[0];
    if (settings.HostConfig.NetworkMode !== 'none' || settings.Mounts.length !== 0 ||
        settings.HostConfig.Privileged || settings.Config.User !== '1000:1000') {
      throw new Error('Docker container settings failed the isolation check');
    }
    const result = docker(['start', '-a', container], 110_000);
    const log = result.stdout?.toString().trim() ?? '';
    await writeFile(join(run, 'sandbox.log'), [log, result.stderr?.toString() ?? ''].join('\n'));
    if (result.error || ![0, 4, 5, 6].includes(result.status ?? -1)) {
      throw new Error(result.error?.message ?? `Sandbox process returned ${result.status}`);
    }
    const report = JSON.parse(log) as SandboxReport;
    let artifact: string | undefined;
    if (typeof report.execution === 'object') {
      try {
        const archive = successful(['cp', `${container}:/tmp/qa-bonus-output/.`, '-']);
        await writeFile(join(run, 'playwright-artifacts.tar'), archive);
        artifact = 'playwright-artifacts.tar';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        report.artifactError = `The sandbox report archive could not be exported: ${message}`;
      }
    }
    const exitCode = result.status === 0 && !artifact ? 6 : result.status as 0 | 4 | 5 | 6;
    return { exitCode, report, image, imageId, app, artifact };
  } finally {
    if (container) docker(['rm', '-f', container]);
    await rm(temporary, { recursive: true, force: true });
  }
}
