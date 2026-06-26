<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Box, Coin, Goods, TrendCharts } from '@element-plus/icons-vue'
import SalesAnalysisPanel from '@/components/SalesAnalysisPanel.vue'
import XianyuAccountAnalysisPanel from '@/components/XianyuAccountAnalysisPanel.vue'
import type { DashboardStats } from '@shared/types'
import { SALES_CHANNEL_MAP } from '@shared/types'
import { fetchDashboardStats } from '@/services/dashboard'
import { formatMoney, formatPercent, getSaleProfit } from '@/utils/money'

const loading = ref(false)
const stats = ref<DashboardStats | null>(null)

const statCards = computed(() => [
  {
    key: 'products',
    label: '商品数',
    value: String(stats.value?.productCount ?? 0),
    sub: '在售商品总量',
    icon: Goods,
    color: '#409eff',
    bg: 'rgba(64, 158, 255, 0.1)',
  },
  {
    key: 'stock',
    label: 'SKU / 库存',
    value: `${stats.value?.skuCount ?? 0} / ${stats.value?.totalStock ?? 0}`,
    sub: '规格数 / 库存件数',
    icon: Box,
    color: '#67c23a',
    bg: 'rgba(103, 194, 58, 0.1)',
  },
  {
    key: 'inventory',
    label: '库存货值',
    value: formatMoney(stats.value?.inventoryValue),
    sub: '按进价计算',
    icon: Coin,
    color: '#e6a23c',
    bg: 'rgba(230, 162, 60, 0.12)',
  },
  {
    key: 'profit',
    label: '本月净利润',
    value: formatMoney(stats.value?.monthProfit),
    sub: `销售额 ${formatMoney(stats.value?.monthSales)} · 利润率 ${formatPercent(stats.value?.monthProfitRate)}`,
    icon: TrendCharts,
    color: '#f56c6c',
    bg: 'rgba(245, 108, 108, 0.1)',
  },
])

async function loadData() {
  loading.value = true
  try {
    stats.value = await fetchDashboardStats()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div v-loading="loading" class="dashboard">
    <el-row :gutter="16" class="stat-row">
      <el-col v-for="card in statCards" :key="card.key" :xs="24" :sm="12" :lg="6">
        <div class="stat-card">
          <div class="stat-card-body">
            <div class="stat-info">
              <div class="stat-label">{{ card.label }}</div>
              <div class="stat-value">{{ card.value }}</div>
              <div class="stat-sub">{{ card.sub }}</div>
            </div>
            <div class="stat-icon" :style="{ background: card.bg, color: card.color }">
              <el-icon :size="28"><component :is="card.icon" /></el-icon>
            </div>
          </div>
          <div class="stat-bar" :style="{ background: card.color }" />
        </div>
      </el-col>
    </el-row>

    <SalesAnalysisPanel />

    <XianyuAccountAnalysisPanel />

    <el-row :gutter="16" class="bottom-row">
      <el-col :xs="24" :xl="14">
        <div class="panel-card">
          <div class="panel-header">
            <span class="panel-title">最近销售</span>
            <span class="panel-extra">最新 5 条</span>
          </div>
          <el-table
            :data="(stats?.recentSales ?? []).slice(0, 5)"
            empty-text="暂无销售记录"
            stripe
            class="panel-table compact-table"
          >
            <el-table-column label="下单日期" prop="sold_at" width="116" class-name="date-col" />
            <el-table-column label="商品" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.sku?.product?.name ?? '-' }}
              </template>
            </el-table-column>
            <el-table-column label="渠道" width="72">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">
                  {{ SALES_CHANNEL_MAP[row.channel as keyof typeof SALES_CHANNEL_MAP] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="成交额" width="96">
              <template #default="{ row }">{{ formatMoney(row.sale_amount) }}</template>
            </el-table-column>
            <el-table-column label="利润" width="96">
              <template #default="{ row }">
                <span
                  :class="
                    (row.order_status ?? 'success') === 'refunded'
                      ? 'profit-refunded'
                      : getSaleProfit(row) >= 0
                        ? 'profit-positive'
                        : 'profit-negative'
                  "
                >
                  {{ formatMoney(getSaleProfit(row)) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>

      <el-col :xs="24" :xl="10">
        <div class="panel-card">
          <div class="panel-header">
            <span class="panel-title">低库存预警</span>
            <span class="panel-extra">{{ (stats?.lowStockSkus ?? []).length }} 项需关注</span>
          </div>
          <el-table
            :data="(stats?.lowStockSkus ?? []).slice(0, 5)"
            empty-text="库存充足"
            stripe
            class="panel-table compact-table"
          >
            <el-table-column label="商品" min-width="110" show-overflow-tooltip>
              <template #default="{ row }">{{ row.product?.name }}</template>
            </el-table-column>
            <el-table-column label="规格" min-width="90" show-overflow-tooltip>
              <template #default="{ row }">{{ row.color }} / {{ row.size }}</template>
            </el-table-column>
            <el-table-column label="库存" width="72" align="center">
              <template #default="{ row }">
                <el-tag size="small" type="danger" effect="light">{{ row.stock }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: calc(100vh - 88px);
}

.stat-row {
  margin-bottom: 4px;
}

.bottom-row {
  margin-top: 0;
}

.stat-card {
  position: relative;
  margin-bottom: 16px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 21, 41, 0.1);
}

.stat-card-body {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 20px 16px;
}

.stat-label {
  color: #909399;
  font-size: 13px;
}

.stat-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-sub {
  margin-top: 8px;
  font-size: 12px;
  color: #a8abb2;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  flex-shrink: 0;
}

.stat-bar {
  height: 3px;
  opacity: 0.85;
}

.panel-card {
  margin-bottom: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.06);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #f0f2f5;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.panel-extra {
  font-size: 12px;
  color: #909399;
}

.panel-table {
  padding: 0 8px 8px;
}

.compact-table :deep(.el-table__cell) {
  padding: 10px 0;
}

.compact-table :deep(.date-col .cell) {
  white-space: nowrap;
}

.panel-table :deep(.el-table__header th) {
  background: #fafafa;
  color: #606266;
  font-weight: 600;
}

.profit-positive {
  color: #67c23a;
  font-weight: 600;
}

.profit-negative {
  color: #f56c6c;
  font-weight: 600;
}

.profit-refunded {
  color: #909399;
  font-weight: 600;
}
</style>
