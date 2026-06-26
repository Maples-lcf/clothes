<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import type { SalesAnalytics } from '@/services/analytics'
import { fetchSalesAnalytics } from '@/services/analytics'
import type { DatePreset } from '@/utils/date'
import { formatMoney } from '@/utils/money'

const preset = ref<DatePreset>('this_week')
const customRange = ref<[string, string]>([
  dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
  dayjs().format('YYYY-MM-DD'),
])
const loading = ref(false)
const analytics = ref<SalesAnalytics | null>(null)
const chartRef = ref<HTMLDivElement | null>(null)

let chart: ECharts | null = null

const presetOptions: Array<{ label: string; value: DatePreset }> = [
  { label: '本周', value: 'this_week' },
  { label: '上周', value: 'last_week' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
  { label: '自定义', value: 'custom' },
]

const summaryItems = computed(() => [
  {
    label: '卖出件数',
    value: `${analytics.value?.summary.totalQuantity ?? 0} 件`,
    color: '#409eff',
  },
  {
    label: '成交金额',
    value: formatMoney(analytics.value?.summary.totalAmount),
    color: '#e6a23c',
  },
  {
    label: '总利润',
    value: formatMoney(analytics.value?.summary.totalProfit),
    color: '#67c23a',
  },
])

function renderChart() {
  if (!chartRef.value || !analytics.value) return

  if (!chart) {
    chart = echarts.init(chartRef.value)
  }

  const points = analytics.value.points

  chart.setOption({
    color: ['#409eff', '#e6a23c', '#67c23a'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter(params: unknown) {
        const items = params as Array<{ seriesName: string; value: number; marker: string }>
        return items
          .map((item) => {
            const value =
              item.seriesName === '卖出件数' ? `${item.value} 件` : formatMoney(item.value)
            return `${item.marker}${item.seriesName}：${value}`
          })
          .join('<br/>')
      },
    },
    legend: {
      data: ['卖出件数', '成交金额', '总利润'],
      bottom: 0,
    },
    grid: {
      left: 48,
      right: 48,
      top: 24,
      bottom: 48,
    },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.label),
      axisTick: { alignWithLabel: true },
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisLabel: { color: '#909399' },
    },
    yAxis: [
      {
        type: 'value',
        name: '件数',
        minInterval: 1,
        axisLabel: { color: '#909399' },
        splitLine: { lineStyle: { type: 'dashed', color: '#ebeef5' } },
      },
      {
        type: 'value',
        name: '金额',
        axisLabel: {
          color: '#909399',
          formatter: (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`),
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '卖出件数',
        type: 'bar',
        barMaxWidth: 18,
        data: points.map((p) => p.quantity),
      },
      {
        name: '成交金额',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 18,
        data: points.map((p) => p.amount),
      },
      {
        name: '总利润',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 8,
        data: points.map((p) => p.profit),
      },
    ],
  })
}

async function loadAnalytics() {
  loading.value = true
  try {
    analytics.value = await fetchSalesAnalytics(
      preset.value,
      preset.value === 'custom' ? customRange.value : undefined,
    )
    await nextTick()
    renderChart()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '分析数据加载失败')
  } finally {
    loading.value = false
  }
}

watch(preset, (value) => {
  if (value !== 'custom') {
    loadAnalytics()
  }
})

function handleCustomApply() {
  if (!customRange.value?.[0] || !customRange.value?.[1]) {
    ElMessage.warning('请选择日期范围')
    return
  }
  loadAnalytics()
}

function handleResize() {
  chart?.resize()
}

onMounted(() => {
  loadAnalytics()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})

watch(
  () => analytics.value,
  () => {
    nextTick(() => renderChart())
  },
)
</script>

<template>
  <div v-loading="loading" class="analysis-panel panel-card">
    <div class="panel-header">
      <div class="panel-header-left">
        <span class="panel-title">分析概览</span>
        <span class="panel-extra">{{ analytics?.rangeLabel ?? '' }}</span>
      </div>
      <div class="panel-header-right">
        <el-radio-group v-model="preset" size="small" class="preset-group">
          <el-radio-button
            v-for="item in presetOptions"
            :key="item.value"
            :value="item.value"
          >
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

    <div class="summary-row">
      <div v-for="item in summaryItems" :key="item.label" class="summary-item">
        <div class="summary-label">{{ item.label }}</div>
        <div class="summary-value" :style="{ color: item.color }">{{ item.value }}</div>
      </div>
    </div>

    <div ref="chartRef" class="analysis-chart" />
  </div>
</template>

<style scoped>
.analysis-panel {
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
  align-items: baseline;
  gap: 10px;
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

.preset-group :deep(.el-radio-button__inner) {
  padding: 8px 14px;
}

.custom-range {
  width: 260px;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 16px 20px 0;
}

.summary-item {
  padding: 14px 16px;
  border-radius: 10px;
  background: #fafafa;
}

.summary-label {
  font-size: 13px;
  color: #909399;
}

.summary-value {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
}

.analysis-chart {
  width: 100%;
  height: 340px;
  padding: 8px 12px 12px;
}

@media (max-width: 768px) {
  .summary-row {
    grid-template-columns: 1fr;
  }

  .preset-group {
    width: 100%;
  }

  .custom-range {
    width: 100%;
  }
}
</style>
