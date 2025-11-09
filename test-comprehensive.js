#!/usr/bin/env node
/**
 * Comprehensive Test Suite for AI Assistant
 * Tests all capabilities and functionalities systematically
 */

const orchestrator = require('./orchestrator');
const { QUERY_TEMPLATES } = require('./public/js/shared/queryTemplates.js');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

function logTest(name) {
  log(`\n📋 ${name}`, 'cyan');
  console.log('-'.repeat(70));
}

function logResult(passed, message) {
  const icon = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${message}`, color);
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test categories
const testCategories = {
  quickSuggestions: {
    name: 'Quick Suggestion Buttons',
    queries: QUERY_TEMPLATES.map(t => t.query)
  },
  
  analysisQueries: {
    name: 'Analysis Queries',
    queries: [
      'Análise de satisfação',
      'Mostrar análise de satisfação',
      'Relatório de satisfação',
      'Estatísticas de satisfação',
      'Análise por bairro',
      'Quais bairros têm mais problemas',
      'Satisfação por idade',
      'Análise por faixa etária'
    ]
  },
  
  notificationQueries: {
    name: 'Notification Queries',
    queries: [
      'Listar moradores insatisfeitos',
      'Mostrar cidadãos satisfeitos',
      'Quem está interessado em participar',
      'Moradores que não querem participar',
      'Enviar mensagem para insatisfeitos'
    ]
  },
  
  nameSearchQueries: {
    name: 'Name Search Queries',
    queries: [
      // These would need actual names from your database
      // 'Encontrar João Silva',
      // 'Buscar Maria Santos'
    ]
  },
  
  edgeCases: {
    name: 'Edge Cases',
    queries: [
      'Análise', // Very generic
      'Mostrar', // No context
      'Análise de satisfaçao', // Typo (no accent)
      'Show satisfaction analysis', // English
      'Listar' // Incomplete
    ]
  }
};

async function testQuery(query, category) {
  const result = {
    query,
    category,
    passed: false,
    issues: [],
    warnings: [],
    metrics: {}
  };
  
  try {
    const startTime = Date.now();
    const response = await orchestrator(query);
    const processingTime = Date.now() - startTime;
    
    result.metrics.processingTime = processingTime;
    result.metrics.success = response.success === true;
    result.metrics.hasResponse = !!response.response && response.response.length > 0;
    result.metrics.responseLength = response.response?.length || 0;
    result.metrics.hasReport = !!response.report;
    result.metrics.hasInsights = Array.isArray(response.insights) && response.insights.length > 0;
    result.metrics.hasRecommendations = Array.isArray(response.recommendations) && response.recommendations.length > 0;
    result.metrics.hasResidents = Array.isArray(response.residents) && response.residents.length > 0;
    result.metrics.intent = response.intent;
    result.metrics.queryType = response.queryAnalysis?.queryType;
    
    // Check for errors
    const hasError = response.response?.includes('Não encontrei registros') ||
                    response.response?.includes('Error processing') ||
                    response.response?.includes('not found') ||
                    response.response?.includes('erro');
    
    // Quality checks
    const hasUsefulContent = response.response?.length > 50 && !hasError;
    const isGeneric = response.response?.length < 100 && !hasError;
    
    // Category-specific checks
    if (category === 'analysisQueries' || category === 'quickSuggestions') {
      if (!result.metrics.hasReport) {
        result.issues.push('No report generated for analysis query');
      }
      if (!result.metrics.hasInsights) {
        result.issues.push('No insights provided for analysis query');
      }
      if (!result.metrics.hasRecommendations) {
        result.issues.push('No recommendations provided for analysis query');
      }
      if (result.metrics.intent !== 'knowledge') {
        result.warnings.push(`Intent is '${result.metrics.intent}' but expected 'knowledge'`);
      }
    }
    
    if (category === 'notificationQueries') {
      if (!result.metrics.hasResidents && !hasError) {
        result.warnings.push('No residents list provided for notification query');
      }
      if (result.metrics.intent !== 'notification') {
        result.warnings.push(`Intent is '${result.metrics.intent}' but expected 'notification'`);
      }
    }
    
    // Performance check
    if (processingTime > 5000) {
      result.warnings.push(`Slow response time: ${processingTime}ms`);
    }
    
    // Generic checks
    if (!result.metrics.success) {
      result.issues.push('Query failed');
    }
    if (hasError) {
      result.issues.push('Response contains error message');
    }
    if (!hasUsefulContent) {
      result.issues.push('Response lacks useful content');
    }
    if (isGeneric) {
      result.warnings.push('Response may be too generic');
    }
    
    result.passed = result.issues.length === 0;
    result.response = response;
    
  } catch (error) {
    result.issues.push(`Fatal error: ${error.message}`);
    result.passed = false;
  }
  
  return result;
}

async function runCategoryTests(categoryName, category) {
  logSection(`Testing: ${category.name}`);
  
  const results = [];
  
  for (const query of category.queries) {
    logTest(query);
    const result = await testQuery(query, categoryName);
    results.push(result);
    
    // Log results
    logResult(result.passed, `Test ${result.passed ? 'PASSED' : 'FAILED'}`);
    
    if (result.metrics.processingTime) {
      logInfo(`Processing time: ${result.metrics.processingTime}ms`);
    }
    
    if (result.metrics.intent) {
      logInfo(`Intent: ${result.metrics.intent} (QueryType: ${result.metrics.queryType || 'N/A'})`);
    }
    
    if (result.metrics.hasReport) {
      logResult(true, 'Report generated');
      if (result.response.report?.metrics) {
        logInfo(`Report metrics: ${Object.keys(result.response.report.metrics).length} keys`);
      }
    } else if (categoryName === 'analysisQueries' || categoryName === 'quickSuggestions') {
      logResult(false, 'Report NOT generated (expected for analysis queries)');
    }
    
    if (result.metrics.hasInsights) {
      logResult(true, `Insights: ${result.response.insights.length}`);
    } else if (categoryName === 'analysisQueries' || categoryName === 'quickSuggestions') {
      logResult(false, 'Insights NOT provided (expected for analysis queries)');
    }
    
    if (result.metrics.hasRecommendations) {
      logResult(true, `Recommendations: ${result.response.recommendations.length}`);
    } else if (categoryName === 'analysisQueries' || categoryName === 'quickSuggestions') {
      logResult(false, 'Recommendations NOT provided (expected for analysis queries)');
    }
    
    if (result.metrics.hasResidents) {
      logResult(true, `Residents: ${result.response.residents.length}`);
    }
    
    if (result.issues.length > 0) {
      result.issues.forEach(issue => logResult(false, issue));
    }
    
    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => logWarning(warning));
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

async function generateSummary(allResults) {
  logSection('Test Summary');
  
  const totalTests = allResults.length;
  const passedTests = allResults.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  
  log(`\n📊 Overall Results:`, 'bright');
  logResult(true, `Passed: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  if (failedTests > 0) {
    logResult(false, `Failed: ${failedTests}/${totalTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
  }
  
  // Category breakdown
  const categoryStats = {};
  allResults.forEach(result => {
    if (!categoryStats[result.category]) {
      categoryStats[result.category] = { total: 0, passed: 0 };
    }
    categoryStats[result.category].total++;
    if (result.passed) {
      categoryStats[result.category].passed++;
    }
  });
  
  log(`\n📋 By Category:`, 'bright');
  Object.entries(categoryStats).forEach(([category, stats]) => {
    const percentage = ((stats.passed / stats.total) * 100).toFixed(1);
    const icon = stats.passed === stats.total ? '✅' : '⚠️';
    log(`${icon} ${category}: ${stats.passed}/${stats.total} (${percentage}%)`);
  });
  
  // Quality metrics
  const withReports = allResults.filter(r => r.metrics.hasReport).length;
  const withInsights = allResults.filter(r => r.metrics.hasInsights).length;
  const withRecommendations = allResults.filter(r => r.metrics.hasRecommendations).length;
  const avgProcessingTime = allResults
    .filter(r => r.metrics.processingTime)
    .reduce((sum, r) => sum + r.metrics.processingTime, 0) / 
    allResults.filter(r => r.metrics.processingTime).length;
  
  log(`\n📈 Quality Metrics:`, 'bright');
  logInfo(`Queries with reports: ${withReports}/${totalTests} (${((withReports/totalTests)*100).toFixed(1)}%)`);
  logInfo(`Queries with insights: ${withInsights}/${totalTests} (${((withInsights/totalTests)*100).toFixed(1)}%)`);
  logInfo(`Queries with recommendations: ${withRecommendations}/${totalTests} (${((withRecommendations/totalTests)*100).toFixed(1)}%)`);
  logInfo(`Average processing time: ${avgProcessingTime.toFixed(0)}ms`);
  
  // Failed tests details
  const failedResults = allResults.filter(r => !r.passed);
  if (failedResults.length > 0) {
    log(`\n❌ Failed Tests Details:`, 'bright');
    failedResults.forEach(result => {
      log(`\n  Query: ${result.query}`, 'red');
      result.issues.forEach(issue => log(`    - ${issue}`, 'red'));
    });
  }
  
  // Warnings
  const resultsWithWarnings = allResults.filter(r => r.warnings.length > 0);
  if (resultsWithWarnings.length > 0) {
    log(`\n⚠️  Warnings:`, 'bright');
    resultsWithWarnings.forEach(result => {
      log(`\n  Query: ${result.query}`, 'yellow');
      result.warnings.forEach(warning => log(`    - ${warning}`, 'yellow'));
    });
  }
}

async function runAllTests() {
  log('\n🧪 COMPREHENSIVE AI ASSISTANT TEST SUITE', 'bright');
  log('='.repeat(70));
  
  const allResults = [];
  
  // Run tests for each category
  for (const [categoryName, category] of Object.entries(testCategories)) {
    if (category.queries.length > 0) {
      const results = await runCategoryTests(categoryName, category);
      allResults.push(...results);
    }
  }
  
  // Generate summary
  await generateSummary(allResults);
  
  logSection('Test Complete');
  
  const totalPassed = allResults.filter(r => r.passed).length;
  const totalTests = allResults.length;
  
  if (totalPassed === totalTests) {
    log('\n🎉 All tests passed!', 'green');
    process.exit(0);
  } else {
    log(`\n⚠️  ${totalTests - totalPassed} test(s) failed. Review the details above.`, 'yellow');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

