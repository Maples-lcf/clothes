<script setup lang="ts">
import { reactive, ref } from 'vue'
import { getTodayDateString } from '@shared/productNewArrival'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { RefreshRight } from '@element-plus/icons-vue'
import PageContainer from '@/components/PageContainer.vue'
import { fetchCategories } from '@/services/categories'
import { createProduct, uploadProductImage, type ProductFormData } from '@/services/products'
import { fetchActiveXianyuAccounts } from '@/services/accounts'
import { createSale } from '@/services/sales'
import { fetchXianyuProductInfo, type XianyuProductInfo } from '@/services/xianyu'
import { getServiceErrorMessage } from '@/utils/error'
import { calcXianyuFee } from '@/utils/money'
import { parseXianyuShareText, extractXianyuFetchUrl, type XianyuShareParseResult } from '@shared/xianyu'
import { PRODUCT_SOURCE_HINT, PRODUCT_SOURCE_MAP } from '@shared/types'
import type { ProductStatus } from '@shared/types'

const XIANYU_STATUS_OPTIONS: Array<{ value: ProductStatus; label: string }> = [
  { value: 'active', label: '在售' },
  { value: 'inactive', label: '主动下架' },
  { value: 'sold_out', label: '售出下架' },
]

const parsing = ref(false)
const saving = ref(false)
const parsed = ref(false)
const linkInput = ref('')
const imageUrlInput = ref('')

const form = reactive({
  xianyu_link: '',
  name: '',
  price: 0,
  cost_price: 0,
  description: '',
  images: [] as string[],
  original_images: [] as string[],
  source_type: 'own' as ProductFormData['source_type'],
  status: 'active' as ProductStatus,
  shipping_fee: 0,
  category_id: null as string | null,
  account_id: null as string | null,
  is_new_arrival: true,
  listed_at: getTodayDateString() as string | null,
})

const categories = ref<Array<{ id: string; name: string }>>([])
const xianyuAccounts = ref<Array<{ id: string; name: string }>>([])

async function loadCategories() {
  try {
    const [categoryList, accounts] = await Promise.all([fetchCategories(), fetchActiveXianyuAccounts()])
    categories.value = categoryList
    xianyuAccounts.value = accounts
    if (!form.category_id) {
      form.category_id = categories.value[0]?.id ?? null
    }
    if (!form.account_id) {
      form.account_id = xianyuAccounts.value[0]?.id ?? null
    }
  } catch (error) {
    ElMessage.error(getServiceErrorMessage(error, '加载分类失败'))
  }
}

function applyParsedData(data: XianyuProductInfo, share?: XianyuShareParseResult) {
  form.xianyu_link = data.xianyu_link || share?.url || ''
  form.name = share?.name || data.name
  form.price = data.price
  form.description = data.description || share?.description || ''
  form.images = [...data.images]
  form.original_images = [...data.images]
  parsed.value = true
}

function applyShareFallback(share: XianyuShareParseResult, fallbackLink: string) {
  form.xianyu_link = share.url ?? fallbackLink
  form.name = share.name
  form.description = share.description
  form.price = 0
  form.images = []
  form.original_images = []
  parsed.value = true
}

function resetForm() {
  parsed.value = false
  form.xianyu_link = linkInput.value.trim()
  form.name = ''
  form.price = 0
  form.cost_price = 0
  form.description = ''
  form.images = []
  form.original_images = []
  form.status = 'active'
  form.shipping_fee = 0
}

function handleSourceTypeChange() {
  if (form.source_type === 'own') {
    form.cost_price = 0
  }
}

function handleStatusChange() {
  if (form.status !== 'sold_out') {
    form.shipping_fee = 0
  }
}

