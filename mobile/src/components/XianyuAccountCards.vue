<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { XianyuAccountOverview } from '@shared/types'
import type { DatePreset } from '@/utils/date'
import { fetchXianyuAccountOverview, getAccountNetProfit } from '@/services/accountAnalytics'
import { formatMoney } from '@/utils/money'

const preset = ref<DatePreset>('all_time')
const loading = ref(false)
const rows = ref<XianyuAccountOverview[]>([])
const rangeLabel = ref('')

const presetOptions: Array<{ label: string; value: DatePreset }> = [
  { label: '全部', value: 'all_time' },
  { label: '本周', value: 'this_week' },
  { label: '上周', value: 'last_week' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
]

const accountRows = computed(() => rows.value.filter((row) => row.account_id !== null))

const rangeHint = computed(() =>
  preset.value === 'all_time'
    ? '利润/售卖金额为历史累计，商品数为当前快照'
    : '利润/售卖金额按时段统计，商品数为当前快照',
)

async function loadData() {
  loading.value = true
  try {
    const result = await fetchXianyuAccountOverview(preset.value)
    rows.value = result.rows
    rangeLabel.value = result.rangeLabel
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(preset, loadData)
</script>

<template>
  <div class="panel-card">
    <div class="panel-header">
      <div>
        <div class="panel-title">闲鱼账号数据分析</div>
        <div class="panel-extra">{{ rangeLabel }} · {{ rangeHint }}</div>
      </div>
    </div>

    <div class="preset-tabs">
      <button
        v-for="item in presetOptions"
        :key="item.value"
        type="button"
        class="preset-tab"
        :class="{ active: preset === item.value }"
        @click="preset = item.value"
      >
        {{ item.label }}
      </button>
    </div>

    <van-loading v-if="loading" vertical class="panel-loading">加载中...</van-loading>

    <div v-else class="account-list">
      <div v-for="row in accountRows" :key="row.account_id!" class="account-card">
        <div class="account-card-header">
          <div class="account-name">{{ row.account_name }}</div>
          <div
            class="account-net-profit"
            :class="getAccountNetProfit(row) >= 0 ? 'profit-positive' : 'profit-negative'"
          >
            账号盈利 {{ formatMoney(getAccountNetProfit(row)) }}
          </div>
        </div>

        <div class="account-metrics">
          <div class="metric-item">
            <div class="metric-label">售卖金额</div>
            <div class="metric-value">{{ formatMoney(row.total_sales_amount) }}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">利润</div>
            <div
              class="metric-value"
              :class="row.total_profit >= 0 ? 'profit-positive' : 'profit-negative'"
            >
              {{ formatMoney(row.total_profit) }}
            </div>
          </div>
          <div class="metric-item">
            <div class="metric-label">账号投入</div>
            <div class="metric-value">{{ formatMoney(row.total_investment) }}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">售卖均价</div>
            <div class="metric-value">{{ formatMoney(row.avg_sell_price) }}</div>
          </div>
        </div>

        <div class="account-footer">
          <span>在售 {{ row.active_count }}</span>
          <span>售出 {{ row.sold_out_count }}</span>
          <span>下架 {{ row.inactive_count }}</span>
          <span>自有 {{ row.own_count }} / 进货 {{ row.purchase_count }}</span>
        </div>
      </div>

      <van-empty v-if="accountRows.length === 0" description="暂无闲鱼账号数据" />
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  margin-bottom: 12px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.panel-header {
  padding: 12px 14px;
  border-bottom: 1px solid #f0f2f5;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.panel-extra {
  margin-top: 4px;
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
}

.preset-tabs {
  display: flex;
  gap: 8px;
  padding: 10px 14px 0;
  overflow-x: auto;
}

.preset-tab {
  flex-shrink: 0;
  padding: 6px 12px;
  border: 1px solid #ebeef5;
  border-radius: 16px;
  background: #fff;
  font-size: 12px;
  color: #606266;
  cursor: pointer;
}

.preset-tab.active {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
}

.panel-loading {
  padding: 32px 0;
}

.account-list {
  padding: 12px 14px 14px;
}

.account-card {
  padding: 14px;
  border-radius: 10px;
  background: #fafafa;
}

.account-card + .account-card {
  margin-top: 10px;
}

.account-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.account-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.account-net-profit {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.account-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.metric-item {
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff;
}

.metric-label {
  font-size: 11px;
  color: #909399;
}

.metric-value {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.account-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #ebeef5;
  font-size: 11px;
  color: #909399;
}

.profit-positive {
  color: var(--success);
}

.profit-negative {
  color: var(--danger);
}
</style>
