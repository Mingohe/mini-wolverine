/**
 * 订阅功能测试工具
 * 用于验证订阅服务的功能
 */

import { useSubscriptionStore } from '@/stores/subscriptionStore'

export class SubscriptionTest {
  private subscriptionStore = useSubscriptionStore()

  /**
   * 测试基本订阅功能
   */
  async testBasicSubscription() {
    console.log('🧪 Testing basic subscription functionality...')

    try {
      // 初始化订阅服务
      this.subscriptionStore.initialize()

      // 创建测试订阅配置
      const testConfig = {
        markets: ['SHFE'],
        codes: ['rb2501'],
        qualifiedNames: ['global::SampleQuote'],  // Namespace prefix included in qualifiedNames
        options: {
          granularity: 86400
        }
      }

      // 创建订阅
      const subscriptionId = await this.subscriptionStore.subscribe(testConfig)
      console.log(`✅ Subscription created: ${subscriptionId}`)

      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 检查订阅状态
      const subscription = this.subscriptionStore.getSubscription(subscriptionId)
      console.log('📊 Subscription status:', subscription?.status)

      // 取消订阅
      const success = await this.subscriptionStore.unsubscribe(subscriptionId)
      console.log(`⏹️ Unsubscription result: ${success}`)

      return true
    } catch (error) {
      console.error('❌ Subscription test failed:', error)
      return false
    }
  }

  /**
   * 测试公式订阅功能
   */
  async testFormulaSubscription() {
    console.log('🧪 Testing formula subscription functionality...')

    try {
      // 测试公式订阅
      const subscriptionId = await this.subscriptionStore.subscribeToFormula(
        'SHFE',
        'rb2501',
        'builtin-macd',
        'macd: macd(close, 12, 26, 9)...',
        86400,
        'global'
      )

      console.log(`✅ Formula subscription created: ${subscriptionId}`)

      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 取消订阅
      const success = await this.subscriptionStore.unsubscribeFromFormula(subscriptionId)
      console.log(`⏹️ Formula unsubscription result: ${success}`)

      return true
    } catch (error) {
      console.error('❌ Formula subscription test failed:', error)
      return false
    }
  }

  /**
   * 测试订阅统计功能
   */
  testSubscriptionStatistics() {
    console.log('🧪 Testing subscription statistics...')

    try {
      const stats = this.subscriptionStore.getStatistics()
      console.log('📊 Subscription statistics:', stats)

      return true
    } catch (error) {
      console.error('❌ Statistics test failed:', error)
      return false
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 Running all subscription tests...')

    const results = {
      basicSubscription: false,
      formulaSubscription: false,
      statistics: false
    }

    try {
      results.basicSubscription = await this.testBasicSubscription()
      results.formulaSubscription = await this.testFormulaSubscription()
      results.statistics = this.testSubscriptionStatistics()

      const passedTests = Object.values(results).filter(Boolean).length
      const totalTests = Object.keys(results).length

      console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`)
      console.log('Detailed results:', results)

      return results
    } catch (error) {
      console.error('❌ Test suite failed:', error)
      return results
    }
  }
}

// 导出测试实例
export const subscriptionTest = new SubscriptionTest()

// 在开发环境中自动运行测试（可选）
if (import.meta.env.DEV) {
  // 延迟执行，确保应用完全加载
  setTimeout(() => {
    console.log('🔧 Development mode: Subscription tests available')
    console.log('Run subscriptionTest.runAllTests() to test subscription functionality')
  }, 5000)
}
