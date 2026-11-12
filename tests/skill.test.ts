import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The agent skill in skills/wiro-nextjs shows its code inline in SKILL.md. Each
 * block is also a file in examples/, which `npm run typecheck` checks against the
 * starter's code. This test keeps the two copies the same.
 */

const SKILL_DIR = join(process.cwd(), 'skills', 'wiro-nextjs');
const EXAMPLES_DIR = join(SKILL_DIR, 'examples');
const skill = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');

function exampleFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? exampleFiles(join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
  );
}

/** Code blocks whose first line names their example file, such as `// lib/wiro.ts`. */
const blocks = [...skill.matchAll(/```tsx?\n(\/\/ (\S+)\n[\s\S]*?)```/g)].map((match) => ({
  path: match[2],
  code: match[1],
}));

describe('wiro-nextjs agent skill', () => {
  it('has the frontmatter skills.sh reads', () => {
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
    expect(frontmatter).toMatch(/^name: wiro-nextjs$/m);
    expect(frontmatter).toMatch(/^description: .{100,1024}$/m);
  });

  it('shows every example file once', () => {
    expect(blocks.map((block) => block.path).sort()).toEqual(exampleFiles(EXAMPLES_DIR).sort());
  });

  it.each(blocks)('shows $path exactly as the file is', ({ path, code }) => {
    expect(code).toBe(readFileSync(join(EXAMPLES_DIR, path), 'utf8'));
  });
});
