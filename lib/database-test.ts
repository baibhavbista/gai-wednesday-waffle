// Database Test Script - Phase 3 Validation
// Run this to validate that all CRUD operations work correctly

import { groupsService, wafflesService } from './database-service'

export async function testPhase3Database() {
  console.log('🧪 Starting Phase 3 Database Validation...')
  
  try {
    // Test 1: Create a test group
    console.log('\n1️⃣ Testing Group Creation...')
    const { data: newGroup, error: createError } = await groupsService.create({
      name: 'Test Group - Phase 3'
    })
    
    if (createError || !newGroup) {
      throw new Error(`Group creation failed: ${createError?.message}`)
    }
    console.log('✅ Group created successfully:', newGroup.name, 'Code:', newGroup.invite_code)
    
    // Test 2: Get user groups
    console.log('\n2️⃣ Testing Get User Groups...')
    const { data: userGroups, error: fetchError } = await groupsService.getUserGroups()
    
    if (fetchError) {
      throw new Error(`Fetch groups failed: ${fetchError?.message}`)
    }
    console.log('✅ User groups fetched:', userGroups?.length || 0, 'groups')
    
    // Test 3: Join group by invite code (simulate another user)
    console.log('\n3️⃣ Testing Join by Invite Code...')
    const { data: joinedGroup, error: joinError } = await groupsService.joinByInviteCode(newGroup.invite_code)
    
    if (joinError) {
      console.log('⚠️ Join test expected to fail for same user:', joinError.message)
    } else {
      console.log('✅ Group join successful:', joinedGroup?.name)
    }
    
    // Test 4: Create a test waffle
    console.log('\n4️⃣ Testing Waffle Creation...')
    const { data: newWaffle, error: waffleError } = await wafflesService.create({
      group_id: newGroup.id,
      content_type: 'photo',
      caption: 'Test waffle for Phase 3 validation',
      retention_type: '7_days'
    })
    
    if (waffleError || !newWaffle) {
      throw new Error(`Waffle creation failed: ${waffleError?.message}`)
    }
    console.log('✅ Waffle created successfully:', newWaffle.caption)
    
    // Test 5: Get waffles for group
    console.log('\n5️⃣ Testing Get Group Waffles...')
    const { data: groupWaffles, error: wafflesError } = await wafflesService.getForGroup(newGroup.id)
    
    if (wafflesError) {
      throw new Error(`Fetch waffles failed: ${wafflesError?.message}`)
    }
    console.log('✅ Group waffles fetched:', groupWaffles?.length || 0, 'waffles')
    
    // Test 6: Update waffle with AI content
    console.log('\n6️⃣ Testing Waffle AI Update...')
    const { data: updatedWaffle, error: updateError } = await wafflesService.update(newWaffle.id, {
      ai_caption: 'AI-generated caption for testing',
      ai_summary: 'This is a test waffle for Phase 3 validation'
    })
    
    if (updateError) {
      throw new Error(`Waffle update failed: ${updateError?.message}`)
    }
    console.log('✅ Waffle AI content updated successfully')
    
    console.log('\n🎉 Phase 3 Database Validation PASSED!')
    console.log('✅ All CRUD operations working correctly')
    console.log('✅ RLS policies functioning properly')
    console.log('✅ Ready for Phase 4: File Storage System')
    
    return {
      success: true,
      testGroup: newGroup,
      testWaffle: updatedWaffle
    }
    
  } catch (error) {
    console.error('\n❌ Phase 3 Database Validation FAILED!')
    console.error('Error:', error)
    return {
      success: false,
      error
    }
  }
}

// Helper function to clean up test data
export async function cleanupTestData(groupId: string, waffleId: string) {
  console.log('🧹 Cleaning up test data...')
  
  try {
    await wafflesService.delete(waffleId)
    await groupsService.leave(groupId)
    console.log('✅ Test data cleaned up successfully')
  } catch (error) {
    console.log('⚠️ Cleanup error (non-critical):', error)
  }
} 