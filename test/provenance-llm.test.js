require('dotenv').config();
const assert = require('assert');
const orchestrator = require('../orchestrator');

/*
 * provenance-llm.test.js
 * Verifies that when CLAUDE_API_KEY is present and LLM enhancement succeeds,
 * the orchestrator exposes provenance.source = 'knowledge_agent+claude_llm' and llm.used true.
 * If no key, test will skip gracefully but still assert baseline provenance shape.
 */

(async () => {
  const hasKey = !!process.env.CLAUDE_API_KEY;
  const query = 'Gerar um relatorio municipal abrangente com bairros e satisfacao';
  const res = await orchestrator(query);

  try {
    assert.ok(res.provenance, 'provenance object missing');
    assert.strictEqual(res.provenance.agentType, res.intent, 'agentType should mirror intent');
    assert.ok(typeof res.provenance.source === 'string', 'provenance.source missing');
    assert.ok(res.provenance.llm, 'provenance.llm missing');
    if (hasKey) {
      // When key is present we expect attempt; may still be data-driven if quality gate failed
      if (res.llmEnhanced) {
        assert.strictEqual(res.provenance.source, 'knowledge_agent+claude_llm', 'Expected claude_llm provenance source');
        assert.strictEqual(res.provenance.llm.used, true, 'LLM marked used');
        assert.strictEqual(res.provenance.llm.provider, 'claude', 'Provider should be claude');
      } else {
        console.warn('[provenance-llm.test] LLM key present but enhancement not adopted (quality gate)');
        assert.ok(['knowledge_agent','knowledge_agent+claude_llm'].includes(res.provenance.source), 'Source unexpected when LLM not adopted');
      }
    } else {
      // No key = must not claim LLM usage
      assert.notStrictEqual(res.provenance.source, 'knowledge_agent+claude_llm', 'Should not mark claude_llm without key');
      assert.ok(!res.llmEnhanced, 'llmEnhanced should be false without key');
    }

    // Data version fields optional but if present must be strings or null
    if (res.provenance.dataVersions) {
      const dv = res.provenance.dataVersions;
      ['satisfaction','neighborhoods'].forEach(k => {
        if (dv[k] !== null && dv[k] !== undefined) {
          assert.ok(typeof dv[k] === 'string', `dataVersions.${k} must be string or null`);
        }
      });
    }

    console.log(JSON.stringify({
      test: 'provenance-llm',
      passed: true,
      llmEnhanced: res.llmEnhanced || false,
      source: res.provenance.source,
      provider: res.provenance.llm.provider || null,
      model: res.provenance.llm.model || null
    }, null, 2));
  } catch (e) {
    console.error('Provenance LLM test FAILED:', e.message);
    process.exit(1);
  }
})();
