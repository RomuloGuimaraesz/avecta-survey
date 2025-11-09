#!/usr/bin/env node
/**
 * Quick Check - Fast validation of AI Assistant core functionality
 * Use this for quick smoke tests before deployment
 */

const orchestrator = require('./orchestrator');

const criticalQueries = [
  'Mostrar análise de satisfação',
  'Encontrar moradores insatisfeitos',
  'Listar moradores interessados em participar'
];

async function quickCheck() {
  console.log('🚀 Quick Check - AI Assistant Core Functionality\n');
  
  let allPassed = true;
  
  for (const query of criticalQueries) {
    console.log(`Testing: "${query}"`);
    
    try {
      const result = await orchestrator(query);
      
      const checks = {
        success: result.success === true,
        hasResponse: !!result.response && result.response.length > 50,
        correctIntent: result.intent === 'knowledge' || result.intent === 'notification',
        noErrors: !result.response?.includes('Não encontrei registros') && 
                 !result.response?.includes('Error processing'),
        fastResponse: result.processingTime < 5000
      };
      
      const passed = Object.values(checks).every(v => v === true);
      
      if (passed) {
        console.log('  ✅ PASSED\n');
      } else {
        console.log('  ❌ FAILED');
        Object.entries(checks).forEach(([check, value]) => {
          if (!value) {
            console.log(`    - ${check}: FAILED`);
          }
        });
        console.log('');
        allPassed = false;
      }
      
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}\n`);
      allPassed = false;
    }
  }
  
  if (allPassed) {
    console.log('✅ All critical queries passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some queries failed. Run full test suite for details.\n');
    process.exit(1);
  }
}

quickCheck();

