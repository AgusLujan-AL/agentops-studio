import { runQaSuite } from './qaRunner.js';

const report = runQaSuite();
console.log(`\n======================================================`);
console.log(`🧪 AGENTOPS STUDIO — SUITE DE 30 CASOS DE QA`);
console.log(`======================================================`);
for (const r of report.results) {
  console.log(`${r.passed ? '✅' : '❌'} [${r.id}] (${r.category}) ${r.title} -> ${r.routedTo} [${r.durationMs}ms]`);
}
console.log(`------------------------------------------------------`);
console.log(`Resultado: ${report.passedCount}/${report.totalCases} APROBADOS (${report.passRatePct}%) en ${report.totalDurationMs}ms\n`);
if (report.failedCount > 0) process.exit(1);
