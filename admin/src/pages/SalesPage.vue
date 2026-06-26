<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Download, Upload } from '@element-plus/icons-vue'
import PageContainer from '@/components/PageContainer.vue'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import type { ProductSku, Sale, SalesChannel, SaleOrderStatus } from '@shared/types'
import { SALES_CHANNEL_MAP, SALE_ORDER_STATUS_MAP } from '@shared/types'
import { fetchActiveXianyuAccounts } from '@/services/accounts'
import { getSkuLabel } from '@/services/products'
import {
  createSale,
  fetchAllSkuOptions,
  fetchSales,
  fetchSkuOptions,
  importSales,
  updateSale,
  type SaleFormData,
} from '@/services/sales'
import { calcXianyuFee, formatMoney, getSaleProfit } from '@/utils/money'
import { downloadSalesTemplate, parseSalesImportFile } from '@/utils/salesImport'

const loading = ref(false)
const saving = ref(false)
const editing = ref(false)
const importing = ref(false)
const sales = ref<Sale[]>([])
const skuOptions = ref<ProductSku[]>([])
const allSkus = ref<ProductSku[]>([])
const xianyuAccounts = ref<Array<{ id: string; name: string }>>([])
const dialogVisible = ref(false)
const skuPickerVisible = ref(false)
const skuPickerKeyword = ref('')
const editDialogVisible = ref(false)
const viewDialogVisible = ref(false)
const viewingSale = ref<Sale | null>(null)
const editingSale = ref<Sale | null>(null)
const importInputRef = ref<HTMLInputElement>()

const filters = reactive({
  keyword: '',
  channel: '' as SalesChannel | '',
  account_id: '',
})

const filteredSales = computed(() => {
  return sales.value.filter((sale) => {
    if (filters.channel && sale.channel !== filters.channel) return false
    if (filters.account_id && sale.account_id !== filters.account_id) return false
    if (filters.keyword.trim()) {
      const keyword = filters.keyword.trim().toLowerCase()
      const productName = sale.sku?.product?.name?.toLowerCase() ?? ''
      const note = sale.note?.toLowerCase() ?? ''
      if (!productName.includes(keyword) && !note.includes(keyword)) return false
    }
    return true
  })
})

const { currentPage, pageSize, total, paginatedData } = usePagination(filteredSales)

function resetFilters() {
  filters.keyword = ''
  filters.channel = ''
  filters.account_id = ''
}

const form = reactive<SaleFormData>({
  sku_id: '',
  channel: 'xianyu',
  account_id: null,
  quantity: 1,
  sale_amount: 0,
  unit_cost: 0,
  platform_fee: 0,
  shipping_fee: 0,
  other_fee: 0,
  sold_at: dayjs().format('YYYY-MM-DD'),
  note: null,
  order_status: 'success' as SaleOrderStatus,
})

const editForm = reactive({
  sale_amount: 0,
  platform_fee: 0,
  shipping_fee: 0,
  account_id: null as string | null,
  order_status: 'success' as SaleOrderStatus,
  sold_at: dayjs().format('YYYY-MM-DD'),
})

const estimatedProfit = computed(() => {
  if (form.order_status === 'refunded') return 0
  return (
    form.sale_amount -
    form.unit_cost * form.quantity -
    form.platform_fee -
    form.shipping_fee -
    form.other_fee
  )
})

const editEstimatedProfit = computed(() => {
  if (!editingSale.value) return 0
  if (editForm.order_status === 'refunded') return 0
  return (
    editForm.sale_amount -
    Number(editingSale.value.unit_cost) * editingSale.value.quantity -
    editForm.platform_fee -
    editForm.shipping_fee -
    Number(editingSale.value.other_fee)
  )
})

const selectedSku = computed(() => skuOptions.value.find((sku) => sku.id === form.sku_id))

const selectedSkuLabel = computed(() => {
  if (!selectedSku.value) return ''
  return getSkuLabel(selectedSku.value, selectedSku.value.product)
})

