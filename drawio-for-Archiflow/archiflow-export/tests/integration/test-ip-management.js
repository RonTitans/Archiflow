#!/usr/bin/env node
/**
 * Test script for IP Management tools
 * Tests allocate-ip, release-ip, and get-ip-usage MCP tools
 */

import { 
  createAllocateIpTool, 
  createReleaseIpTool, 
  createGetIpUsageTool,
  createGetIpPoolsTool 
} from './build/tools/network-device-tools.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock context
const context = {
  bus: null,
  id_generator: null,
  logger: console
};

// Mock extra parameter for tools
const extra = {};

// Backup and restore functions for IP pools
async function backupIpPools() {
  const ipPoolsFile = path.join(__dirname, 'src', 'archiflow', 'mock-data', 'ip-pools.json');
  const backupFile = path.join(__dirname, 'src', 'archiflow', 'mock-data', 'ip-pools.backup.json');
  const data = await fs.readFile(ipPoolsFile, 'utf-8');
  await fs.writeFile(backupFile, data, 'utf-8');
  console.log('✅ IP pools backed up');
}

async function restoreIpPools() {
  const ipPoolsFile = path.join(__dirname, 'src', 'archiflow', 'mock-data', 'ip-pools.json');
  const backupFile = path.join(__dirname, 'src', 'archiflow', 'mock-data', 'ip-pools.backup.json');
  const data = await fs.readFile(backupFile, 'utf-8');
  await fs.writeFile(ipPoolsFile, data, 'utf-8');
  await fs.unlink(backupFile);
  console.log('✅ IP pools restored');
}

// Test helper functions
function parseResponse(result) {
  const text = result.content[0].text;
  return JSON.parse(text);
}

function printTestResult(testName, success, details = '') {
  if (success) {
    console.log(`✅ ${testName}`);
    if (details) console.log(`   ${details}`);
  } else {
    console.log(`❌ ${testName}`);
    if (details) console.log(`   Error: ${details}`);
  }
}

