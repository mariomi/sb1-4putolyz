// Test file for access logging functionality
// This file can be run to test the access logging system

import { logUserLogin, logUserLogout, getUserAccessLogs, getAccessStatistics } from './src/lib/accessLogger'

async function testAccessLogging() {
  console.log('🧪 Testing Access Logging System...')
  
  try {
    // Test 1: Log a user login
    console.log('\n📝 Test 1: Logging user login...')
    await logUserLogin({
      user_id: 'test-user-123',
      profile_id: 'test-profile-123',
      user_agent: 'Test Browser/1.0',
      session_id: 'test-session-123'
    })
    console.log('✅ Login logged successfully')
    
    // Test 2: Log a user logout
    console.log('\n📝 Test 2: Logging user logout...')
    await logUserLogout('test-user-123', 'test-session-123')
    console.log('✅ Logout logged successfully')
    
    // Test 3: Fetch access logs
    console.log('\n📝 Test 3: Fetching access logs...')
    const logs = await getUserAccessLogs()
    console.log(`✅ Retrieved ${logs.length} access logs`)
    
    // Test 4: Get access statistics
    console.log('\n📝 Test 4: Getting access statistics...')
    const stats = await getAccessStatistics()
    console.log('✅ Access statistics:', stats)
    
    console.log('\n🎉 All tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  testAccessLogging()
} else {
  // Browser environment
  console.log('🧪 Access Logging Test Ready')
  console.log('Run testAccessLogging() in the browser console to test')
}




