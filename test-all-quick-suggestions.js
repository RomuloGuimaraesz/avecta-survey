#!/usr/bin/env node
/**
 * Comprehensive test for all quick-suggestion buttons
 * Tests each query template to ensure they work correctly and generate useful reports
 */

const orchestrator = require('./orchestrator');
const { QUERY_TEMPLATES } = require('./public/js/shared/queryTemplates.js');

async function testQuickSuggestion(template) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 Testing: "${template.label}"`);
  console.log(`   Query: "${template.query}"`);
  console.log(`   Category: ${template.category}`);
  console.log('─'.repeat(70));
  
  try {
    const result = await orchestrator(template.query);
    
    // Check basic success
    const basicChecks = {
      success: result.success === true,
      hasResponse: !!result.response && result.response.length > 0,
      hasIntent: !!result.intent,
      correctIntent: result.intent === template.category || 
                    (template.category === 'knowledge' && result.intent === 'knowledge') ||
                    (template.category === 'notification' && result.intent === 'notification')
    };
    
    // Check for error messages
    const hasError = result.response?.includes('Não encontrei registros') ||
                    result.response?.includes('Error processing') ||
                    result.response?.includes('not found') ||
                    result.response?.includes('erro');
    
    // Check for useful content
    const hasUsefulContent = result.response?.length > 50 && !hasError;
    
    // Check for report
    const hasReport = !!result.report;
    const reportQuality = result.report ? {
      hasText: !!result.report.text && result.report.text.length > 0,
      hasMetrics: !!result.report.metrics && Object.keys(result.report.metrics).length > 0,
      hasType: !!result.report.type
    } : null;
    
    // Check for insights/recommendations
    const hasInsights = Array.isArray(result.insights) && result.insights.length > 0;
    const hasRecommendations = Array.isArray(result.recommendations) && result.recommendations.length > 0;
    
    // Check statistics
    const hasStatistics = !!result.statistics && 
                         (result.statistics.totalContacts > 0 || result.statistics.responseRate !== undefined);
    
    // Print results
    console.log(`✅ Success: ${basicChecks.success ? '✓' : '✗'}`);
    console.log(`📝 Has Response: ${basicChecks.hasResponse ? '✓' : '✗'}`);
    console.log(`🎯 Intent: ${result.intent || 'N/A'} (Expected: ${template.category})`);
    console.log(`📊 Query Type: ${result.queryAnalysis?.queryType || 'N/A'}`);
    console.log(`⏱️  Processing Time: ${result.processingTime}ms`);
    
    if (hasError) {
      console.log(`\n❌ ERROR DETECTED in response!`);
      console.log(`   Response: ${result.response?.substring(0, 200)}...`);
    } else {
      console.log(`\n✅ No errors in response`);
    }
    
    if (hasUsefulContent) {
      console.log(`✅ Response has useful content (${result.response?.length} chars)`);
      console.log(`   Preview: ${result.response?.substring(0, 150)}...`);
    } else {
      console.log(`⚠️  Response may lack useful content`);
    }
    
    if (hasReport) {
      console.log(`\n📄 Report Available:`);
      console.log(`   Type: ${reportQuality.hasType ? '✓' : '✗'} ${result.report.type || 'N/A'}`);
      console.log(`   Text: ${reportQuality.hasText ? '✓' : '✗'} (${result.report.text?.length || 0} chars)`);
      console.log(`   Metrics: ${reportQuality.hasMetrics ? '✓' : '✗'} (${Object.keys(result.report.metrics || {}).length} keys)`);
      if (result.report.text) {
        console.log(`   Preview: ${result.report.text.substring(0, 100)}...`);
      }
    } else {
      console.log(`\n⚠️  No report generated`);
    }
    
    console.log(`\n💡 Insights: ${hasInsights ? `✓ (${result.insights.length})` : '✗'}`);
    if (hasInsights) {
      result.insights.slice(0, 2).forEach((insight, i) => {
        console.log(`   ${i + 1}. ${insight.substring(0, 80)}...`);
      });
    }
    
    console.log(`\n📋 Recommendations: ${hasRecommendations ? `✓ (${result.recommendations.length})` : '✗'}`);
    if (hasRecommendations) {
      result.recommendations.slice(0, 2).forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec.substring(0, 80)}...`);
      });
    }
    
    console.log(`\n📊 Statistics: ${hasStatistics ? '✓' : '✗'}`);
    if (hasStatistics) {
      console.log(`   Total Contacts: ${result.statistics.totalContacts || 'N/A'}`);
      console.log(`   Response Rate: ${result.statistics.responseRate || 'N/A'}%`);
      console.log(`   Satisfaction Score: ${result.statistics.satisfactionScore || 'N/A'}`);
    }
    
    // Final verdict
    const issues = [];
    if (!basicChecks.success) issues.push('Query failed');
    if (hasError) issues.push('Contains error message');
    if (!hasUsefulContent) issues.push('Lacks useful content');
    if (!hasReport) issues.push('No report generated');
    if (hasReport && !reportQuality.hasMetrics) issues.push('Report lacks metrics');
    if (!hasInsights && template.category === 'knowledge') issues.push('No insights for knowledge query');
    if (!hasRecommendations && template.category === 'knowledge') issues.push('No recommendations for knowledge query');
    
    const passed = issues.length === 0;
    
    console.log(`\n${'─'.repeat(70)}`);
    if (passed) {
      console.log(`✅ TEST PASSED`);
    } else {
      console.log(`❌ TEST FAILED - Issues found:`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    return {
      template: template.key,
      passed,
      issues,
      hasReport,
      reportQuality,
      hasInsights,
      hasRecommendations,
      hasError
    };
    
  } catch (error) {
    console.error(`\n❌ FATAL ERROR: ${error.message}`);
    console.error(error.stack);
    return {
      template: template.key,
      passed: false,
      issues: [`Fatal error: ${error.message}`],
      hasReport: false,
      hasError: true
    };
  }
}

async function runAllTests() {
  console.log('🧪 Testing All Quick-Suggestion Buttons\n');
  console.log(`Found ${QUERY_TEMPLATES.length} templates to test\n`);
  
  const results = [];
  
  for (const template of QUERY_TEMPLATES) {
    const result = await testQuickSuggestion(template);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  console.log(`\n📋 Detailed Results:`);
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`   ${status} ${result.template}: ${result.passed ? 'PASS' : 'FAIL'}`);
    if (!result.passed && result.issues.length > 0) {
      result.issues.forEach(issue => {
        console.log(`      - ${issue}`);
      });
    }
  });
  
  // Report quality summary
  const withReports = results.filter(r => r.hasReport).length;
  const withGoodReports = results.filter(r => r.hasReport && r.reportQuality?.hasMetrics).length;
  
  console.log(`\n📄 Report Quality:`);
  console.log(`   Templates with reports: ${withReports}/${results.length}`);
  console.log(`   Reports with metrics: ${withGoodReports}/${withReports}`);
  
  // Insights/Recommendations summary
  const withInsights = results.filter(r => r.hasInsights).length;
  const withRecommendations = results.filter(r => r.hasRecommendations).length;
  
  console.log(`\n💡 Value-Added Content:`);
  console.log(`   Templates with insights: ${withInsights}/${results.length}`);
  console.log(`   Templates with recommendations: ${withRecommendations}/${results.length}`);
  
  console.log(`\n${'='.repeat(70)}\n`);
  
  return failed === 0;
}

// Run tests
runAllTests()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