// Test Suite
async function runTests() {
  console.log('\n🧪 IP Management Tools Test Suite\n');
  console.log('=' .repeat(50));
  
  let backupCreated = false;
  
  try {
    // Backup IP pools before testing
    await backupIpPools();
    backupCreated = true;
    
    // Initialize tools
    const allocateIpTool = createAllocateIpTool(context);
    const releaseIpTool = createReleaseIpTool(context);
    const getIpUsageTool = createGetIpUsageTool(context);
    const getIpPoolsTool = createGetIpPoolsTool(context);
    
    // Test 1: Get IP Pools
    console.log('\n📋 Test 1: Get IP Pools');
    console.log('-'.repeat(30));
    
    let result = await getIpPoolsTool({ includeAllocations: true }, extra);
    let response = parseResponse(result);
    printTestResult('Get all IP pools', response.success, `Found ${response.pools?.length || 0} pools`);
    
    result = await getIpPoolsTool({ vlan: 10 }, extra);
    response = parseResponse(result);
    printTestResult('Filter pools by VLAN', response.success && response.pools.length === 1, 
      `Found ${response.pools.length} pool(s) for VLAN 10`);
    
    // Test 2: Allocate IP
    console.log('\n📋 Test 2: IP Allocation');
    console.log('-'.repeat(30));
    
    result = await allocateIpTool({
      poolId: 'POOL-001',
      assetId: 'TEST-ASSET-001',
      description: 'Test Router'
    }, extra);
    response = parseResponse(result);
    const allocatedIp = response.allocation?.ip;
    printTestResult('Allocate IP to new asset', response.success, 
      `Allocated IP: ${allocatedIp} from ${response.allocation?.pool}`);
    
    // Test 3: IP Conflict Detection
    console.log('\n📋 Test 3: IP Conflict Detection');
    console.log('-'.repeat(30));
    
    result = await allocateIpTool({
      poolId: 'POOL-001',
      assetId: 'TEST-ASSET-001',
      description: 'Duplicate allocation attempt'
    }, extra);
    response = parseResponse(result);
    printTestResult('Detect IP conflict for same asset', 
      !response.success && response.conflict, 
      response.error || 'Conflict detected as expected');
    
    // Test 4: Allocate IP to different asset
    result = await allocateIpTool({
      poolId: 'POOL-001',
      assetId: 'TEST-ASSET-002',
      description: 'Test Switch'
    }, extra);
    response = parseResponse(result);
    const secondAllocatedIp = response.allocation?.ip;
    printTestResult('Allocate IP to different asset', response.success, 
      `Allocated IP: ${secondAllocatedIp}`);
    
    // Test 5: Get IP Usage Report
    console.log('\n📋 Test 5: IP Usage Reporting');
    console.log('-'.repeat(30));
    
    result = await getIpUsageTool({}, extra);
    response = parseResponse(result);
    printTestResult('Get overall IP usage report', response.success, 
      `Total allocated: ${response.report.summary.totalAllocated}, ` +
      `Available: ${response.report.summary.totalAvailable}, ` +
      `Utilization: ${response.report.summary.overallUtilization}%`);
    
    result = await getIpUsageTool({ poolId: 'POOL-001' }, extra);
    response = parseResponse(result);
    printTestResult('Get usage report for specific pool', 
      response.success && response.report.pools.length === 1,
      `Pool utilization: ${response.report.pools[0]?.statistics.utilizationPercent}%`);
    
    result = await getIpUsageTool({ assetId: 'TEST-ASSET-001' }, extra);
    response = parseResponse(result);
    printTestResult('Filter usage report by asset', response.success,
      `Found allocations for TEST-ASSET-001`);
    
    result = await getIpUsageTool({ includeAvailable: true, poolId: 'POOL-001' }, extra);
    response = parseResponse(result);
    printTestResult('Get report with available IPs', 
      response.success && response.report.pools[0]?.availableIps,
      `Available IPs listed: ${response.report.pools[0]?.availableIps?.length || 0}`);
    
    // Test 6: Release IP
    console.log('\n📋 Test 6: IP Release');
    console.log('-'.repeat(30));
    
    result = await releaseIpTool({ ip: allocatedIp }, extra);
    response = parseResponse(result);
    printTestResult('Release allocated IP without pool ID', response.success, 
      `Released ${allocatedIp} back to ${response.release?.pool}`);
    
    result = await releaseIpTool({ 
      ip: secondAllocatedIp, 
      poolId: 'POOL-001' 
    }, extra);
    response = parseResponse(result);
    printTestResult('Release IP with pool ID', response.success, 
      `Released ${secondAllocatedIp}`);
    
    // Test 7: Try to release reserved IP
    console.log('\n📋 Test 7: Reserved IP Protection');
    console.log('-'.repeat(30));
    
    result = await releaseIpTool({ ip: '10.0.1.1' }, extra);
    response = parseResponse(result);
    printTestResult('Prevent release of reserved IP', 
      !response.success && response.error.includes('reserved'),
      'Reserved IPs cannot be released');
    
    // Test 8: Try to release non-existent IP
    result = await releaseIpTool({ ip: '192.168.99.99' }, extra);
    response = parseResponse(result);
    printTestResult('Handle non-existent IP release', 
      !response.success,
      'Non-existent IP cannot be released');
    
    // Test 9: Verify IPs are back in available pool
    console.log('\n📋 Test 9: Verify Pool State');
    console.log('-'.repeat(30));
    
    result = await getIpPoolsTool({ includeAllocations: false }, extra);
    response = parseResponse(result);
    const pool = response.pools.find(p => p.id === 'POOL-001');
    const hasReleasedIps = pool?.available.includes(allocatedIp) && 
                           pool?.available.includes(secondAllocatedIp);
    printTestResult('Released IPs back in available pool', hasReleasedIps,
      `Available IPs in POOL-001: ${pool?.available.length}`);
    
    // Test 10: Edge cases
    console.log('\n📋 Test 10: Edge Cases');
    console.log('-'.repeat(30));
    
    // Try to allocate from non-existent pool
    result = await allocateIpTool({
      poolId: 'INVALID-POOL',
      assetId: 'TEST-ASSET-003'
    }, extra);
    response = parseResponse(result);
    printTestResult('Handle allocation from invalid pool', 
      !response.success,
      'Invalid pool handled correctly');
    
    // Test Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Test Suite Complete!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n💥 Test suite failed with error:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Restore original IP pools only if backup was created
    if (backupCreated) {
      try {
        await restoreIpPools();
      } catch (restoreError) {
        console.error('⚠️ Failed to restore IP pools:', restoreError.message);
      }
    }
  }
}

// Run the tests
console.log('🚀 Starting IP Management Tools Tests...');
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});