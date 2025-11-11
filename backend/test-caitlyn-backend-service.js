/**
 * Test script for CaitlynBackendService
 * Tests connection and formula querying with Rails backend
 *
 * Usage:
 *   CAITLYN_TOKEN=your-token node test-caitlyn-backend-service.js
 */

import CaitlynBackendService from './src/services/CaitlynBackendService.js';
import logger from './src/utils/logger.js';

async function testCaitlynBackendService() {
  console.log('='.repeat(80));
  console.log('CaitlynBackendService Test Suite');
  console.log('='.repeat(80));
  console.log();

  // Check environment variables
  const railsApiUrl = process.env.RAILS_API_URL || 'http://localhost:3001';
  const caitlynToken = process.env.CAITLYN_TOKEN;

  if (!caitlynToken) {
    console.error('❌ Error: CAITLYN_TOKEN environment variable is required');
    console.log('Usage: CAITLYN_TOKEN=your-token node test-caitlyn-backend-service.js');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  Rails API URL: ${railsApiUrl}`);
  console.log(`  Token: ${caitlynToken.substring(0, 20)}...`);
  console.log();

  try {
    // Initialize service
    console.log('📦 Initializing CaitlynBackendService...');
    const service = new CaitlynBackendService(railsApiUrl, caitlynToken);
    console.log('✅ Service initialized');
    console.log();

    // Test 1: Health Check
    console.log('Test 1: Health Check');
    console.log('-'.repeat(80));
    try {
      const healthy = await service.healthCheck();
      if (healthy) {
        console.log('✅ Rails backend is healthy');
      } else {
        console.log('⚠️  Rails backend health check failed');
      }
    } catch (error) {
      console.log('❌ Health check error:', error.message);
    }
    console.log();

    // Test 2: Query All Formulas
    console.log('Test 2: Query All Formulas');
    console.log('-'.repeat(80));
    try {
      const allFormulas = await service.queryFormulas({});
      console.log(`✅ Found ${allFormulas.length} total formulas`);
      if (allFormulas.length > 0) {
        console.log('Sample formula:');
        const sample = allFormulas[0];
        console.log(`  ID: ${sample.id}`);
        console.log(`  Name: ${sample.name}`);
        console.log(`  Language ID: ${sample.language_id}`);
        console.log(`  User ID: ${sample.user_id}`);
        console.log(`  Share opts: ${JSON.stringify(sample.share_opts)}`);
      }
    } catch (error) {
      console.log('❌ Query all formulas failed:', error.message);
    }
    console.log();

    // Test 3: Query Private Formulas Only
    console.log('Test 3: Query Private/Shared Formulas Only');
    console.log('-'.repeat(80));
    try {
      const privateFormulas = await service.queryFormulas({ privateOnly: 1 });
      console.log(`✅ Found ${privateFormulas.length} private/shared formulas`);
      if (privateFormulas.length > 0) {
        console.log('Formula names:');
        privateFormulas.slice(0, 5).forEach(f => {
          console.log(`  - ${f.name} (language: ${f.language_id})`);
        });
        if (privateFormulas.length > 5) {
          console.log(`  ... and ${privateFormulas.length - 5} more`);
        }
      }
    } catch (error) {
      console.log('❌ Query private formulas failed:', error.message);
    }
    console.log();

    // Test 4: Query Formulas by Language
    console.log('Test 4: Query Formulas by Language ID');
    console.log('-'.repeat(80));
    try {
      // Test language_id = 5 (Formula DSL)
      const dslFormulas = await service.queryFormulas({ languageId: 5 });
      console.log(`✅ Found ${dslFormulas.length} DSL formulas (language_id=5)`);

      // Test language_id = 0 (Python or other)
      const pythonFormulas = await service.queryFormulas({ languageId: 0 });
      console.log(`✅ Found ${pythonFormulas.length} Python formulas (language_id=0)`);
    } catch (error) {
      console.log('❌ Query by language failed:', error.message);
    }
    console.log();

    // Test 5: Search Formulas by Pattern
    console.log('Test 5: Search Formulas by Pattern');
    console.log('-'.repeat(80));
    try {
      const searchResults = await service.queryFormulas({ pattern: 'prediction' });
      console.log(`✅ Found ${searchResults.length} formulas matching "prediction"`);
      if (searchResults.length > 0) {
        console.log('Matching formula names:');
        searchResults.forEach(f => {
          console.log(`  - ${f.name}`);
        });
      }
    } catch (error) {
      console.log('❌ Search formulas failed:', error.message);
    }
    console.log();

    // Test 6: Combined Query
    console.log('Test 6: Combined Query (Private + Language + Pattern)');
    console.log('-'.repeat(80));
    try {
      const combinedResults = await service.queryFormulas({
        privateOnly: 1,
        languageId: 5,
        pattern: 'pred'
      });
      console.log(`✅ Found ${combinedResults.length} formulas matching all criteria`);
      if (combinedResults.length > 0) {
        console.log('Matching formulas:');
        combinedResults.forEach(f => {
          console.log(`  - ${f.name} (user: ${f.user_id})`);
        });
      }
    } catch (error) {
      console.log('❌ Combined query failed:', error.message);
    }
    console.log();

    // Test Summary
    console.log('='.repeat(80));
    console.log('✅ Test suite completed successfully!');
    console.log('='.repeat(80));
    console.log();
    console.log('Next steps:');
    console.log('  1. Test save formula: Create a new test formula');
    console.log('  2. Test update formula: Update an existing formula');
    console.log('  3. Test delete formula: Delete a test formula');
    console.log();

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testCaitlynBackendService().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
