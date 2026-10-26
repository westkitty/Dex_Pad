import { spawnSync } from 'node:child_process';
const commands = [
  ['node', ['scripts/render-feature-matrix.mjs', '--check']],
  ['python3', ['scripts/verify_docs.py']],
  ['npm', ['test']],
  ['npm', ['run', 'build']],
];
for (const [cmd,args] of commands) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd,args,{ stdio:'inherit', shell:false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('\nCHECK PASS: docs, 25-feature roster, Node tests, static build. Real device/browser sync/security tests remain UNVERIFIED.');
