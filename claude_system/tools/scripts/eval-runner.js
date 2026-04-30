#!/usr/bin/env node

/**
 * AI Output Evaluation Runner
 * Runs structured evaluations against AI-generated outputs.
 */

const fs = require('fs');
const path = require('path');

const EVAL_DIR = path.join(__dirname, '..', 'evals');
const RESULTS_DIR = path.join(__dirname, '..', '..', 'tests', 'ai-evals');

/**
 * @typedef {Object} EvalResult
 * @property {string} evalName
 * @property {boolean} passed
 * @property {number} score
 * @property {string[]} issues
 * @property {number} timestamp
 */

/**
 * Runs all evaluation files in the evals directory.
 * @returns {Promise<EvalResult[]>}
 */
async function runAllEvals() {
  const evalFiles = fs.readdirSync(EVAL_DIR).filter(f => f.endsWith('.json'));

  if (evalFiles.length === 0) {
    console.log('[eval-runner] No evaluation files found in', EVAL_DIR);
    return [];
  }

  const results = [];

  for (const file of evalFiles) {
    const evalPath = path.join(EVAL_DIR, file);
    const evalConfig = JSON.parse(fs.readFileSync(evalPath, 'utf-8'));

    const result = await runSingleEval(evalConfig);
    results.push(result);

    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[eval-runner] ${status} ${result.evalName} (score: ${result.score}/100)`);

    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`  ⚠️  ${issue}`));
    }
  }

  const outputPath = path.join(RESULTS_DIR, `eval-results-${Date.now()}.json`);
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n[eval-runner] Results saved to ${outputPath}`);

  return results;
}

/**
 * Runs a single evaluation against provided criteria.
 * @param {Object} evalConfig
 * @returns {Promise<EvalResult>}
 */
async function runSingleEval(evalConfig) {
  const issues = [];
  let score = 100;

  // Check completeness
  if (evalConfig.checks?.noPlaceholders) {
    const placeholders = ['TODO', 'FIXME', 'placeholder', 'mock', 'lorem ipsum'];
    for (const p of placeholders) {
      if (evalConfig.output?.includes(p)) {
        issues.push(`Found placeholder: "${p}"`);
        score -= 20;
      }
    }
  }

  // Check error handling
  if (evalConfig.checks?.errorHandling) {
    if (evalConfig.output && !evalConfig.output.includes('catch') && !evalConfig.output.includes('Error')) {
      issues.push('Missing error handling');
      score -= 15;
    }
  }

  // Check type safety
  if (evalConfig.checks?.noAnyType) {
    if (evalConfig.output?.includes(': any')) {
      issues.push('Found `any` type usage');
      score -= 10;
    }
  }

  return {
    evalName: evalConfig.name || 'unnamed',
    passed: score >= 70,
    score: Math.max(0, score),
    issues,
    timestamp: Date.now(),
  };
}

// Execute
runAllEvals().catch(err => {
  console.error('[eval-runner] Fatal error:', err.message);
  process.exit(1);
});
