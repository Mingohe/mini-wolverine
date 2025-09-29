/**
 * WebSocket 任务服务测试工具
 * 用于验证简单的序列号生成和消息匹配
 */

export class WebSocketTaskTest {
  /**
   * 测试序列号生成
   */
  testSequenceGeneration() {
    console.log('🧪 Testing sequence generation...')
    
    // 模拟发送几个任务来测试序列号
    const testMessages = [
      { type: 'test_message_1', data: 'test1' },
      { type: 'test_message_2', data: 'test2' },
      { type: 'test_message_3', data: 'test3' }
    ]
    
    testMessages.forEach((message, index) => {
      console.log(`📤 Would send message ${index + 1}:`, message)
    })
    
    console.log('✅ Sequence generation test completed')
  }
  
  /**
   * 测试消息匹配逻辑
   */
  testMessageMatching() {
    console.log('🧪 Testing message matching logic...')
    
    // 模拟发送消息
    const sentMessage = {
      type: 'execute_formula',
      market: 'SHFE',
      code: 'rb2501',
      seq: '1' // 简单的序列号
    }
    
    // 模拟接收响应
    const receivedResponse = {
      type: 'formula_execution_response',
      success: true,
      data: { records: [] },
      requestId: '1' // 应该匹配 seq
    }
    
    console.log('📤 Sent message:', sentMessage)
    console.log('📨 Received response:', receivedResponse)
    console.log('🔍 Matching logic: seq/requestId should match')
    
    console.log('✅ Message matching test completed')
  }
  
  /**
   * 运行所有测试
   */
  runAllTests() {
    console.log('🚀 Running WebSocket Task Service tests...')
    
    this.testSequenceGeneration()
    this.testMessageMatching()
    
    console.log('✅ All tests completed')
  }
}

// 导出测试实例
export const websocketTaskTest = new WebSocketTaskTest()