const filteredSkuPickerOptions = computed(() => {
  const keyword = skuPickerKeyword.value.trim().toLowerCase()
  if (!keyword) return skuOptions.value
  return skuOptions.value.filter((sku) => {
    const name = sku.product?.name?.toLowerCase() ?? ''
    const color = sku.color.toLowerCase()
    const size = sku.size.toLowerCase()
    return name.includes(keyword) || color.includes(keyword) || size.includes(keyword)
  })
})

const {
  currentPage: skuPickerPage,
  pageSize: skuPickerPageSize,
  total: skuPickerTotal,
  paginatedData: paginatedSkuOptions,
} = usePagination(filteredSkuPickerOptions)

function getListPrice(row: Sale) {
  return Number(row.sku?.sell_price ?? 0) * row.quantity
}

function getOrderStatusClass(status: SaleOrderStatus) {
  return status === 'refunded' ? 'status-tag status-tag--danger' : 'status-tag status-tag--active'
}

async function loadData() {
  loading.value = true
  try {
    const [saleList, skus, allSkuList, accounts] = await Promise.all([
      fetchSales(),
      fetchSkuOptions(),
      fetchAllSkuOptions(),
      fetchActiveXianyuAccounts(),
    ])
    sales.value = saleList
    skuOptions.value = skus
    allSkus.value = allSkuList
    xianyuAccounts.value = accounts
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function handleDownloadTemplate() {
  if (allSkus.value.length === 0) {
    ElMessage.warning('暂无在售 SKU，请先添加商品')
    return
  }
  downloadSalesTemplate(allSkus.value, xianyuAccounts.value)
}

function triggerImport() {
  importInputRef.value?.click()
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  importing.value = true
  try {
    const buffer = await file.arrayBuffer()
    const parsed = parseSalesImportFile(
      buffer,
      allSkus.value,
      xianyuAccounts.value.map((item) => ({ ...item, platform: 'xianyu' as const })),
    )

    const parseErrors = parsed.filter((item) => item.error)
    const validRows = parsed.filter((item) => item.data) as Array<{ row: number; data: SaleFormData }>

    if (validRows.length === 0) {
      const firstError = parseErrors[0]?.error ?? '没有可导入的数据'
      ElMessage.error(firstError)
      return
    }

    let confirmMessage = `即将导入 ${validRows.length} 条销售记录，库存将自动扣减。`
    if (parseErrors.length > 0) {
      confirmMessage += `\n\n另有 ${parseErrors.length} 行解析失败将被跳过。`
    }

    await ElMessageBox.confirm(confirmMessage, '确认导入', { type: 'info' })

    const result = await importSales(validRows)
    const messages: string[] = []

    if (result.success > 0) {
      messages.push(`成功导入 ${result.success} 条`)
    }
    if (parseErrors.length > 0) {
      messages.push(`${parseErrors.length} 行解析失败`)
    }
    if (result.failed.length > 0) {
      messages.push(`${result.failed.length} 行导入失败`)
    }

    const allErrors = [
      ...parseErrors.map((item) => `第 ${item.row} 行：${item.error}`),
      ...result.failed.map((item) => `第 ${item.row} 行：${item.message}`),
    ]

    if (allErrors.length > 0) {
      await ElMessageBox.alert(
        `${messages.join('，')}\n\n${allErrors.slice(0, 10).join('\n')}${allErrors.length > 10 ? `\n... 共 ${allErrors.length} 条错误` : ''}`,
        result.success > 0 ? '导入完成' : '导入失败',
        { type: result.success > 0 ? 'warning' : 'error' },
      )
    } else {
      ElMessage.success(`成功导入 ${result.success} 条销售记录`)
    }

    if (result.success > 0) {
      await loadData()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '导入失败')
    }
  } finally {
    importing.value = false
  }
}

function resetForm() {
  form.sku_id = skuOptions.value[0]?.id ?? ''
  form.channel = 'xianyu'
  form.account_id = xianyuAccounts.value[0]?.id ?? null
  form.quantity = 1
  form.sale_amount = selectedSku.value ? Number(selectedSku.value.sell_price) : 0
  form.unit_cost = selectedSku.value ? Number(selectedSku.value.cost_price) : 0
  form.platform_fee = calcXianyuFee(form.sale_amount)
  form.shipping_fee = 0
  form.other_fee = 0
  form.sold_at = dayjs().format('YYYY-MM-DD')
  form.note = null
  form.order_status = 'success'
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openSkuPicker() {
  skuPickerKeyword.value = ''
  skuPickerVisible.value = true
}

function selectSku(sku: ProductSku) {
  form.sku_id = sku.id
  handleSkuChange()
  skuPickerVisible.value = false
}

function handleSkuChange() {
  if (!selectedSku.value) return
  form.unit_cost = selectedSku.value.product?.source_type === 'own'
    ? 0
    : Number(selectedSku.value.cost_price)
  if (!form.sale_amount) {
    form.sale_amount = Number(selectedSku.value.sell_price) * form.quantity
  }
  if (form.channel === 'xianyu') {
    form.platform_fee = calcXianyuFee(form.sale_amount)
  }
}

function handleAmountChange() {
  if (form.channel === 'xianyu') {
    form.platform_fee = calcXianyuFee(form.sale_amount)
  }
}

function handleChannelChange(channel: SalesChannel) {
  if (channel === 'xianyu') {
    form.platform_fee = calcXianyuFee(form.sale_amount)
    if (!form.account_id) {
      form.account_id = xianyuAccounts.value[0]?.id ?? null
    }
  } else {
    form.account_id = null
  }
}

async function handleSave() {
  if (!form.sku_id) {
    ElMessage.warning('请选择 SKU')
    return
  }
  if (form.sale_amount <= 0) {
    ElMessage.warning('请填写成交额')
    return
  }
  if (form.channel === 'xianyu' && !form.account_id) {
    ElMessage.warning('请选择闲鱼成交账号')
    return
  }

  saving.value = true
  try {
    await createSale(form)
    ElMessage.success('销售记录已保存，库存已自动扣减')
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function openView(row: Sale) {
  viewingSale.value = row
  viewDialogVisible.value = true
}

function openEdit(row: Sale) {
  editingSale.value = row
  editForm.sale_amount = Number(row.sale_amount)
  editForm.platform_fee = Number(row.platform_fee)
  editForm.shipping_fee = Number(row.shipping_fee)
  editForm.account_id = row.account_id
  editForm.order_status = row.order_status ?? 'success'
  editForm.sold_at = row.sold_at
  editDialogVisible.value = true
}

async function handleEditSave() {
  if (!editingSale.value) return
  if (editForm.sale_amount <= 0) {
    ElMessage.warning('请填写实际售价')
    return
  }
  if (editingSale.value.channel === 'xianyu' && !editForm.account_id) {
    ElMessage.warning('请选择闲鱼成交账号')
    return
  }
  if (!editForm.sold_at) {
    ElMessage.warning('请选择下单日期')
    return
  }

  editing.value = true
  try {
    await updateSale(
      editingSale.value.id,
      {
        sale_amount: editForm.sale_amount,
        platform_fee: editForm.platform_fee,
        shipping_fee: editForm.shipping_fee,
        account_id: editForm.account_id,
        order_status: editForm.order_status,
        sold_at: editForm.sold_at,
      },
      editingSale.value.channel,
    )
    ElMessage.success('销售记录已更新')
    editDialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    editing.value = false
  }
}

function isHttpUrl(value: string | null | undefined) {
  return Boolean(value?.trim().match(/^https?:\/\//i))
}

function getXianyuLink(row: Sale) {
  const productLink = row.sku?.product?.xianyu_link?.trim()
  if (productLink) return productLink
  const note = row.note?.trim()
  return isHttpUrl(note) ? note : null
}

onMounted(loadData)
</script>

<template>
  <PageContainer title="销售记录">
    <template #actions>
      <el-button :icon="Download" @click="handleDownloadTemplate">模版下载</el-button>
      <el-button :icon="Upload" :loading="importing" @click="triggerImport">数据导入</el-button>
      <el-button type="primary" class="btn-add" :icon="Plus" @click="openCreate">录入销售</el-button>
      <input
        ref="importInputRef"
        type="file"
        accept=".xlsx,.xls"
        class="import-input"
        @change="handleImportFile"
      />
    </template>

    <template #filters>
      <el-input
        v-model="filters.keyword"
        class="filter-input"
        placeholder="商品名称 / 备注"
        clearable
        :prefix-icon="Search"
      />
      <el-select v-model="filters.channel" class="filter-select" placeholder="渠道" clearable>
        <el-option v-for="(label, value) in SALES_CHANNEL_MAP" :key="value" :label="label" :value="value" />
      </el-select>
      <el-select v-model="filters.account_id" class="filter-select" placeholder="闲鱼账号" clearable>
        <el-option v-for="item in xianyuAccounts" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-button class="filter-btn" type="primary" plain>查询</el-button>
      <el-button class="filter-btn filter-btn--ghost" @click="resetFilters">重置</el-button>
    </template>

    <el-table v-loading="loading" :data="paginatedData" class="pro-table" empty-text="还没有销售记录">
      <el-table-column label="下单日期" prop="sold_at" width="110" />
      <el-table-column label="商品" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.sku?.product?.name }} / {{ row.sku?.color }} / {{ row.sku?.size }}
        </template>
      </el-table-column>
      <el-table-column label="利润" width="100" align="right">
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
      <el-table-column label="账号" width="110" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.account?.name ?? (row.channel === 'xianyu' ? '未标记' : '-') }}
        </template>
      </el-table-column>
      <el-table-column label="订单状态" width="100" align="center">
        <template #default="{ row }">
          <span :class="getOrderStatusClass((row.order_status ?? 'success') as SaleOrderStatus)">
            {{ SALE_ORDER_STATUS_MAP[(row.order_status ?? 'success') as SaleOrderStatus] }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="数量" prop="quantity" width="70" align="center" />
      <el-table-column label="售价" width="100" align="right">
        <template #default="{ row }">{{ formatMoney(getListPrice(row)) }}</template>
      </el-table-column>
      <el-table-column label="实际售价" width="100" align="right">
        <template #default="{ row }">{{ formatMoney(row.sale_amount) }}</template>
      </el-table-column>
      <el-table-column label="运费" width="90" align="right">
        <template #default="{ row }">{{ formatMoney(row.shipping_fee) }}</template>
      </el-table-column>
      <el-table-column label="平台服务费" width="100" align="right">
        <template #default="{ row }">{{ formatMoney(row.platform_fee) }}</template>
      </el-table-column>
      <el-table-column label="进价成本" width="100" align="right">
        <template #default="{ row }">{{ formatMoney(row.unit_cost * row.quantity) }}</template>
      </el-table-column>
      <el-table-column label="渠道" width="90" align="center">
        <template #default="{ row }">
          <span class="status-tag status-tag--active">
            {{ SALES_CHANNEL_MAP[row.channel as SalesChannel] }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="备注" prop="note" min-width="120" show-overflow-tooltip />
      <el-table-column label="操作" width="170" fixed="right" align="center" class-name="col-actions">
        <template #default="{ row }">
          <div class="table-actions table-actions--nowrap">
            <el-button class="action-btn action-btn--edit" size="small" @click="openView(row)">
              查看
            </el-button>
            <el-button class="action-btn action-btn--primary" size="small" @click="openEdit(row)">
              编辑
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

    <el-dialog
      v-model="dialogVisible"
      title="录入销售"
      width="720px"
      class="sale-dialog"
      destroy-on-close
    >
      <el-form label-width="90px" class="sale-form">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="卖出商品" required>
              <div class="sku-picker-field">
                <el-input
                  :model-value="selectedSkuLabel"
                  readonly
                  placeholder="请点击选择商品"
                  @click="openSkuPicker"
                />
                <el-button type="primary" plain @click="openSkuPicker">选择商品</el-button>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="销售渠道">
              <el-select v-model="form.channel" style="width: 100%" @change="handleChannelChange">
                <el-option v-for="(label, value) in SALES_CHANNEL_MAP" :key="value" :label="label" :value="value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="form.channel === 'xianyu'" :span="12">
            <el-form-item label="成交账号" required>
              <el-select v-model="form.account_id" filterable style="width: 100%" placeholder="选择闲鱼号">
                <el-option v-for="item in xianyuAccounts" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
              <div v-if="xianyuAccounts.length === 0" class="hint">
                请先在「闲鱼账号」页面添加账号
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="下单日期">
              <el-date-picker v-model="form.sold_at" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="订单状态">
              <el-radio-group v-model="form.order_status">
                <el-radio v-for="(label, value) in SALE_ORDER_STATUS_MAP" :key="value" :value="value">
                  {{ label }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数量">
              <el-input-number v-model="form.quantity" :min="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="成交额" required>
              <el-input-number
                v-model="form.sale_amount"
                :min="0"
                :precision="2"
                style="width: 100%"
                @change="handleAmountChange"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单件进价">
              <el-input-number
                v-model="form.unit_cost"
                :min="0"
                :precision="2"
                :disabled="selectedSku?.product?.source_type === 'own'"
                style="width: 100%"
              />
              <div v-if="selectedSku?.product?.source_type === 'own'" class="hint">
                自有闲置衣服，成本按 ¥0 计算，利润 = 成交额 - 各项费用
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="平台服务费">
              <el-input-number v-model="form.platform_fee" :min="0" :precision="2" style="width: 100%" />
              <div v-if="form.channel === 'xianyu'" class="hint">闲鱼默认按 0.6% 估算，可手动改</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="运费">
              <el-input-number v-model="form.shipping_fee" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="其他费用">
              <el-input-number v-model="form.other_fee" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预计利润">
              <div class="profit-display" :class="estimatedProfit >= 0 ? 'profit-display--positive' : 'profit-display--negative'">
                {{ formatMoney(estimatedProfit) }}
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.note" placeholder="买家昵称、闲鱼订单备注等" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button class="dialog-btn dialog-btn--ghost" @click="dialogVisible = false">取消</el-button>
        <el-button class="dialog-btn dialog-btn--primary" type="primary" :loading="saving" @click="handleSave">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="skuPickerVisible"
      title="选择商品"
      width="880px"
      class="sale-dialog sku-picker-dialog"
      append-to-body
      destroy-on-close
    >
      <div class="sku-picker-toolbar">
        <el-input
          v-model="skuPickerKeyword"
          placeholder="搜索商品名称 / 颜色 / 尺码"
          clearable
          :prefix-icon="Search"
        />
        <span class="sku-picker-count">共 {{ skuPickerTotal }} 个 SKU</span>
      </div>

      <el-table
        :data="paginatedSkuOptions"
        class="pro-table sku-picker-table"
        empty-text="暂无在售商品"
        highlight-current-row
        @row-click="selectSku"
      >
        <el-table-column label="商品名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.product?.name ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="颜色" prop="color" width="100" />
        <el-table-column label="尺码" prop="size" width="100" />
        <el-table-column label="库存" prop="stock" width="80" align="center" />
        <el-table-column label="售价" width="100" align="right">
          <template #default="{ row }">{{ formatMoney(row.sell_price) }}</template>
        </el-table-column>
        <el-table-column label="进价" width="100" align="right">
          <template #default="{ row }">
            {{ formatMoney(row.product?.source_type === 'own' ? 0 : row.cost_price) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center" fixed="right">
          <template #default="{ row }">
            <el-button class="action-btn action-btn--primary" size="small" @click.stop="selectSku(row)">
              选择
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <TablePagination
        v-model:current-page="skuPickerPage"
        v-model:page-size="skuPickerPageSize"
        :total="skuPickerTotal"
      />
    </el-dialog>

    <el-dialog
      v-model="viewDialogVisible"
      title="销售详情"
      width="680px"
      class="sale-dialog"
      destroy-on-close
    >
      <template v-if="viewingSale">
        <el-descriptions :column="2" border class="sale-detail">
          <el-descriptions-item label="下单日期">{{ viewingSale.sold_at }}</el-descriptions-item>
          <el-descriptions-item label="销售渠道">
            {{ SALES_CHANNEL_MAP[viewingSale.channel as SalesChannel] }}
          </el-descriptions-item>
          <el-descriptions-item label="商品名称" :span="2">
            {{ viewingSale.sku?.product?.name ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="颜色">{{ viewingSale.sku?.color ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="尺码">{{ viewingSale.sku?.size ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="成交账号">
            {{ viewingSale.account?.name ?? (viewingSale.channel === 'xianyu' ? '未标记' : '-') }}
          </el-descriptions-item>
          <el-descriptions-item label="订单状态">
            <span :class="getOrderStatusClass((viewingSale.order_status ?? 'success') as SaleOrderStatus)">
              {{ SALE_ORDER_STATUS_MAP[(viewingSale.order_status ?? 'success') as SaleOrderStatus] }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="数量">{{ viewingSale.quantity }}</el-descriptions-item>
          <el-descriptions-item label="售价">{{ formatMoney(getListPrice(viewingSale)) }}</el-descriptions-item>
          <el-descriptions-item label="实际售价">{{ formatMoney(viewingSale.sale_amount) }}</el-descriptions-item>
          <el-descriptions-item label="单件进价">{{ formatMoney(viewingSale.unit_cost) }}</el-descriptions-item>
          <el-descriptions-item label="进价成本">
            {{ formatMoney(viewingSale.unit_cost * viewingSale.quantity) }}
          </el-descriptions-item>
          <el-descriptions-item label="平台服务费">{{ formatMoney(viewingSale.platform_fee) }}</el-descriptions-item>
          <el-descriptions-item label="运费">{{ formatMoney(viewingSale.shipping_fee) }}</el-descriptions-item>
          <el-descriptions-item label="其他费用">{{ formatMoney(viewingSale.other_fee) }}</el-descriptions-item>
          <el-descriptions-item label="利润">
            <span
              :class="
                (viewingSale.order_status ?? 'success') === 'refunded'
                  ? 'profit-refunded'
                  : getSaleProfit(viewingSale) >= 0
                    ? 'profit-positive'
                    : 'profit-negative'
              "
            >
              {{ formatMoney(getSaleProfit(viewingSale)) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item v-if="getXianyuLink(viewingSale)" label="闲鱼链接" :span="2">
            <a
              :href="getXianyuLink(viewingSale)!"
              target="_blank"
              rel="noopener noreferrer"
              class="xianyu-link"
            >
              {{ getXianyuLink(viewingSale) }}
            </a>
          </el-descriptions-item>
          <el-descriptions-item
            v-if="viewingSale.note && !isHttpUrl(viewingSale.note)"
            label="备注"
            :span="2"
          >
            {{ viewingSale.note }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <template #footer>
        <el-button class="dialog-btn dialog-btn--ghost" @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editDialogVisible"
      title="编辑销售"
      width="560px"
      class="sale-dialog"
      destroy-on-close
    >
      <template v-if="editingSale">
        <div class="edit-sale-summary">
          {{ editingSale.sku?.product?.name }} / {{ editingSale.sku?.color }} / {{ editingSale.sku?.size }}
        </div>
        <el-form label-width="100px" class="sale-form">
          <el-form-item label="下单日期">
            <el-date-picker v-model="editForm.sold_at" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item v-if="editingSale.channel === 'xianyu'" label="成交账号" required>
            <el-select v-model="editForm.account_id" filterable style="width: 100%" placeholder="选择闲鱼号">
              <el-option v-for="item in xianyuAccounts" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="订单状态">
            <el-radio-group v-model="editForm.order_status">
              <el-radio v-for="(label, value) in SALE_ORDER_STATUS_MAP" :key="value" :value="value">
                {{ label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="实际售价" required>
            <el-input-number v-model="editForm.sale_amount" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item label="运费">
            <el-input-number v-model="editForm.shipping_fee" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item label="平台服务费">
            <el-input-number v-model="editForm.platform_fee" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item label="预计利润">
            <div
              class="profit-display"
              :class="editEstimatedProfit >= 0 ? 'profit-display--positive' : 'profit-display--negative'"
            >
              {{ formatMoney(editEstimatedProfit) }}
            </div>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button class="dialog-btn dialog-btn--ghost" @click="editDialogVisible = false">取消</el-button>
        <el-button class="dialog-btn dialog-btn--primary" type="primary" :loading="editing" @click="handleEditSave">
          保存
        </el-button>
      </template>
    </el-dialog>
</template>

<style scoped>
.sale-dialog :deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
}

.sale-dialog :deep(.el-dialog__header) {
  padding: 20px 24px 16px;
  margin-right: 0;
  border-bottom: 1px solid #f0f2f5;
}

.sale-dialog :deep(.el-dialog__title) {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.sale-dialog :deep(.el-dialog__headerbtn) {
  top: 20px;
  right: 20px;
  width: 28px;
  height: 28px;
}

.sale-dialog :deep(.el-dialog__body) {
  padding: 20px 24px 4px;
}

.sale-dialog :deep(.el-dialog__footer) {
  padding: 16px 24px 20px;
  border-top: 1px solid #f0f2f5;
}

.sale-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.sale-form :deep(.el-form-item__label) {
  color: #606266;
  font-weight: 500;
}

.hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: #909399;
}

.profit-display {
  display: inline-flex;
  align-items: center;
  min-width: 100px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
}

.profit-display--positive {
  color: #389e47;
  background: #edf9ef;
}

.profit-display--negative {
  color: #f56c6c;
  background: #fef0f0;
}

.profit-positive {
  color: #67c23a;
}

.profit-negative {
  color: #f56c6c;
}

.profit-refunded {
  color: #909399;
}

.dialog-btn {
  min-width: 80px;
  border-radius: 20px;
  padding: 8px 20px;
  font-weight: 500;
}

.dialog-btn--ghost {
  --el-button-bg-color: #fff;
  --el-button-border-color: #dcdfe6;
  --el-button-text-color: #606266;
}

.dialog-btn--primary {
  --el-button-border-color: #409eff;
}

.import-input {
  display: none;
}

.sale-detail :deep(.el-descriptions__label) {
  width: 108px;
  color: #606266;
  font-weight: 500;
}

.edit-sale-summary {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f5f7fa;
  color: #303133;
  font-size: 14px;
  line-height: 1.5;
}

.sku-picker-field {
  display: flex;
  gap: 10px;
  width: 100%;
}

.sku-picker-field :deep(.el-input) {
  flex: 1;
}

.sku-picker-field :deep(.el-input__wrapper) {
  cursor: pointer;
}

.sku-picker-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.sku-picker-toolbar .el-input {
  flex: 1;
}

.sku-picker-count {
  flex-shrink: 0;
  font-size: 13px;
  color: #909399;
}

.sku-picker-table {
  cursor: pointer;
}

.table-actions--nowrap {
  flex-wrap: nowrap;
  justify-content: center;
}

:deep(.col-actions .cell) {
  padding-left: 8px;
  padding-right: 8px;
}

.xianyu-link {
  color: #409eff;
  word-break: break-all;
  text-decoration: none;
}

.xianyu-link:hover {
  text-decoration: underline;
}
</style>
