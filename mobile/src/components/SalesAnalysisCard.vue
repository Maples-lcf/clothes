<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import type { DatePreset } from '@/utils/date'
import type { SalesAnalytics } from '@/services/analytics'
import { fetchSalesAnalytics } from '@/services/analytics'
import { formatMoney } from '@/utils/money'

const preset = ref<DatePreset>('this_month')
const loading = ref(false)
const analytics = ref<SalesAnalytics | null>(null)
const chartRef = ref<HTMLDivElement | null>(null)

let chart: ECharts | null = null

const presetOptions: Array<{ label: string; value: DatePreset }> = [
  { label: '本周', value: 'this_week' },
  { label: '上周', value: 'last_week' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
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

function disposeChart() {
  chart?.dispose()
  chart = null
}

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
      confine: true,
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
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 11 },
    },
    grid: {
      left: 36,
      right: 36,
      top: 16,
      bottom: 44,
    },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.label),
      axisTick: { alignWithLabel: true },
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisLabel: { color: '#909399', fontSize: 10, interval: 'auto' },
    },
    yAxis: [
      {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#909399', fontSize: 10 },
        splitLine: { lineStyle: { type: 'dashed', color: '#ebeef5' } },
      },
      {
        type: 'value',
        axisLabel: {
          color: '#909399',
          fontSize: 10,
          formatter: (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`),
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '卖出件数',
        type: 'bar',
        barMaxWidth: 12,
        data: points.map((p) => p.quantity),
      },
      {
        name: '成交金额',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 12,
        data: points.map((p) => p.amount),
      },
      {
        name: '总利润',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 6,
        data: points.map((p) => p.profit),
      },
    ],
  })
  chart.resize()
}

async function loadAnalytics() {
  loading.value = true
  disposeChart()
  try {
    analytics.value = await fetchSalesAnalytics(preset.value)
  } finally {
    loading.value = false
    await nextTick()
    renderChart()
  }
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
  disposeChart()
})

watch(preset, loadAnalytics)
</script>

<template>
  <div class="panel-card">
    <div class="panel-header">
      <div>
        <div class="panel-title">分析概览</div>
        <div class="panel-extra">{{ analytics?.rangeLabel ?? '' }}</div>
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

    <template v-else>
      <div class="summary-row">
        <div v-for="item in summaryItems" :key="item.label" class="summary-item">
          <div class="summary-label">{{ item.label }}</div>
          <div class="summary-value" :style="{ color: item.color }">{{ item.value }}</div>
        </div>
      </div>

      <div ref="chartRef" class="analysis-chart" />
    </template>
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
  margin-top: 2px;
  font-size: 12px;
  color: #909399;
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

.summary-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 12px 14px 0;
}

.summary-item {
  padding: 10px;
  border-radius: 8px;
  background: #fafafa;
}

.summary-label {
  font-size: 11px;
  color: #909399;
}

.summary-value {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
}

.analysis-chart {
  width: 100%;
  min-height: 260px;
  height: 260px;
  padding: 4px 8px 8px;
}
</style>
