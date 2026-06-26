<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import type { XianyuAccountOverview } from '@shared/types'
import { fetchXianyuAccountOverview } from '@/services/accountAnalytics'
import type { DatePreset } from '@/utils/date'
import { formatMoney } from '@/utils/money'

const ALL_ACCOUNTS = '__all__'

const preset = ref<DatePreset>('all_time')
const customRange = ref<[string, string]>([
  dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
  dayjs().format('YYYY-MM-DD'),
])
const selectedAccountId = ref(ALL_ACCOUNTS)
const loading = ref(false)
const rows = ref<XianyuAccountOverview[]>([])
const rangeLabel = ref('')

const presetOptions: Array<{ label: string; value: DatePreset }> = [
  { label: '全部日期', value: 'all_time' },
  { label: '本周', value: 'this_week' },
  { label: '上周', value: 'last_week' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
  { label: '自定义', value: 'custom' },
]

const rangeHint = computed(() =>
  preset.value === 'all_time'
    ? '利润/售卖金额/投入为历史累计，商品数据为当前快照'
    : '利润/售卖金额/投入按时段统计，商品数据为当前快照',
)

const accountRows = computed(() => rows.value.filter((row) => row.account_id !== null))

const accountOptions = computed(() =>
  accountRows.value.map((row) => ({ id: row.account_id!, name: row.account_name })),
)

function getAccountNetProfit(row: Pick<XianyuAccountOverview, 'total_profit' | 'total_investment' | 'total_purchase_cost'>) {
  return row.total_profit - row.total_investment - row.total_purchase_cost
}

function aggregateRows(data: XianyuAccountOverview[]): XianyuAccountOverview {
  let weightedPriceSum = 0
  let productCountForAvg = 0

  for (const row of data) {
    const count = row.active_count + row.sold_out_count + row.inactive_count
    if (count > 0 && row.avg_sell_price > 0) {
      weightedPriceSum += row.avg_sell_price * count
      productCountForAvg += count
    }
  }

  return {
    account_id: null,
    account_name: '全部',
    total_sales_amount: data.reduce((sum, row) => sum + row.total_sales_amount, 0),
    total_profit: data.reduce((sum, row) => sum + row.total_profit, 0),
    active_count: data.reduce((sum, row) => sum + row.active_count, 0),
    sold_out_count: data.reduce((sum, row) => sum + row.sold_out_count, 0),
    inactive_count: data.reduce((sum, row) => sum + row.inactive_count, 0),
    total_investment: data.reduce((sum, row) => sum + row.total_investment, 0),
    avg_sell_price: productCountForAvg > 0 ? weightedPriceSum / productCountForAvg : 0,
    own_count: data.reduce((sum, row) => sum + row.own_count, 0),
    purchase_count: data.reduce((sum, row) => sum + row.purchase_count, 0),
    total_purchase_cost: data.reduce((sum, row) => sum + row.total_purchase_cost, 0),
  }
}

const aggregatedSummary = computed(() => aggregateRows(accountRows.value))

const displayRows = computed(() => {
  if (selectedAccountId.value === ALL_ACCOUNTS) return accountRows.value
  return rows.value.filter((row) => row.account_id === selectedAccountId.value)
})

const selectedSummary = computed(() => {
  if (selectedAccountId.value === ALL_ACCOUNTS) return aggregatedSummary.value
  return rows.value.find((row) => row.account_id === selectedAccountId.value) ?? null
})

const selectedAccountNetProfit = computed(() =>
  selectedSummary.value ? getAccountNetProfit(selectedSummary.value) : 0,
)

const showTableSummary = computed(() => selectedAccountId.value === ALL_ACCOUNTS && accountRows.value.length > 1)

function getSummaries(param: { columns: unknown[] }) {
  const summary = aggregatedSummary.value
  return param.columns.map((_, index) => {
    switch (index) {
      case 0:
        return '合计'
      case 1:
        return formatMoney(getAccountNetProfit(summary))
      case 2:
        return formatMoney(summary.total_investment)
      case 3:
        return formatMoney(summary.total_purchase_cost)
      case 4:
        return formatMoney(summary.total_sales_amount)
      case 5:
        return formatMoney(summary.total_profit)
      case 6:
        return summary.active_count
      case 7:
        return summary.sold_out_count
      case 8:
        return summary.inactive_count
      case 9:
        return formatMoney(summary.avg_sell_price)
      case 10:
        return summary.own_count
      case 11:
        return summary.purchase_count
      default:
        return ''
    }
  })
}

async function loadData() {
  loading.value = true
  try {
    const result = await fetchXianyuAccountOverview(
      preset.value,
      preset.value === 'custom' ? customRange.value : undefined,
    )
    rows.value = result.rows
    rangeLabel.value = result.rangeLabel

    if (
      selectedAccountId.value !== ALL_ACCOUNTS &&
      !accountOptions.value.some((item) => item.id === selectedAccountId.value)
    ) {
      selectedAccountId.value = ALL_ACCOUNTS
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '账号数据加载失败')
  } finally {
    loading.value = false
  }
}

watch(preset, (value) => {
  if (value !== 'custom') loadData()
})

function handleCustomApply() {
  if (!customRange.value?.[0] || !customRange.value?.[1]) {
    ElMessage.warning('请选择日期范围')
    return
  }
  loadData()
}

onMounted(loadData)
</script>

<template>
  <div v-loading="loading" class="account-panel panel-card">
    <div class="panel-header">
      <div class="panel-header-left">
        <span class="panel-title">闲鱼账号数据分析</span>
        <span class="panel-extra">{{ rangeLabel }} · {{ rangeHint }}</span>
      </div>
      <div class="panel-header-right">
        <el-select
          v-model="selectedAccountId"
          class="account-select"
          size="small"
        >
          <el-option label="全部" :value="ALL_ACCOUNTS" />
          <el-option
            v-for="item in accountOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
        <el-radio-group v-model="preset" size="small" class="preset-group">
          <el-radio-button v-for="item in presetOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
        <el-date-picker
          v-if="preset === 'custom'"
          v-model="customRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          value-format="YYYY-MM-DD"
          size="small"
          class="custom-range"
          @change="handleCustomApply"
        />
      </div>
    </div>

    <div v-if="selectedSummary" class="summary-row">
      <div class="summary-item">
        <div class="summary-label">账号投入</div>
        <div class="summary-value">{{ formatMoney(selectedSummary.total_investment) }}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">总进货价汇总</div>
        <div class="summary-value">{{ formatMoney(selectedSummary.total_purchase_cost) }}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">售卖金额</div>
        <div class="summary-value">{{ formatMoney(selectedSummary.total_sales_amount) }}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">利润</div>
        <div class="summary-value profit">{{ formatMoney(selectedSummary.total_profit) }}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">账号盈利</div>
        <div
          class="summary-value"
          :class="selectedAccountNetProfit >= 0 ? 'profit-positive' : 'profit-negative'"
        >
          {{ formatMoney(selectedAccountNetProfit) }}
        </div>
      </div>
      <div class="summary-item">
        <div class="summary-label">在售 / 售出下架 / 主动下架</div>
        <div class="summary-value">
          {{ selectedSummary.active_count }} / {{ selectedSummary.sold_out_count }} / {{ selectedSummary.inactive_count }}
        </div>
      </div>
      <div class="summary-item">
        <div class="summary-label">售卖均价</div>
        <div class="summary-value">{{ formatMoney(selectedSummary.avg_sell_price) }}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">自有闲置 / 进货</div>
        <div class="summary-value">
          {{ selectedSummary.own_count }} / {{ selectedSummary.purchase_count }}
        </div>
      </div>
    </div>

    <el-table
      :data="displayRows"
      class="account-table account-table--equal"
      empty-text="暂无闲鱼账号数据"
      stripe
      :show-summary="showTableSummary"
      :summary-method="getSummaries"
    >
      <el-table-column label="账号" prop="account_name" align="center" />
      <el-table-column label="账号盈利" align="center">
        <template #default="{ row }">
          <span :class="getAccountNetProfit(row) >= 0 ? 'profit-positive' : 'profit-negative'">
            {{ formatMoney(getAccountNetProfit(row)) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="账号投入" align="center">
        <template #default="{ row }">{{ formatMoney(row.total_investment) }}</template>
      </el-table-column>
      <el-table-column label="总进货价汇总" align="center">
        <template #default="{ row }">{{ formatMoney(row.total_purchase_cost) }}</template>
      </el-table-column>
      <el-table-column label="售卖金额" align="center">
        <template #default="{ row }">{{ formatMoney(row.total_sales_amount) }}</template>
      </el-table-column>
      <el-table-column label="利润" align="center">
        <template #default="{ row }">
          <span :class="row.total_profit >= 0 ? 'profit-positive' : 'profit-negative'">
            {{ formatMoney(row.total_profit) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="在售" prop="active_count" align="center" />
      <el-table-column label="售出下架" prop="sold_out_count" align="center" />
      <el-table-column label="主动下架" prop="inactive_count" align="center" />
      <el-table-column label="售卖均价" align="center">
        <template #default="{ row }">{{ formatMoney(row.avg_sell_price) }}</template>
      </el-table-column>
      <el-table-column label="自有闲置" prop="own_count" align="center" />
      <el-table-column label="进货" prop="purchase_count" align="center" />
    </el-table>
  </div>
</template>

<style scoped>
.account-panel {
  margin-bottom: 16px;
}

.panel-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.06);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f2f5;
  flex-wrap: wrap;
}

.panel-header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.panel-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.account-select {
  width: 140px;
}

.preset-group :deep(.el-radio-button__inner) {
  padding: 8px 14px;
}

.custom-range {
  width: 260px;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 12px;
  padding: 16px 20px 0;
}

.summary-item {
  padding: 12px 14px;
  border-radius: 10px;
  background: #fafafa;
}

.summary-label {
  font-size: 12px;
  color: #909399;
}

.summary-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.summary-value.profit {
  color: #67c23a;
}

.account-table {
  padding: 12px 12px 16px;
}

.account-table--equal :deep(table) {
  table-layout: fixed;
  width: 100%;
}

.account-table--equal :deep(.el-table__cell .cell) {
  padding-left: 4px;
  padding-right: 4px;
}

.account-table :deep(.el-table__footer .cell) {
  font-weight: 700;
  color: #303133;
}

.profit-positive {
  color: #67c23a;
  font-weight: 600;
}

.profit-negative {
  color: #f56c6c;
  font-weight: 600;
}

@media (max-width: 1200px) {
  .summary-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .summary-row {
    grid-template-columns: 1fr;
  }

  .account-select,
  .custom-range,
  .preset-group {
    width: 100%;
  }
}
</style>
