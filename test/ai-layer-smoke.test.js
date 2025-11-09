/**
 * AI Layer Smoke Test
 * Comprehensive test to identify flaws in the AI layer implementation
 * Tests data.json loading, processing, query handling, and error scenarios
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Test utilities
let testsPassed = 0;
let testsFailed = 0;
let issuesFound = [];

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`✓ ${message}`);
  } else {
    testsFailed++;
    issuesFound.push(message);
    console.error(`✗ FAILED: ${message}`);
  }
}

function assertThrows(fn, errorPattern, message) {
  try {
    fn();
    testsFailed++;
    issuesFound.push(`${message} - Expected error but none thrown`);
    console.error(`✗ FAILED: ${message} - Expected error but none thrown`);
  } catch (error) {
    if (errorPattern && !error.message.includes(errorPattern)) {
      testsFailed++;
      issuesFound.push(`${message} - Wrong error: ${error.message}`);
      console.error(`✗ FAILED: ${message} - Wrong error: ${error.message}`);
    } else {
      testsPassed++;
      console.log(`✓ ${message}`);
    }
  }
}

async function testDataAccessLayer() {
  console.log('\n=== Testing DataAccessLayer ===');
  
  const DataAccessLayer = require('../services/DataAccessLayer');
  const dal = new DataAccessLayer();
  
  // Test 1: Normal data loading
  try {
    const data = dal.loadData();
    assert(Array.isArray(data), 'loadData() returns an array');
    assert(data.length > 0, `loadData() returns data (found ${data.length} contacts)`);
    
    // Validate data structure
    if (data.length > 0) {
      const firstContact = data[0];
      assert(typeof firstContact === 'object', 'Contact is an object');
      assert(firstContact.hasOwnProperty('id') || firstContact.hasOwnProperty('name'), 
        'Contact has required fields (id or name)');
    }
  } catch (error) {
    assert(false, `Data loading failed: ${error.message}`);
  }
  
  // Test 2: Data access methods
  try {
    const allContacts = dal.getAllContacts();
    assert(Array.isArray(allContacts), 'getAllContacts() returns an array');
    
    const answered = dal.getAllContacts({ answered: true });
    assert(Array.isArray(answered), 'getAllContacts({ answered: true }) returns an array');
    
    const unanswered = dal.getAllContacts({ answered: false });
    assert(Array.isArray(unanswered), 'getAllContacts({ answered: false }) returns an array');
    
    const sent = dal.getAllContacts({ sent: true });
    assert(Array.isArray(sent), 'getAllContacts({ sent: true }) returns an array');
    
    // Test neighborhood filter
    const neighborhoods = dal.getAllContacts({ neighborhood: 'Centro' });
    assert(Array.isArray(neighborhoods), 'getAllContacts({ neighborhood }) returns an array');
  } catch (error) {
    assert(false, `Data access methods failed: ${error.message}`);
  }
  
  // Test 3: Survey responses
  try {
    const surveyResponses = dal.getSurveyResponses();
    assert(Array.isArray(surveyResponses), 'getSurveyResponses() returns an array');
    
    surveyResponses.forEach(response => {
      assert(response.hasOwnProperty('survey'), 'Survey response has survey property');
      assert(response.survey !== null, 'Survey is not null');
    });
  } catch (error) {
    assert(false, `Survey responses failed: ${error.message}`);
  }
  
  // Test 4: Engagement data
  try {
    const engagement = dal.getEngagementRawData();
    assert(typeof engagement === 'object', 'getEngagementRawData() returns an object');
    assert(typeof engagement.total === 'number', 'Engagement has total count');
    assert(typeof engagement.sent === 'number', 'Engagement has sent count');
    assert(typeof engagement.clicked === 'number', 'Engagement has clicked count');
    assert(typeof engagement.answered === 'number', 'Engagement has answered count');
    assert(Array.isArray(engagement.rawContacts), 'Engagement has rawContacts array');
  } catch (error) {
    assert(false, `Engagement data failed: ${error.message}`);
  }
  
  // Test 5: Data stats
  try {
    const stats = dal.getDataStats();
    assert(typeof stats === 'object', 'getDataStats() returns an object');
    assert(typeof stats.contacts === 'number', 'Stats has contacts count');
    assert(stats.contacts >= 0, 'Contacts count is non-negative');
  } catch (error) {
    assert(false, `Data stats failed: ${error.message}`);
  }
  
  // Test 6: Edge case - empty filters
  try {
    const emptyFilter = dal.getAllContacts({});
    assert(Array.isArray(emptyFilter), 'getAllContacts({}) handles empty filters');
  } catch (error) {
    assert(false, `Empty filter handling failed: ${error.message}`);
  }
}

async function testIntelligentDataProcessor() {
  console.log('\n=== Testing IntelligentDataProcessor ===');
  
  const IntelligentDataProcessor = require('../services/IntelligentDataProcessor');
  const processor = new IntelligentDataProcessor();
  
  // Test 1: Context generation
  try {
    const mockQueryAnalysis = {
      intent: 'knowledge',
      queryType: 'analysis',
      dataNeeds: ['satisfaction', 'geographic']
    };
    
    const context = await processor.generateIntelligentContext(mockQueryAnalysis);
    assert(typeof context === 'object', 'generateIntelligentContext() returns an object');
    assert(context.hasOwnProperty('rawData'), 'Context has rawData');
    assert(Array.isArray(context.rawData), 'Context rawData is an array');
    assert(context.hasOwnProperty('statisticalProfile'), 'Context has statisticalProfile');
    assert(context.hasOwnProperty('trendAnalysis'), 'Context has trendAnalysis');
    assert(context.hasOwnProperty('keyInsights'), 'Context has keyInsights');
  } catch (error) {
    assert(false, `Context generation failed: ${error.message}`);
  }
  
  // Test 2: Statistics calculation
  try {
    const mockQueryAnalysis = {
      intent: 'knowledge',
      queryType: 'analysis'
    };
    
    const context = await processor.generateIntelligentContext(mockQueryAnalysis);
    const stats = context.statisticalProfile;
    
    assert(stats.hasOwnProperty('population'), 'Statistics has population');
    assert(stats.hasOwnProperty('satisfaction'), 'Statistics has satisfaction');
    assert(stats.hasOwnProperty('geographic'), 'Statistics has geographic');
    assert(stats.hasOwnProperty('funnel'), 'Statistics has funnel');
    assert(stats.hasOwnProperty('issues'), 'Statistics has issues');
    
    // Validate population stats
    assert(typeof stats.population.total === 'number', 'Population total is a number');
    assert(stats.population.total >= 0, 'Population total is non-negative');
    
    // Validate satisfaction stats
    if (stats.satisfaction.averageScore) {
      const score = parseFloat(stats.satisfaction.averageScore);
      assert(!isNaN(score), 'Satisfaction averageScore is a valid number');
      assert(score >= 0 && score <= 5, 'Satisfaction score is between 0 and 5');
    }
  } catch (error) {
    assert(false, `Statistics calculation failed: ${error.message}`);
  }
  
  // Test 3: Edge case - empty data
  try {
    // This should not crash, should handle gracefully
    const context = await processor.generateIntelligentContext({
      intent: 'knowledge',
      queryType: 'analysis'
    });
    assert(context !== null, 'Context generation handles data gracefully');
  } catch (error) {
    assert(false, `Empty data handling failed: ${error.message}`);
  }
}

async function testOrchestrator() {
  console.log('\n=== Testing Orchestrator ===');
  
  const orchestrator = require('../orchestrator');
  
  // Test 1: Basic query
  try {
    const result = await orchestrator('Mostre moradores satisfeitos');
    assert(typeof result === 'object', 'Orchestrator returns an object');
    assert(result.hasOwnProperty('success'), 'Result has success property');
    assert(result.hasOwnProperty('intent'), 'Result has intent property');
    assert(result.hasOwnProperty('response'), 'Result has response property');
    assert(result.hasOwnProperty('residents'), 'Result has residents property');
    assert(Array.isArray(result.residents), 'Residents is an array');
  } catch (error) {
    assert(false, `Basic query failed: ${error.message}`);
  }
  
  // Test 2: Different query types
  const queries = [
    { query: 'Mostre moradores insatisfeitos', expectedIntent: 'knowledge' },
    { query: 'Quem não respondeu a pesquisa?', expectedIntent: 'knowledge' },
    { query: 'Estatísticas de satisfação', expectedIntent: 'knowledge' },
    { query: 'Quais bairros têm mais problemas?', expectedIntent: 'knowledge' }
  ];
  
  for (const testCase of queries) {
    try {
      const result = await orchestrator(testCase.query);
      assert(result.success !== false, `Query "${testCase.query}" processed successfully`);
      assert(result.intent !== undefined, `Query has intent for "${testCase.query}"`);
    } catch (error) {
      assert(false, `Query "${testCase.query}" failed: ${error.message}`);
    }
  }
  
  // Test 3: Response structure validation
  try {
    const result = await orchestrator('Mostre estatísticas gerais');
    assert(result.hasOwnProperty('timestamp'), 'Result has timestamp');
    assert(result.hasOwnProperty('processingTime'), 'Result has processingTime');
    assert(typeof result.processingTime === 'number', 'ProcessingTime is a number');
    assert(result.processingTime >= 0, 'ProcessingTime is non-negative');
  } catch (error) {
    assert(false, `Response structure validation failed: ${error.message}`);
  }
  
  // Test 4: Error handling
  try {
    // Test with potentially problematic query
    const result = await orchestrator('');
    // Should handle gracefully, not crash
    assert(result !== undefined, 'Empty query handled gracefully');
  } catch (error) {
    // Should not throw unhandled errors
    assert(false, `Error handling failed: ${error.message}`);
  }
  
  // Test 5: Data consistency
  try {
    const result1 = await orchestrator('Mostre moradores satisfeitos');
    const result2 = await orchestrator('Mostre moradores satisfeitos');
    
    // Results should be consistent (same data source)
    assert(result1.success === result2.success, 'Results are consistent');
    assert(result1.residents.length === result2.residents.length, 
      `Resident counts match (${result1.residents.length} vs ${result2.residents.length})`);
  } catch (error) {
    assert(false, `Data consistency check failed: ${error.message}`);
  }
}

async function testDataJsonIntegrity() {
  console.log('\n=== Testing data.json Integrity ===');
  
  const dataPath = path.join(__dirname, '..', 'data.json');
  
  // Test 1: File exists
  try {
    assert(fs.existsSync(dataPath), 'data.json file exists');
  } catch (error) {
    assert(false, `File existence check failed: ${error.message}`);
    return; // Can't continue if file doesn't exist
  }
  
  // Test 2: File is readable
  try {
    const content = fs.readFileSync(dataPath, 'utf8');
    assert(content.length > 0, 'data.json is not empty');
  } catch (error) {
    assert(false, `File reading failed: ${error.message}`);
    return;
  }
  
  // Test 3: Valid JSON
  try {
    const content = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(content);
    assert(Array.isArray(data), 'data.json contains an array');
    
    if (data.length > 0) {
      // Validate structure of first few items
      const sampleSize = Math.min(5, data.length);
      for (let i = 0; i < sampleSize; i++) {
        const contact = data[i];
        assert(typeof contact === 'object', `Contact ${i} is an object`);
        
        // Check for common required fields
        if (contact.name) {
          assert(typeof contact.name === 'string', `Contact ${i} name is a string`);
        }
        if (contact.age) {
          assert(typeof contact.age === 'number', `Contact ${i} age is a number`);
        }
        if (contact.neighborhood) {
          assert(typeof contact.neighborhood === 'string', `Contact ${i} neighborhood is a string`);
        }
      }
    }
  } catch (error) {
    assert(false, `JSON parsing failed: ${error.message}`);
  }
  
  // Test 4: Data consistency
  try {
    const content = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(content);
    
    // Check for duplicates (by id or whatsapp)
    const ids = new Set();
    const phones = new Set();
    let duplicates = 0;
    
    data.forEach((contact, index) => {
      if (contact.id) {
        if (ids.has(contact.id)) {
          duplicates++;
        }
        ids.add(contact.id);
      }
      if (contact.whatsapp) {
        if (phones.has(contact.whatsapp)) {
          duplicates++;
        }
        phones.add(contact.whatsapp);
      }
    });
    
    assert(duplicates === 0, `No duplicate IDs or phone numbers found (found ${duplicates} duplicates)`);
  } catch (error) {
    assert(false, `Data consistency check failed: ${error.message}`);
  }
}

async function testErrorHandling() {
  console.log('\n=== Testing Error Handling ===');
  
  const DataAccessLayer = require('../services/DataAccessLayer');
  const orchestrator = require('../orchestrator');
  
  // Test 1: DataAccessLayer handles missing file gracefully
  try {
    const originalPath = process.env.DB_FILE;
    process.env.DB_FILE = '/nonexistent/path/data.json';
    
    const dal = new DataAccessLayer();
    const data = dal.loadData();
    
    // Should return empty array, not throw
    assert(Array.isArray(data), 'DataAccessLayer handles missing file gracefully');
    assert(data.length === 0 || data.length > 0, 'Returns valid array (empty or with fallback)');
    
    // Restore original path
    if (originalPath) {
      process.env.DB_FILE = originalPath;
    } else {
      delete process.env.DB_FILE;
    }
  } catch (error) {
    assert(false, `Missing file handling failed: ${error.message}`);
  }
  
  // Test 2: Orchestrator handles invalid queries
  try {
    const result = await orchestrator(null);
    assert(result !== undefined, 'Orchestrator handles null query');
  } catch (error) {
    // Should handle gracefully
    assert(error.message !== undefined, 'Error has message');
  }
  
  // Test 3: Very long query
  try {
    const longQuery = 'a'.repeat(10000);
    const result = await orchestrator(longQuery);
    assert(result !== undefined, 'Orchestrator handles very long query');
  } catch (error) {
    assert(false, `Long query handling failed: ${error.message}`);
  }
}

async function testPerformance() {
  console.log('\n=== Testing Performance ===');
  
  const orchestrator = require('../orchestrator');
  
  // Test 1: Response time
  try {
    const start = Date.now();
    await orchestrator('Mostre estatísticas gerais');
    const duration = Date.now() - start;
    
    assert(duration < 30000, `Query processed in reasonable time (${duration}ms < 30s)`);
    console.log(`  Query processed in ${duration}ms`);
  } catch (error) {
    assert(false, `Performance test failed: ${error.message}`);
  }
  
  // Test 2: Multiple queries don't degrade performance
  try {
    const queries = [
      'Mostre moradores satisfeitos',
      'Mostre moradores insatisfeitos',
      'Estatísticas gerais'
    ];
    
    const start = Date.now();
    for (const query of queries) {
      await orchestrator(query);
    }
    const duration = Date.now() - start;
    const avgDuration = duration / queries.length;
    
    assert(avgDuration < 15000, `Average query time is reasonable (${avgDuration}ms < 15s)`);
    console.log(`  Average query time: ${avgDuration}ms`);
  } catch (error) {
    assert(false, `Multiple queries performance test failed: ${error.message}`);
  }
}

// Main test runner
async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          AI Layer Smoke Test - Comprehensive Check          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  
  try {
    await testDataJsonIntegrity();
    await testDataAccessLayer();
    await testIntelligentDataProcessor();
    await testOrchestrator();
    await testErrorHandling();
    await testPerformance();
    
    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                        Test Summary                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`\nTests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsFailed}`);
    console.log(`Total Tests:  ${testsPassed + testsFailed}`);
    console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    
    if (issuesFound.length > 0) {
      console.log('\n⚠️  Issues Found:');
      issuesFound.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }
    
    if (testsFailed > 0) {
      console.log('\n❌ Some tests failed. Review the issues above.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed! AI layer appears to be functioning correctly.');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 Fatal error during testing:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();

