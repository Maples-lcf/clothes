<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import PageContainer from '@/components/PageContainer.vue'
import type { AccountPerformance } from '@shared/types'
import { fetchAccountAnalytics } from '@/services/accountAnalytics'
import type { DatePreset } from '@/utils/date'
import { formatMoney, formatPercent } from '@/utils/money'

const preset = ref<DatePreset>('this_month')
const customRange = ref<[string, string]>([
  dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
  dayjs().format('YYYY-MM-DD'),
])
const loading = ref(false)
const rows = ref<AccountPerformance[]>([])
const rangeLabel = ref('')
const chartRef = ref<HTMLDivElement | null>(null)

let chart: ECharts | null = null

const presetOptions: Array<{ label: string; value: DatePreset }> = [
  { label: '本周', value: 'this_week' },
  { label: '上周', value: 'last_week' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
  { label: '自定义', value: 'custom' },
]

const bestAccount = computed(() => rows.value.find((row) => row.tags.includes('利润冠军')))
const weakAccounts = computed(() =>
  rows.value.filter((row) => row.tags.includes('出单偏少') || row.tags.includes('利润偏低')),
)

function renderChart() {
  if (!chartRef.value) return
  if (!chart) chart = echarts.init(chartRef.value)

  const activeRows = rows.value.filter((row) => row.order_count > 0)
  chart.setOption({
    color: ['#409eff', '#67c23a'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['成交额', '利润'], bottom: 0 },
    grid: { left: 48, right: 24, top: 24, bottom: 48 },
    xAxis: {
      type: 'category',
      data: activeRows.map((row) => row.account_name),
      axisLabel: { interval: 0, rotate: activeRows.length > 4 ? 20 : 0 },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '成交额',
        type: 'bar',
        barMaxWidth: 28,
        data: activeRows.map((row) => row.total_amount),
      },
      {
        name: '利润',
        type: 'bar',
        barMaxWidth: 28,
        data: activeRows.map((row) => row.total_profit),
      },
    ],
  })
}

async function loadData() {
  loading.value = true
  try {
    const result = await fetchAccountAnalytics(
      preset.value,
      preset.value === 'custom' ? customRange.value : undefined,
    )
    rows.value = result.rows
    rangeLabel.value = result.rangeLabel
    await nextTick()
    renderChart()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

watch(preset, (value) => {
  if (value !== 'custom') loadData()
})

function handleResize() {
  chart?.resize()
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>

<template>
  <PageContainer title="账号分析">
    <template #filters>
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
        @change="loadData"
      />
      <span class="range-label">{{ rangeLabel }}</span>
    </template>

    <div v-loading="loading" class="analysis-content">
      <el-row :gutter="16" class="summary-row">
        <el-col :xs="24" :md="12">
          <div class="summary-card summary-card--good">
            <div class="summary-title">表现最好</div>
            <div v-if="bestAccount" class="summary-value">{{ bestAccount.account_name }}</div>
            <div v-else class="summary-value muted">暂无数据</div>
            <div v-if="bestAccount" class="summary-sub">
              利润 {{ formatMoney(bestAccount.total_profit) }} · 成交 {{ bestAccount.order_count }} 单
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :md="12">
          <div class="summary-card summary-card--warn">
            <div class="summary-title">需要关注</div>
            <div v-if="weakAccounts.length" class="summary-value">
              {{ weakAccounts.map((item) => item.account_name).join('、') }}
            </div>
            <div v-else class="summary-value muted">暂无明显短板</div>
            <div class="summary-sub">对比同时间段其他账号自动识别</div>
          </div>
        </el-col>
      </el-row>

      <div ref="chartRef" class="analysis-chart" />

      <el-table :data="rows" class="pro-table" empty-text="暂无闲鱼销售数据">
        <el-table-column label="账号" prop="account_name" min-width="120" />
        <el-table-column label="成交单数" prop="order_count" width="100" align="center" />
        <el-table-column label="卖出件数" prop="total_quantity" width="100" align="center" />
        <el-table-column label="成交额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.total_amount) }}</template>
        </el-table-column>
        <el-table-column label="利润" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.total_profit) }}</template>
        </el-table-column>
        <el-table-column label="利润率" width="90" align="center">
          <template #default="{ row }">{{ formatPercent(row.profit_rate) }}</template>
        </el-table-column>
        <el-table-column label="客单价" width="100" align="right">
          <template #default="{ row }">{{ formatMoney(row.avg_order_amount) }}</template>
        </el-table-column>
        <el-table-column label="评价" min-width="160">
          <template #default="{ row }">
            <div class="tag-list">
              <el-tag v-for="tag in row.tags" :key="tag" size="small" effect="light" class="tag-item">
                {{ tag }}
              </el-tag>
              <span v-if="row.tags.length === 0" class="muted">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="改进建议" min-width="220">
          <template #default="{ row }">
            <div class="suggestion">{{ row.suggestions[0] ?? '-' }}</div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </PageContainer>
</template>

<style scoped>
.preset-group :deep(.el-radio-button__inner) {
  padding: 8px 14px;
}

.custom-range {
  width: 260px;
}

.range-label {
  font-size: 13px;
  color: #909399;
}

.analysis-content {
  min-height: 200px;
}

.summary-row {
  margin-bottom: 16px;
}

.summary-card {
  margin-bottom: 16px;
  padding: 18px 20px;
  border-radius: 10px;
  border: 1px solid #ebeef5;
}

.summary-card--good {
  background: #f0f9eb;
}

.summary-card--warn {
  background: #fdf6ec;
}

.summary-title {
  font-size: 13px;
  color: #909399;
}

.summary-value {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.summary-sub {
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
}

.analysis-chart {
  width: 100%;
  height: 320px;
  margin-bottom: 16px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.suggestion {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.muted {
  color: #c0c4cc;
}
</style>
