#!/usr/bin/env node
/**
 * Test script to verify name search detection and scope classification
 */

require('dotenv').config();
const QueryAnalyzer = require('../services/QueryAnalyzer');

async function testNameSearch() {
  console.log('🧪 Testing Name Search Detection\n');
  
  const analyzer = new QueryAnalyzer();
  
  const testQueries = [
    {
      query: 'Encontre o Rômulo Guimarães',
      expectedInScope: true,
      expectedIntent: 'knowledge',
      expectedDataNeeds: ['name_search']
    },
    {
      query: 'Busque Maria Silva',
      expectedInScope: true,
      expectedIntent: 'knowledge',
      expectedDataNeeds: ['name_search']
    },
    {
      query: 'Mostre o João Carlos',
      expectedInScope: true,
      expectedIntent: 'knowledge',
      expectedDataNeeds: ['name_search']
    },
    {
      query: 'Find John Smith',
      expectedInScope: true,
      expectedIntent: 'knowledge',
      expectedDataNeeds: ['name_search']
    },
    {
      query: 'Qual é a satisfação dos cidadãos?',
      expectedInScope: true,
      expectedIntent: 'knowledge',
      expectedDataNeeds: []
    },
    {
      query: 'Quero pedir uma pizza',
      expectedInScope: false,
      expectedIntent: 'out_of_scope',
      expectedDataNeeds: []
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testQueries) {
    console.log(`\n📝 Testing: "${test.query}"`);
    console.log('─'.repeat(60));
    
    try {
      const result = await analyzer.analyzeQuery(test.query);
      
      // Check scope
      const scopeOk = result.scope.inScope === test.expectedInScope;
      const blockedOk = result.blocked === !test.expectedInScope;
      const intentOk = result.intent === test.expectedIntent;
      
      // Check data needs
      const hasNameSearch = result.dataNeeds.includes('name_search');
      const dataNeedsOk = test.expectedDataNeeds.length === 0 
        ? !hasNameSearch 
        : test.expectedDataNeeds.every(need => result.dataNeeds.includes(need));
      
      console.log(`   Scope: ${result.scope.inScope ? '✅ IN-SCOPE' : '❌ OUT-OF-SCOPE'} (expected: ${test.expectedInScope ? 'IN-SCOPE' : 'OUT-OF-SCOPE'})`);
      console.log(`   Blocked: ${result.blocked ? '❌ YES' : '✅ NO'} (expected: ${!test.expectedInScope ? 'YES' : 'NO'})`);
      console.log(`   Intent: ${result.intent} (expected: ${test.expectedIntent})`);
      console.log(`   Data Needs: [${result.dataNeeds.join(', ')}]`);
      console.log(`   Confidence: ${(result.scope.confidence * 100).toFixed(1)}%`);
      console.log(`   Reason: ${result.scope.reason}`);
      
      if (scopeOk && blockedOk && intentOk && dataNeedsOk) {
        console.log(`   ✅ TEST PASSED`);
        passed++;
      } else {
        console.log(`   ❌ TEST FAILED`);
        if (!scopeOk) console.log(`      - Scope mismatch`);
        if (!blockedOk) console.log(`      - Blocked status mismatch`);
        if (!intentOk) console.log(`      - Intent mismatch`);
        if (!dataNeedsOk) console.log(`      - Data needs mismatch`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      console.error(error.stack);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  
  if (failed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run the test
testNameSearch().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

