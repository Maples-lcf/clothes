<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { onBeforeRouteUpdate } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Download, Upload } from '@element-plus/icons-vue'
import PageContainer from '@/components/PageContainer.vue'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import type { Category, Product, ProductSourceType, ProductStatus } from '@shared/types'
import { PRODUCT_SOURCE_HINT, PRODUCT_SOURCE_MAP, PRODUCT_STATUS_MAP } from '@shared/types'
import { isNewArrivalToday, getTodayDateString } from '@shared/productNewArrival'
import { getProductCoverImage, getProductPreviewImages, PRODUCT_IMAGE_STYLE_MAP, type ProductImageStyle } from '@shared/productImages'
import { fetchCategories } from '@/services/categories'
import { fetchActiveXianyuAccounts } from '@/services/accounts'
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  importProducts,
  updateProduct,
  uploadProductImage,
  type ProductFormData,
} from '@/services/products'
import { generateProductImage } from '@/services/aiImages'
import {
  buildProductImportBatches,
  downloadProductTemplate,
  parseProductImportFile,
} from '@/utils/productImport'
import { getServiceErrorMessage } from '@/utils/error'
import { formatMoney } from '@/utils/money'

const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const aiGeneratingKey = ref<string | null>(null)
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const xianyuAccounts = ref<Array<{ id: string; name: string }>>([])
const dialogVisible = ref(false)
const detailDialogVisible = ref(false)
const viewingProduct = ref<Product | null>(null)
const editingId = ref<string | null>(null)
const editingCode = ref('')
const importInputRef = ref<HTMLInputElement>()

const filters = reactive({
  keyword: '',
  status: '' as ProductStatus | '',
  category_id: '',
  source_type: '' as ProductSourceType | '',
  account_id: '',
})

const filteredProducts = computed(() => {
  return products.value.filter((product) => {
    if (filters.keyword.trim()) {
      const keyword = filters.keyword.trim().toLowerCase()
      const matchName = product.name.toLowerCase().includes(keyword)
      const matchCode = product.code?.toLowerCase().includes(keyword) ?? false
      if (!matchName && !matchCode) return false
    }
    if (filters.status && product.status !== filters.status) return false
    if (filters.category_id && product.category_id !== filters.category_id) return false
    if (filters.source_type && product.source_type !== filters.source_type) return false
    if (filters.account_id && product.account_id !== filters.account_id) return false
    return true
  })
})

const { currentPage, pageSize, total, paginatedData } = usePagination(filteredProducts)

function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  filters.category_id = ''
  filters.source_type = ''
  filters.account_id = ''
}

function getSourceClass(source: ProductSourceType) {
  return source === 'own' ? 'status-tag status-tag--sold_out' : 'status-tag status-tag--active'
}

function isOwnProduct(source: ProductSourceType = form.source_type) {
  return source === 'own'
}

function applySourceTypeToSkus() {
  if (!isOwnProduct()) return
  form.skus.forEach((sku) => {
    sku.cost_price = 0
  })
}

function handleSourceTypeChange() {
  applySourceTypeToSkus()
}

function handleNewArrivalChange(checked: boolean) {
  form.listed_at = checked ? getTodayDateString() : null
}

function showNewArrivalTag(product: Product) {
  return isNewArrivalToday(product.listed_at)
}

function formatListedAt(date: string | null | undefined) {
  return date ?? '-'
}

function getStatusClass(status: ProductStatus) {
  return `status-tag status-tag--${status}`
}

function createEmptySku(): ProductFormData['skus'][number] {
  return {
    color: '均色',
    size: '均码',
    cost_price: 0,
    sell_price: 0,
    stock: 1,
    low_stock_threshold: 2,
  }
}

const form = reactive<ProductFormData>({
  category_id: null,
  account_id: null,
  name: '',
  description: null,
  images: [],
  original_images: [],
  xianyu_link: null,
  status: 'active',
  source_type: 'own',
  is_new_arrival: false,
  listed_at: null,
  skus: [createEmptySku()],
})

function resetForm() {
  editingId.value = null
  editingCode.value = ''
  form.category_id = categories.value[0]?.id ?? null
  form.account_id = null
  form.name = ''
  form.description = null
  form.images = []
  form.original_images = []
  form.xianyu_link = null
  form.status = 'active'
  form.source_type = 'own'
  form.is_new_arrival = false
  form.listed_at = null
  form.skus = [createEmptySku()]
}

