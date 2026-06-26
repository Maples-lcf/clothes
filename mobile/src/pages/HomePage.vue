<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { useAuthStore } from '@/stores/auth'
import SalesAnalysisCard from '@/components/SalesAnalysisCard.vue'
import XianyuAccountCards from '@/components/XianyuAccountCards.vue'
import { fetchHomeDashboardStats, type HomeDashboardStats } from '@/services/dashboard'
import { formatMoney, formatPercent } from '@/utils/money'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const stats = ref<HomeDashboardStats | null>(null)

const actions = [
  {
    key: 'new',
    title: '上新',
    desc: '闲鱼发布后，拍照录入商品',
    icon: 'photograph',
    color: '#409eff',
    path: '/new',
  },
  {
    key: 'sold',
    title: '售出下架',
    desc: '卖出后记账，自动下架',
    icon: 'passed',
    color: '#67c23a',
    path: '/sold',
  },
  {
    key: 'delist',
    title: '主动下架',
    desc: '暂时不卖，保留库存',
    icon: 'pause-circle-o',
    color: '#e6a23c',
    path: '/delist',
  },
  {
    key: 'active',
    title: '在售列表',
    desc: '查看在售商品，快捷操作',
    icon: 'orders-o',
    color: '#606266',
    path: '/active',
  },
]

const statCards = computed(() => [
  {
    key: 'products',
    label: '商品数',
    value: String(stats.value?.productCount ?? 0),
    sub: '在售商品总量',
    icon: 'shop-o',
    color: '#409eff',
  },
  {
    key: 'stock',
    label: 'SKU / 库存',
    value: `${stats.value?.skuCount ?? 0} / ${stats.value?.totalStock ?? 0}`,
    sub: '规格数 / 库存件数',
    icon: 'balance-list-o',
    color: '#67c23a',
  },
  {
    key: 'profit',
    label: '本月利润',
    value: formatMoney(stats.value?.monthProfit),
    sub: `已售 ${stats.value?.monthQuantity ?? 0} 件 · 销售额 ${formatMoney(stats.value?.monthSales)} · 利润率 ${formatPercent(stats.value?.monthProfitRate)}`,
    icon: 'gold-coin-o',
    color: '#f56c6c',
  },
])

onMounted(loadData)

async function loadData() {
  loading.value = true
  try {
    stats.value = await fetchHomeDashboardStats()
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

async function handleLogout() {
  try {
    await showConfirmDialog({ title: '确认退出登录？' })
    await auth.signOut()
    router.replace('/login')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="page home-page">
    <div class="home-header">
      <div class="home-title">
        <span class="home-logo">衣</span>
        <div>
          <h1>随手记</h1>
          <p>闲鱼操作后，来这里同步</p>
        </div>
      </div>
      <van-icon name="setting-o" size="22" color="#909399" @click="handleLogout" />
    </div>

    <div class="page-body">
      <div class="dashboard-section">
        <van-loading v-if="loading" vertical class="page-loading">加载中...</van-loading>

        <template v-else>
          <div class="overview-card">
            <div class="overview-header">数据概览</div>
            <div class="overview-body">
              <div
                v-for="card in statCards"
                :key="card.key"
                class="overview-item"
                :class="{ 'overview-item-wide': card.key === 'profit' }"
              >
                <div class="overview-item-top">
                  <van-icon :name="card.icon" size="18" :color="card.color" class="overview-icon" />
                  <div class="overview-label">{{ card.label }}</div>
                </div>
                <div class="overview-value">{{ card.value }}</div>
                <div class="overview-sub">{{ card.sub }}</div>
              </div>
            </div>
          </div>

          <SalesAnalysisCard />
          <XianyuAccountCards />
        </template>
      </div>

      <div class="action-list">
        <button
          v-for="item in actions"
          :key="item.key"
          type="button"
          class="action-card"
          @click="router.push(item.path)"
        >
          <span class="action-icon" :style="{ background: `${item.color}14` }">
            <van-icon :name="item.icon" size="22" :color="item.color" />
          </span>
          <span class="action-text">
            <span class="action-title">{{ item.title }}</span>
            <span class="action-desc">{{ item.desc }}</span>
          </span>
          <van-icon name="arrow" color="#c0c4cc" />
        </button>
      </div>

      <div class="tip-card">
        <div class="tip-title">使用提示</div>
        <ul>
          <li>闲鱼<strong>发布/重新上架</strong> → 点「上新」</li>
          <li>闲鱼<strong>卖出</strong> → 点「售出下架」填成交价</li>
          <li>闲鱼<strong>暂时下架</strong> → 点「主动下架」</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  background: linear-gradient(180deg, #409eff 0%, #409eff 120px, #f5f7fa 120px);
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 16px 12px;
  color: #fff;
}

.home-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.home-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 20px;
  font-weight: 700;
}

.home-title h1 {
  margin: 0;
  font-size: 20px;
}

.home-title p {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.85;
}

.dashboard-section {
  margin-bottom: 16px;
}

.overview-card {
  margin-bottom: 12px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.overview-header {
  padding: 12px 14px;
  border-bottom: 1px solid #f0f2f5;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.overview-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 4px 0 8px;
}

.overview-item {
  padding: 12px 14px;
}

.overview-item-wide {
  grid-column: 1 / -1;
  border-top: 1px solid #f5f7fa;
}

.overview-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.overview-icon {
  flex-shrink: 0;
}

.overview-label {
  font-size: 12px;
  color: #909399;
}

.overview-value {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.overview-sub {
  margin-top: 6px;
  font-size: 11px;
  color: #a8abb2;
  line-height: 1.4;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 18px 16px;
  border: none;
  border-radius: 14px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  font-size: 22px;
  flex-shrink: 0;
}

.action-text {
  flex: 1;
  min-width: 0;
}

.action-title {
  display: block;
  font-size: 17px;
  font-weight: 600;
  color: #303133;
}

.action-desc {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: #909399;
}

.tip-card {
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
}

.tip-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: #303133;
}

.tip-card ul {
  margin: 0;
  padding-left: 18px;
}
</style>