async function handleParse() {
  const raw = linkInput.value.trim()
  if (!raw) {
    ElMessage.warning('请先粘贴闲鱼分享文案或链接')
    return
  }

  const share = parseXianyuShareText(raw)
  const fetchUrl = extractXianyuFetchUrl(raw)

  if (!share.url && !fetchUrl.match(/^https?:\/\//i)) {
    ElMessage.warning('未识别到有效链接，请检查分享文案是否完整')
    return
  }

  parsing.value = true
  try {
    const data = await fetchXianyuProductInfo(fetchUrl)
    applyParsedData(data, share)
    ElMessage.success('商品信息已获取，可继续修改后保存')
  } catch (error) {
    resetForm()
    applyShareFallback(share, fetchUrl)
    ElMessage.warning(
      `${getServiceErrorMessage(error, '接口解析失败')}。已从分享文案提取商品名称等信息，请补充售价和图片。`,
    )
  } finally {
    parsing.value = false
  }
}

function addImageUrl() {
  const url = imageUrlInput.value.trim()
  if (!url) return
  if (!form.images.includes(url)) {
    form.images.push(url)
  }
  imageUrlInput.value = ''
}

function removeImage(index: number) {
  form.images.splice(index, 1)
}

async function handleUpload(file: File) {
  try {
    const url = await uploadProductImage(file)
    form.images.push(url)
    ElMessage.success('图片上传成功')
  } catch (error) {
    ElMessage.error(getServiceErrorMessage(error, '图片上传失败'))
  }
}

function validateForm(): string | null {
  if (!form.xianyu_link.trim()) return '请填写闲鱼链接'
  if (!form.name.trim()) return '请填写商品名称'
  if (form.price <= 0) return '请填写商品售价'
  if (form.source_type === 'purchase' && form.cost_price <= 0) return '请填写进货价'
  if (form.status === 'sold_out' && xianyuAccounts.value.length === 0) {
    return '售出下架需记录销售，请先在闲鱼账号页面添加成交账号'
  }
  return null
}

async function handleSave() {
  const validationError = validateForm()
  if (validationError) {
    ElMessage.warning(validationError)
    return
  }

  saving.value = true
  try {
    const payload: ProductFormData = {
      category_id: form.category_id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      images: form.images,
      original_images: form.images,
      xianyu_link: form.xianyu_link.trim(),
      account_id: form.account_id,
      status: form.status,
      source_type: form.source_type,
      is_new_arrival: form.is_new_arrival,
      listed_at: form.is_new_arrival ? form.listed_at : null,
      skus: [
        {
          color: '均色',
          size: '均码',
          cost_price: form.source_type === 'own' ? 0 : form.cost_price,
          sell_price: form.price,
          stock: 1,
          low_stock_threshold: 2,
        },
      ],
    }

    const product = await createProduct(payload)

    if (form.status === 'sold_out') {
      const skuId = product.skus?.[0]?.id
      if (!skuId) throw new Error('未找到商品 SKU')

      await createSale({
        sku_id: skuId,
        channel: 'xianyu',
        account_id: form.account_id ?? xianyuAccounts.value[0]?.id ?? null,
        quantity: 1,
        sale_amount: form.price,
        unit_cost: form.source_type === 'own' ? 0 : form.cost_price,
        platform_fee: calcXianyuFee(form.price),
        shipping_fee: form.shipping_fee,
        other_fee: 0,
        sold_at: dayjs().format('YYYY-MM-DD'),
        note: form.xianyu_link.trim() || null,
        order_status: 'success',
      })
    }

    ElMessage.success(form.status === 'sold_out' ? '已保存商品并记录销售' : '已保存到商品管理')
    linkInput.value = ''
    resetForm()
  } catch (error) {
    ElMessage.error(getServiceErrorMessage(error, '保存失败'))
  } finally {
    saving.value = false
  }
}

loadCategories()
</script>

<template>
  <PageContainer title="闲鱼导入">
    <div class="import-panel">
      <div class="panel-section">
        <div class="section-title">1. 粘贴闲鱼分享文案</div>
        <div class="paste-block">
          <el-input
            v-model="linkInput"
            type="textarea"
            :rows="5"
            placeholder="直接粘贴微信里的闲鱼分享，例如：&#10;【闲鱼】https://m.tb.cn/h.xxxxx?tk=xxx&#10;HU108 「我在闲鱼发布了【Vintage复古花纹背带裙】棕色提花面料，花纹很有特色，」&#10;点击链接直接打开"
          />
          <el-button type="primary" :loading="parsing" @click="handleParse">获取商品信息</el-button>
        </div>
        <p class="hint">
          支持 m.tb.cn 短链、goofish.com 链接，以及「我在闲鱼发布了【商品名】…」分享格式。接口限流时会先从文案提取名称和描述。
        </p>
      </div>

      <div v-if="parsed" class="panel-section">
        <div class="section-title">2. 确认并修改商品信息</div>

        <el-form label-width="96px" class="edit-form">
          <el-form-item label="闲鱼链接" required>
            <el-input v-model="form.xianyu_link" placeholder="https://www.goofish.com/item?id=..." />
          </el-form-item>

          <el-form-item label="商品名称" required>
            <el-input v-model="form.name" placeholder="闲鱼商品标题" />
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="商品售价" required>
                <el-input-number v-model="form.price" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col v-if="form.source_type === 'purchase'" :span="12">
              <el-form-item label="进货价" required>
                <el-input-number v-model="form.cost_price" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="form.source_type === 'purchase' ? 24 : 12">
              <el-form-item label="商品来源">
                <el-radio-group v-model="form.source_type" @change="handleSourceTypeChange">
                  <el-radio v-for="(label, value) in PRODUCT_SOURCE_MAP" :key="value" :value="value">
                    {{ label }}
                  </el-radio>
                </el-radio-group>
                <div class="source-hint">{{ PRODUCT_SOURCE_HINT[form.source_type] }}</div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="闲鱼账号" required>
                <el-select v-model="form.account_id" filterable placeholder="选择闲鱼号" style="width: 100%">
                  <el-option v-for="item in xianyuAccounts" :key="item.id" :label="item.name" :value="item.id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="分类">
                <el-select v-model="form.category_id" clearable placeholder="选择分类" style="width: 100%">
                  <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="商品状态">
                <el-radio-group v-model="form.status" @change="handleStatusChange">
                  <el-radio v-for="item in XIANYU_STATUS_OPTIONS" :key="item.value" :value="item.value">
                    {{ item.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="上新">
                <el-checkbox
                  v-model="form.is_new_arrival"
                  @change="(checked: boolean) => {
                    form.listed_at = checked ? getTodayDateString() : null
                  }"
                >
                  标记为上新
                </el-checkbox>
                <div v-if="form.is_new_arrival" class="source-hint">仅当天上架的商品显示上新标签</div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row v-if="form.status === 'sold_out'" :gutter="16">
            <el-col :span="12">
              <el-form-item label="运费" required>
                <el-input-number v-model="form.shipping_fee" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="闲鱼文案">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="6"
              placeholder="商品描述、卖点、尺码说明等"
            />
          </el-form-item>

          <el-form-item label="商品图片">
            <div class="image-tools">
              <el-input v-model="imageUrlInput" placeholder="粘贴图片 URL 后回车或点添加">
                <template #append>
                  <el-button @click="addImageUrl">添加</el-button>
                </template>
              </el-input>
            </div>
            <div class="image-list">
              <div v-for="(img, index) in form.images" :key="`${img}-${index}`" class="image-item">
                <el-image :src="img" fit="cover" class="preview" />
                <el-button link type="danger" @click="removeImage(index)">删除</el-button>
              </div>
              <el-upload :show-file-list="false" :before-upload="handleUpload" accept="image/*">
                <div class="upload-box">上传图片</div>
              </el-upload>
            </div>
          </el-form-item>
        </el-form>

        <div class="actions">
          <el-button :icon="RefreshRight" @click="handleParse">重新解析</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">保存到商品管理</el-button>
        </div>
      </div>
    </div>
  </PageContainer>
</template>

<style scoped>
.import-panel {
  max-width: 920px;
}

.panel-section + .panel-section {
  margin-top: 28px;
  padding-top: 28px;
  border-top: 1px solid #ebeef5;
}

.section-title {
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.paste-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.paste-block .el-button {
  align-self: flex-start;
}

.hint,
.source-hint {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #909399;
}

.edit-form {
  margin-top: 8px;
}

.image-tools {
  width: 100%;
  margin-bottom: 12px;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
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
  color: #909399;
  cursor: pointer;
  border: 1px dashed #dcdfe6;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>
