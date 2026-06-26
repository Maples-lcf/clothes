<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import PageContainer from '@/components/PageContainer.vue'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import type { ProductSku, StockLog, StockLogType } from '@shared/types'
import { STOCK_LOG_TYPE_MAP } from '@shared/types'
import { adjustStock, fetchAllSkus, fetchStockLogs } from '@/services/inventory'
import { formatMoney } from '@/utils/money'

const loading = ref(false)
const saving = ref(false)
const skus = ref<ProductSku[]>([])
const logs = ref<StockLog[]>([])
const dialogVisible = ref(false)

const filters = reactive({
  keyword: '',
  stockStatus: '' as '' | 'low' | 'normal',
})

const filteredSkus = computed(() => {
  return skus.value.filter((sku) => {
    if (filters.stockStatus === 'low' && sku.stock > sku.low_stock_threshold) return false
    if (filters.stockStatus === 'normal' && sku.stock <= sku.low_stock_threshold) return false
    if (filters.keyword.trim()) {
      const keyword = filters.keyword.trim().toLowerCase()
      const name = sku.product?.name?.toLowerCase() ?? ''
      const spec = `${sku.color}${sku.size}`.toLowerCase()
      if (!name.includes(keyword) && !spec.includes(keyword)) return false
    }
    return true
  })
})

const { currentPage, pageSize, total, paginatedData } = usePagination(filteredSkus)
const {
  currentPage: logsCurrentPage,
  pageSize: logsPageSize,
  total: logsTotal,
  paginatedData: paginatedLogs,
} = usePagination(logs)

const adjustForm = reactive({
  skuId: '',
  skuLabel: '',
  type: 'in' as StockLogType,
  quantity: 1,
  note: '',
})

function resetFilters() {
  filters.keyword = ''
  filters.stockStatus = ''
}

async function loadData() {
  loading.value = true
  try {
    const [skuList, logList] = await Promise.all([fetchAllSkus(), fetchStockLogs()])
    skus.value = skuList
    logs.value = logList
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openAdjust(sku: ProductSku) {
  adjustForm.skuId = sku.id
  adjustForm.skuLabel = `${sku.product?.name} / ${sku.color} / ${sku.size}`
  adjustForm.type = 'in'
  adjustForm.quantity = 1
  adjustForm.note = ''
  dialogVisible.value = true
}

async function handleAdjust() {
  saving.value = true
  try {
    const nextStock = await adjustStock(
      adjustForm.skuId,
      adjustForm.type,
      adjustForm.quantity,
      adjustForm.note,
    )
    ElMessage.success(`库存已更新，当前 ${nextStock} 件`)
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '调整失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <PageContainer title="库存管理">
    <template #filters>
      <el-input
        v-model="filters.keyword"
        class="filter-input"
        placeholder="商品名称 / 颜色 / 尺码"
        clearable
        :prefix-icon="Search"
      />
      <el-select v-model="filters.stockStatus" class="filter-select" placeholder="库存状态" clearable>
        <el-option label="低库存" value="low" />
        <el-option label="正常" value="normal" />
      </el-select>
      <el-button class="filter-btn" type="primary" plain>查询</el-button>
      <el-button class="filter-btn filter-btn--ghost" @click="resetFilters">重置</el-button>
    </template>

    <el-table v-loading="loading" :data="paginatedData" class="pro-table" empty-text="暂无 SKU">
      <el-table-column label="商品" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.product?.name }}
          <span v-if="row.product?.source_type === 'own'" class="inline-tag">自有</span>
        </template>
      </el-table-column>
      <el-table-column label="颜色" prop="color" width="100" align="center" />
      <el-table-column label="尺码" prop="size" width="100" align="center" />
      <el-table-column label="进价" width="110" align="right">
        <template #default="{ row }">{{ formatMoney(row.cost_price) }}</template>
      </el-table-column>
      <el-table-column label="售价" width="110" align="right">
        <template #default="{ row }">{{ formatMoney(row.sell_price) }}</template>
      </el-table-column>
      <el-table-column label="库存" width="100" align="center">
        <template #default="{ row }">
          <span
            :class="row.stock <= row.low_stock_threshold ? 'status-tag status-tag--danger' : 'status-tag status-tag--success'"
          >
            {{ row.stock }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="货值" width="110" align="right">
        <template #default="{ row }">{{ formatMoney(row.stock * Number(row.cost_price)) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right" align="center">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button class="action-btn action-btn--primary" size="small" @click="openAdjust(row)">
              调整
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <TablePagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="total"
    />
  </PageContainer>

  <PageContainer title="库存变动记录">
    <el-table :data="paginatedLogs" class="pro-table" empty-text="暂无记录">
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="商品" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.sku?.product?.name }} / {{ row.sku?.color }} / {{ row.sku?.size }}
        </template>
      </el-table-column>
      <el-table-column label="类型" width="100" align="center">
        <template #default="{ row }">
          <span class="status-tag status-tag--active">
            {{ STOCK_LOG_TYPE_MAP[row.type as StockLogType] }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="变动" width="90" align="center" prop="quantity" />
      <el-table-column label="备注" prop="note" min-width="140" show-overflow-tooltip />
    </el-table>

    <TablePagination
      v-model:current-page="logsCurrentPage"
      v-model:page-size="logsPageSize"
      :total="logsTotal"
    />
  </PageContainer>

  <el-dialog v-model="dialogVisible" title="调整库存" width="480px">
    <el-form label-width="90px">
      <el-form-item label="SKU">
        <el-input :model-value="adjustForm.skuLabel" disabled />
      </el-form-item>
      <el-form-item label="操作类型">
        <el-radio-group v-model="adjustForm.type">
          <el-radio value="in">入库</el-radio>
          <el-radio value="out">出库</el-radio>
          <el-radio value="adjust">直接调整</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item :label="adjustForm.type === 'adjust' ? '变动数量' : '数量'">
        <el-input-number v-model="adjustForm.quantity" :min="1" />
        <div v-if="adjustForm.type === 'adjust'" class="hint">正数加库存，负数减库存</div>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="adjustForm.note" placeholder="例如：补货、盘点调整" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleAdjust">确认</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.inline-tag {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11px;
  color: #909399;
  background: #f4f4f5;
}
</style>
