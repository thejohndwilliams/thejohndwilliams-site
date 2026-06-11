// Fail fast on node versions that silently break the test suite.
// node 25 on the Mac made build/manifest/a11y suites fail at import
// ("No such built-in module: node:...") while the summary still printed
// green for the suites that DID run — ~50 tests silently skipped.
// CI pins node 24 (lighthouse.yml + ci.yml); .nvmrc pins 24 locally.
const major = Number(process.versions.node.split('.')[0]);
if (major >= 25) {
  console.error(`\nnode ${process.versions.node} is known to break the vitest suite imports.`);
  console.error('Use node 24:  export PATH="/opt/homebrew/opt/node@24/bin:$PATH"');
  console.error('(or: nvm use — .nvmrc pins 24)\n');
  process.exit(1);
}
if (major < 20) {
  console.error(`node ${process.versions.node} is older than the supported floor (20).`);
  process.exit(1);
}
console.log(`check-node: node ${process.versions.node} OK`);
