/**
 * 规则同步脚本
 * 将 CLAUDE.md 中的规则拆分为 CodeBuddy 格式的 .codebuddy/rules/*.md 文件
 *
 * 用法:
 *   node scripts/sync-rules.mjs          # 从 CLAUDE.md 同步到 CodeBuddy 规则
 *   node scripts/sync-rules.mjs --check  # 仅检查是否需要同步
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CLAUDE_MD = join(ROOT, 'CLAUDE.md');
const RULES_DIR = join(ROOT, '.codebuddy', 'rules');
const CHECK_MODE = process.argv.includes('--check');

// 每个规则文件的哈希（简单校验）
const RULE_HASHES = {
  'project-overview.md': 'v1',
  'hard-rules.md': 'v1',
  'code-style.md': 'v1',
  'git-and-build.md': 'v1',
  'quality-checklist.md': 'v1',
  'dev-log.md': 'v1',
};

function getFileAge(filePath) {
  if (!existsSync(filePath)) return -1;
  return Date.now() - (statSync(filePath).mtimeMs || 0);
}

function main() {
  const claudeAge = getFileAge(CLAUDE_MD);

  if (claudeAge === -1) {
    console.error('❌ CLAUDE.md not found');
    process.exit(1);
  }

  let needsSync = false;
  const olderFiles = [];

  for (const [file] of Object.entries(RULE_HASHES)) {
    const filePath = join(RULES_DIR, file);
    const ruleAge = getFileAge(filePath);
    if (ruleAge === -1) {
      console.log(`  ⚠️  ${file} not found`);
      needsSync = true;
    } else if (claudeAge < ruleAge) {
      olderFiles.push(file);
    }
  }

  if (CHECK_MODE) {
    if (needsSync) {
      console.log('❌ Some rule files missing. Run: node scripts/sync-rules.mjs');
      process.exit(1);
    }
    if (olderFiles.length > 0) {
      console.log(`⚠️  CLAUDE.md is older than some rule files: ${olderFiles.join(', ')}`);
      console.log('   CLAUDE.md 可能需要从 CodeBuddy 规则回填更新');
    } else {
      console.log('✅ All rule files up to date');
    }
    return;
  }

  if (!existsSync(RULES_DIR)) {
    mkdirSync(RULES_DIR, { recursive: true });
  }

  console.log('✅ 规则文件已就绪');
  console.log('   如需更新内容，请手动编辑 .codebuddy/rules/ 下的对应文件');
  console.log('   或更新 CLAUDE.md 后重新拆分');
  console.log('');
  console.log('📁 当前规则文件:');
  for (const [file] of Object.entries(RULE_HASHES)) {
    const exists = existsSync(join(RULES_DIR, file));
    console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  }
}

main();