async function loadData() {
  loading.value = true
  try {
    const [productList, categoryList, accounts] = await Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchActiveXianyuAccounts(),
    ])
    products.value = productList
    categories.value = categoryList
    xianyuAccounts.value = accounts
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openDetail(product: Product) {
  viewingProduct.value = product
  detailDialogVisible.value = true
}

function openEdit(product: Product) {
  editingId.value = product.id
  editingCode.value = product.code
  form.category_id = product.category_id
  form.account_id = product.account_id ?? null
  form.name = product.name
  form.description = product.description
  form.images = [...product.images]
  form.original_images = [...(product.original_images ?? product.images)]
  form.xianyu_link = product.xianyu_link ?? null
  form.status = product.status
  form.source_type = product.source_type ?? 'own'
  form.is_new_arrival = isNewArrivalToday(product.listed_at)
  form.listed_at = product.listed_at ?? null
  form.skus = (product.skus ?? []).map((sku) => ({
    id: sku.id,
    color: sku.color,
    size: sku.size,
    cost_price: Number(sku.cost_price),
    sell_price: Number(sku.sell_price),
    stock: sku.stock,
    low_stock_threshold: sku.low_stock_threshold,
  }))
  if (form.skus.length === 0) form.skus = [createEmptySku()]
  applySourceTypeToSkus()
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写商品名称')
    return
  }

  if (isOwnProduct()) {
    applySourceTypeToSkus()
  } else if (form.skus.some((sku) => sku.cost_price <= 0)) {
    ElMessage.warning('进货商品请填写进价')
    return
  }

  if (form.is_new_arrival) {
    form.listed_at = getTodayDateString()
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateProduct(editingId.value, form)
      ElMessage.success('商品已更新')
    } else {
      await createProduct(form)
      ElMessage.success('商品已创建')
    }
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(getServiceErrorMessage(error, '保存失败'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(product: Product) {
  try {
    await ElMessageBox.confirm(`确定删除「${product.name}」吗？`, '删除确认', { type: 'warning' })
    await deleteProduct(product.id)
    ElMessage.success('已删除')
    await loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }
}

async function handleUploadOriginal(file: File) {
  try {
    const url = await uploadProductImage(file)
    form.original_images.push(url)
    if (!form.images.includes(url)) {
      form.images.push(url)
    }
    ElMessage.success('原图上传成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传失败')
  }
  return false
}

async function handleUploadDisplay(file: File) {
  try {
    const url = await uploadProductImage(file)
    form.images.push(url)
    ElMessage.success('展示图上传成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传失败')
  }
  return false
}

function removeOriginalImage(index: number) {
  const url = form.original_images[index]
  form.original_images.splice(index, 1)
  const displayIndex = form.images.indexOf(url)
  if (displayIndex >= 0) form.images.splice(displayIndex, 1)
}

function removeDisplayImage(index: number) {
  form.images.splice(index, 1)
}

function isAiGeneratedImage(url: string) {
  return url.includes('/ai/')
}

async function handleAiGenerate(originalUrl: string, style: ProductImageStyle) {
  const key = `${originalUrl}:${style}`
  aiGeneratingKey.value = key
  try {
    const url = await generateProductImage(originalUrl, style)
    if (!form.images.includes(url)) {
      form.images.push(url)
    }
    ElMessage.success(`${PRODUCT_IMAGE_STYLE_MAP[style]} 已加入展示图`)
  } catch (error) {
    ElMessage.error(getServiceErrorMessage(error, 'AI 出图失败'))
  } finally {
    if (aiGeneratingKey.value === key) {
      aiGeneratingKey.value = null
    }
  }
}

function isAiGenerating(originalUrl: string, style: ProductImageStyle) {
  return aiGeneratingKey.value === `${originalUrl}:${style}`
}

function addSkuRow() {
  form.skus.push(createEmptySku())
}

function getProductPriceHint(product: Product) {
  const skus = product.skus ?? []
  if (skus.length === 0) return '-'
  const minSell = Math.min(...skus.map((s) => Number(s.sell_price)))
  if (product.source_type === 'own') {
    return minSell > 0 ? `售价 ${minSell} 起 · 成本 ¥0` : '成本 ¥0'
  }
  const minCost = Math.min(...skus.map((s) => Number(s.cost_price)))
  return `进价 ${minCost} · 售价 ${minSell} 起`
}

function removeSkuRow(index: number) {
  if (form.skus.length === 1) {
    ElMessage.warning('至少保留一个 SKU')
    return
  }
  form.skus.splice(index, 1)
}

function getTotalStock(product: Product) {
  return (product.skus ?? []).reduce((sum, sku) => sum + sku.stock, 0)
}

function handleDownloadTemplate() {
  downloadProductTemplate(categories.value)
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
    const parsedRows = parseProductImportFile(buffer)
    const batches = buildProductImportBatches(parsedRows, categories.value)

    const batchErrors = batches.filter((item) => item.error)
    const validBatches = batches.filter((item) => item.data) as Array<{
      rows: number[]
      data: ProductFormData
    }>

    if (validBatches.length === 0) {
      const firstError = batchErrors[0]?.error ?? '没有可导入的数据'
      ElMessage.error(firstError)
      return
    }

    const skuCount = validBatches.reduce((sum, item) => sum + item.data.skus.length, 0)
    let confirmMessage = `即将导入 ${validBatches.length} 个商品（共 ${skuCount} 个 SKU）。`
    if (batchErrors.length > 0) {
      confirmMessage += `\n\n另有 ${batchErrors.length} 组数据解析失败将被跳过。`
    }

    await ElMessageBox.confirm(confirmMessage, '确认导入', { type: 'info' })

    const result = await importProducts(validBatches)
    const messages: string[] = []

    if (result.success > 0) {
      messages.push(`成功导入 ${result.success} 个商品`)
    }
    if (batchErrors.length > 0) {
      messages.push(`${batchErrors.length} 组解析失败`)
    }
    if (result.failed.length > 0) {
      messages.push(`${result.failed.length} 个商品导入失败`)
    }

    const allErrors = [
      ...batchErrors.map((item) => item.error!),
      ...result.failed.map((item) => `第 ${item.rows.join('、')} 行：${item.message}`),
    ]

    if (allErrors.length > 0) {
      await ElMessageBox.alert(
        `${messages.join('，')}\n\n${allErrors.slice(0, 10).join('\n')}${allErrors.length > 10 ? `\n... 共 ${allErrors.length} 条错误` : ''}`,
        result.success > 0 ? '导入完成' : '导入失败',
        { type: result.success > 0 ? 'warning' : 'error' },
      )
    } else {
      ElMessage.success(`成功导入 ${result.success} 个商品`)
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

onMounted(() => {
  loadData()
  document.addEventListener('visibilitychange', handleVisibilityRefresh)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityRefresh)
})

onBeforeRouteUpdate((to) => {
  if (to.name === 'products') loadData()
})

function handleVisibilityRefresh() {
  if (document.visibilityState === 'visible') loadData()
}
</script>

<template>
  <PageContainer title="商品管理">
    <template #actions>
      <el-button :icon="Download" @click="handleDownloadTemplate">模版下载</el-button>
      <el-button :icon="Upload" :loading="importing" @click="triggerImport">数据导入</el-button>
      <el-button type="primary" class="btn-add" :icon="Plus" @click="openCreate">
        新增
      </el-button>
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
        placeholder="商品名称 / 货号"
        clearable
        :prefix-icon="Search"
      />
      <el-select v-model="filters.source_type" class="filter-select" placeholder="来源" clearable>
        <el-option v-for="(label, value) in PRODUCT_SOURCE_MAP" :key="value" :label="label" :value="value" />
      </el-select>
      <el-select v-model="filters.category_id" class="filter-select" placeholder="分类" clearable>
        <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-select v-model="filters.status" class="filter-select" placeholder="状态" clearable>
        <el-option v-for="(label, value) in PRODUCT_STATUS_MAP" :key="value" :label="label" :value="value" />
      </el-select>
      <el-select v-model="filters.account_id" class="filter-select" placeholder="闲鱼账号" clearable>
        <el-option v-for="item in xianyuAccounts" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-button class="filter-btn" type="primary" plain>查询</el-button>
      <el-button class="filter-btn filter-btn--ghost" @click="resetFilters">重置</el-button>
      <span v-if="total !== products.length" class="filter-hint">
        筛选 {{ total }} / 共 {{ products.length }} 条
      </span>
    </template>

    <el-table
      v-loading="loading"
      :data="paginatedData"
      class="pro-table"
      empty-text="还没有商品，点击右上角「新增」添加"
    >
      <el-table-column label="商品图片" width="88" align="center">
        <template #default="{ row }">
          <el-image
            v-if="getProductCoverImage(row)"
            :src="getProductCoverImage(row)!"
            fit="cover"
            class="thumb"
            :preview-src-list="getProductPreviewImages(row)"
            preview-teleported
          />
          <div v-else class="thumb thumb--empty">暂无图</div>
        </template>
      </el-table-column>
      <el-table-column label="货号" width="108" align="center">
        <template #default="{ row }">
          <span class="product-code">{{ row.code }}</span>
        </template>
      </el-table-column>
      <el-table-column label="商品" min-width="240">
        <template #default="{ row }">
          <div>
            <div class="product-name-row">
              <span class="product-name">{{ row.name }}</span>
              <span v-if="showNewArrivalTag(row)" class="status-tag status-tag--new_arrival">上新</span>
            </div>
            <div class="product-meta">{{ row.category?.name ?? '未分类' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="100" align="center">
        <template #default="{ row }">
          <span :class="getSourceClass((row.source_type ?? 'own') as ProductSourceType)">
            {{ PRODUCT_SOURCE_MAP[(row.source_type ?? 'own') as ProductSourceType] }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="价格" min-width="140">
        <template #default="{ row }">
          <span class="price-hint">{{ getProductPriceHint(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="SKU 数" width="88" align="center">
        <template #default="{ row }">{{ row.skus?.length ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="总库存" width="100" align="center">
        <template #default="{ row }">{{ getTotalStock(row) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <span :class="getStatusClass(row.status as ProductStatus)">
            {{ PRODUCT_STATUS_MAP[row.status as ProductStatus] }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="上架日期" width="110" align="center">
        <template #default="{ row }">
          {{ formatListedAt(row.listed_at) }}
        </template>
      </el-table-column>
      <el-table-column label="账号" width="110" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="row.account?.name ? '' : 'account-name--empty'">
            {{ row.account?.name ?? '未标记' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="闲鱼链接" min-width="120" align="center">
        <template #default="{ row }">
          <a
            v-if="row.xianyu_link"
            :href="row.xianyu_link"
            target="_blank"
            rel="noopener noreferrer"
            class="xianyu-link"
          >
            查看
          </a>
          <span v-else class="xianyu-link--empty">-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="250" fixed="right" align="center">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button class="action-btn action-btn--primary" size="small" @click="openDetail(row)">
              详情
            </el-button>
            <el-button class="action-btn action-btn--edit" size="small" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button class="action-btn action-btn--danger" size="small" @click="handleDelete(row)">
              删除
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
      v-model="detailDialogVisible"
      title="商品详情"
      width="760px"
      destroy-on-close
    >
      <template v-if="viewingProduct">
        <div v-if="getProductPreviewImages(viewingProduct).length" class="detail-images">
          <el-image
            v-for="(img, index) in getProductPreviewImages(viewingProduct)"
            :key="`detail-${img}-${index}`"
            :src="img"
            fit="cover"
            class="detail-thumb"
            :preview-src-list="getProductPreviewImages(viewingProduct)"
            :initial-index="index"
            preview-teleported
          />
        </div>
        <el-descriptions :column="2" border class="product-detail">
          <el-descriptions-item label="货号">{{ viewingProduct.code }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <span :class="getStatusClass(viewingProduct.status as ProductStatus)">
              {{ PRODUCT_STATUS_MAP[viewingProduct.status as ProductStatus] }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="商品名称" :span="2">{{ viewingProduct.name }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ viewingProduct.category?.name ?? '未分类' }}</el-descriptions-item>
          <el-descriptions-item label="来源">
            <span :class="getSourceClass((viewingProduct.source_type ?? 'own') as ProductSourceType)">
              {{ PRODUCT_SOURCE_MAP[(viewingProduct.source_type ?? 'own') as ProductSourceType] }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="闲鱼账号">
            {{ viewingProduct.account?.name ?? '未标记' }}
          </el-descriptions-item>
          <el-descriptions-item label="上架日期">{{ formatListedAt(viewingProduct.listed_at) }}</el-descriptions-item>
          <el-descriptions-item v-if="showNewArrivalTag(viewingProduct)" label="上新">
            <span class="status-tag status-tag--new_arrival">上新</span>
          </el-descriptions-item>
          <el-descriptions-item label="总库存">{{ getTotalStock(viewingProduct) }}</el-descriptions-item>
          <el-descriptions-item label="SKU 数">{{ viewingProduct.skus?.length ?? 0 }}</el-descriptions-item>
          <el-descriptions-item v-if="viewingProduct.xianyu_link" label="闲鱼链接" :span="2">
            <a
              :href="viewingProduct.xianyu_link"
              target="_blank"
              rel="noopener noreferrer"
              class="xianyu-link"
            >
              {{ viewingProduct.xianyu_link }}
            </a>
          </el-descriptions-item>
          <el-descriptions-item v-if="viewingProduct.description" label="备注" :span="2">
            {{ viewingProduct.description }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">SKU 明细</el-divider>
        <el-table :data="viewingProduct.skus ?? []" border size="small" empty-text="暂无 SKU">
          <el-table-column label="颜色" prop="color" width="100" />
          <el-table-column label="尺码" prop="size" width="100" />
          <el-table-column
            :label="(viewingProduct.source_type ?? 'own') === 'own' ? '成本' : '进价'"
            width="100"
            align="right"
          >
            <template #default="{ row }">
              {{ formatMoney(row.cost_price) }}
            </template>
          </el-table-column>
          <el-table-column label="售价" width="100" align="right">
            <template #default="{ row }">
              {{ formatMoney(row.sell_price) }}
            </template>
          </el-table-column>
          <el-table-column label="库存" prop="stock" width="80" align="center" />
          <el-table-column label="预警值" prop="low_stock_threshold" width="80" align="center" />
        </el-table>

        <template v-if="(viewingProduct.original_images ?? []).length">
          <el-divider content-position="left">原图</el-divider>
          <div class="detail-images">
            <el-image
              v-for="(img, index) in viewingProduct.original_images"
              :key="`original-${img}-${index}`"
              :src="img"
              fit="cover"
              class="detail-thumb"
              :preview-src-list="viewingProduct.original_images"
              :initial-index="index"
              preview-teleported
            />
          </div>
        </template>
      </template>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑商品' : '新增商品'"
      width="860px"
      destroy-on-close
    >
      <el-form label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="商品名称" required>
              <el-input v-model="form.name" placeholder="例如：春季碎花连衣裙" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类">
              <el-select v-model="form.category_id" clearable placeholder="选择分类" style="width: 100%">
                <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="editingId" :span="12">
            <el-form-item label="货号">
              <el-input :model-value="editingCode" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品来源" required>
              <el-radio-group v-model="form.source_type" @change="handleSourceTypeChange">
                <el-radio v-for="(label, value) in PRODUCT_SOURCE_MAP" :key="value" :value="value">
                  {{ label }}
                </el-radio>
              </el-radio-group>
              <div class="source-hint">{{ PRODUCT_SOURCE_HINT[form.source_type] }}</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="form.status" style="width: 100%">
                <el-option v-for="(label, value) in PRODUCT_STATUS_MAP" :key="value" :label="label" :value="value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="闲鱼账号">
              <el-select
                v-model="form.account_id"
                clearable
                filterable
                placeholder="选择售卖账号"
                style="width: 100%"
              >
                <el-option
                  v-for="item in xianyuAccounts"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="上新">
              <el-checkbox v-model="form.is_new_arrival" @change="handleNewArrivalChange">
                标记为上新
              </el-checkbox>
              <div v-if="form.is_new_arrival" class="source-hint">仅当天上架的商品显示上新标签</div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="闲鱼链接">
              <el-input v-model="form.xianyu_link" placeholder="https://www.goofish.com/..." />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.description" type="textarea" :rows="2" placeholder="闲鱼标题、卖点等" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-alert class="image-usage-tip" type="info" :closable="false" show-icon>
              <template #title>原图与 AI 出图可混用</template>
              背景干净、光线正常的原图可直接用作展示图上架；背景较乱时再对原图点「AI 出图」。AI 会消耗 remove.bg 额度，不必每件商品都生成。
            </el-alert>
          </el-col>
          <el-col :span="24">
            <el-form-item label="原图">
              <div class="image-section-hint">拍摄或上传的原始图片，永久保留，不会被 AI 覆盖</div>
              <div class="image-list">
                <div v-for="(img, index) in form.original_images" :key="`original-${img}`" class="image-item">
                  <el-image :src="img" fit="cover" class="preview" />
                  <div class="image-item-actions">
                    <el-dropdown trigger="click" @command="(style: ProductImageStyle) => handleAiGenerate(img, style)">
                      <el-button link type="primary" :loading="isAiGenerating(img, 'white_bg') || isAiGenerating(img, 'enhance')">
                        AI 出图
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item
                            v-for="(label, style) in PRODUCT_IMAGE_STYLE_MAP"
                            :key="style"
                            :command="style"
                            :disabled="isAiGenerating(img, style as ProductImageStyle)"
                          >
                            {{ label }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                    <el-button link type="danger" @click="removeOriginalImage(index)">删除</el-button>
                  </div>
                </div>
                <el-upload :show-file-list="false" :before-upload="handleUploadOriginal" accept="image/*">
                  <div class="upload-box">上传原图</div>
                </el-upload>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="展示图">
              <div class="image-section-hint">用于闲鱼主图/详情，可包含 AI 生成图；删除展示图不会删除原图</div>
              <div class="image-list">
                <div v-for="(img, index) in form.images" :key="`display-${img}-${index}`" class="image-item">
                  <el-image :src="img" fit="cover" class="preview" />
                  <el-tag v-if="isAiGeneratedImage(img)" class="image-tag" size="small" type="success">AI</el-tag>
                  <el-button link type="danger" class="image-delete" @click="removeDisplayImage(index)">删除</el-button>
                </div>
                <el-upload :show-file-list="false" :before-upload="handleUploadDisplay" accept="image/*">
                  <div class="upload-box">上传展示图</div>
                </el-upload>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">
          SKU（颜色 / 尺码 / {{ isOwnProduct() ? '售价' : '进价·售价' }} / 库存）
        </el-divider>

        <el-table :data="form.skus" border size="small">
          <el-table-column label="颜色" width="120">
            <template #default="{ row }"><el-input v-model="row.color" /></template>
          </el-table-column>
          <el-table-column label="尺码" width="120">
            <template #default="{ row }"><el-input v-model="row.size" /></template>
          </el-table-column>
          <el-table-column :label="isOwnProduct() ? '成本' : '进价'" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.cost_price"
                :min="0"
                :precision="2"
                :disabled="isOwnProduct()"
              />
            </template>
          </el-table-column>
          <el-table-column label="售价" width="120">
            <template #default="{ row }"><el-input-number v-model="row.sell_price" :min="0" :precision="2" /></template>
          </el-table-column>
          <el-table-column label="库存" width="100">
            <template #default="{ row }"><el-input-number v-model="row.stock" :min="0" /></template>
          </el-table-column>
          <el-table-column label="预警值" width="100">
            <template #default="{ row }"><el-input-number v-model="row.low_stock_threshold" :min="0" /></template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ $index }">
              <el-button link type="danger" @click="removeSkuRow($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-button class="add-sku-btn" @click="addSkuRow">+ 添加 SKU</el-button>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
</template>

<style scoped>
.thumb {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  flex-shrink: 0;
}

.thumb--empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #c0c4cc;
  font-size: 11px;
}

.product-name {
  font-weight: 600;
  color: #303133;
}

.product-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.product-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.product-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  color: #606266;
  letter-spacing: 0.02em;
}

.filter-hint {
  margin-left: 4px;
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.price-hint {
  font-size: 13px;
  color: #606266;
}

.xianyu-link {
  color: #409eff;
  text-decoration: none;
}

.xianyu-link:hover {
  text-decoration: underline;
}

.xianyu-link--empty {
  color: #c0c4cc;
}

.account-name--empty {
  color: #c0c4cc;
}

.source-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.image-section-hint {
  width: 100%;
  margin-bottom: 10px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.image-usage-tip {
  margin-bottom: 4px;
}

.image-item {
  position: relative;
}

.image-item-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
}

.image-tag {
  position: absolute;
  top: 6px;
  left: 6px;
}

.image-delete {
  margin-top: 4px;
}

.image-item,
.upload-box {
  width: 96px;
}

.preview,
.upload-box {
  width: 96px;
  height: 96px;
  border-radius: 8px;
}

.upload-box {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #dcdfe6;
  color: #909399;
  cursor: pointer;
}

.add-sku-btn {
  margin-top: 12px;
}

.import-input {
  display: none;
}

.detail-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.detail-thumb {
  width: 72px;
  height: 72px;
  border-radius: 8px;
}

.product-detail {
  margin-bottom: 4px;
}
</style>
