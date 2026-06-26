<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showFailToast, showSuccessToast } from 'vant'
import { PRODUCT_SOURCE_MAP } from '@shared/types'
import type { ProductSourceType } from '@shared/types'
import { getTodayDateString } from '@shared/productNewArrival'
import {
  createProduct,
  fetchActiveXianyuAccounts,
  fetchCategories,
  uploadProductImage,
} from '@/services/products'
import { generateXianyuCopy } from '@/services/xianyuCopy'

const router = useRouter()
const saving = ref(false)
const generatingCopy = ref(false)
const categories = ref<Array<{ id: string; name: string }>>([])
const accounts = ref<Array<{ id: string; name: string }>>([])
const showCategoryPicker = ref(false)
const showAccountPicker = ref(false)

const form = reactive({
  name: '',
  description: '',
  sell_price: '',
  cost_price: '',
  source_type: 'own' as ProductSourceType,
  color: '均色',
  size: '均码',
  stock: '1',
  category_id: '',
  category_name: '',
  account_id: '',
  account_name: '',
  is_new_arrival: true,
  listed_at: getTodayDateString() as string | null,
  images: [] as string[],
  original_images: [] as string[],
})

const categoryColumns = computed(() =>
  categories.value.map((item) => ({ text: item.name, value: item.id })),
)
const accountColumns = computed(() =>
  accounts.value.map((item) => ({ text: item.name, value: item.id })),
)

onMounted(async () => {
  try {
    const [cats, accs] = await Promise.all([fetchCategories(), fetchActiveXianyuAccounts()])
    categories.value = cats
    accounts.value = accs
    if (cats[0]) {
      form.category_id = cats[0].id
      form.category_name = cats[0].name
    }
    if (accs[0]) {
      form.account_id = accs[0].id
      form.account_name = accs[0].name
    }
  } catch (error) {
    showFailToast(error instanceof Error ? error.message : '加载失败')
  }
})

function onCategoryConfirm({ selectedOptions }: { selectedOptions: Array<{ text: string; value: string }> }) {
  form.category_id = selectedOptions[0]?.value ?? ''
  form.category_name = selectedOptions[0]?.text ?? ''
  showCategoryPicker.value = false
}

function onAccountConfirm({ selectedOptions }: { selectedOptions: Array<{ text: string; value: string }> }) {
  form.account_id = selectedOptions[0]?.value ?? ''
  form.account_name = selectedOptions[0]?.text ?? ''
  showAccountPicker.value = false
}

async function handleAfterRead(item: { file?: File } | Array<{ file?: File }>) {
  const file = Array.isArray(item) ? item[0]?.file : item.file
  if (!file) return

  try {
    const url = await uploadProductImage(file)
    form.original_images.push(url)
    form.images.push(url)
    showSuccessToast('上传成功')
  } catch (error) {
    showFailToast(error instanceof Error ? error.message : '上传失败')
  }
}

function removeImage(index: number) {
  const url = form.images[index]
  form.images.splice(index, 1)
  const originalIndex = form.original_images.indexOf(url)
  if (originalIndex >= 0) form.original_images.splice(originalIndex, 1)
}

async function handleGenerateCopy() {
  const imageUrl = form.images[0]
  if (!imageUrl) {
    showFailToast('请先拍照或上传商品图')
    return
  }

  generatingCopy.value = true
  try {
    const result = await generateXianyuCopy({
      imageUrl,
      category: form.category_name || undefined,
      sourceType: form.source_type,
      sellPrice: Number(form.sell_price) || undefined,
      color: form.color,
      size: form.size,
    })
    form.name = result.name ?? form.name
    form.description = result.description ?? form.description
    if (result.color && (form.color === '均色' || !form.color)) {
      form.color = result.color
    }
    showSuccessToast('闲鱼文案已生成，可修改后保存')
  } catch (error) {
    showFailToast(error instanceof Error ? error.message : '生成失败')
  } finally {
    generatingCopy.value = false
  }
}

async function handleSave() {
  if (!form.name.trim()) {
    showFailToast('请填写商品名称')
    return
  }
  const sellPrice = Number(form.sell_price)
  if (!sellPrice || sellPrice <= 0) {
    showFailToast('请填写售价')
    return
  }
  if (form.source_type === 'purchase') {
    const cost = Number(form.cost_price)
    if (!cost && cost !== 0) {
      showFailToast('进货款请填写进价')
      return
    }
  }
  if (!form.account_id) {
    showFailToast('请选择闲鱼账号')
    return
  }

  saving.value = true
  try {
    await createProduct({
      category_id: form.category_id || null,
      account_id: form.account_id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      images: form.images,
      original_images: form.original_images,
      xianyu_link: null,
      status: 'active',
      source_type: form.source_type,
      is_new_arrival: form.is_new_arrival,
      listed_at: form.is_new_arrival ? form.listed_at : null,
      skus: [
        {
          color: form.color.trim() || '均色',
          size: form.size.trim() || '均码',
          cost_price: form.source_type === 'own' ? 0 : Number(form.cost_price) || 0,
          sell_price: sellPrice,
          stock: Math.max(1, Number(form.stock) || 1),
          low_stock_threshold: 2,
        },
      ],
    })
    showSuccessToast('上新成功')
    router.replace('/')
  } catch (error) {
    showFailToast(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar title="上新" left-arrow @click-left="router.back()" />

    <div class="page-body">
      <div class="section-card">
        <div class="photo-section">
          <div class="photo-list">
            <div v-for="(img, index) in form.images" :key="img" class="photo-item">
              <van-image :src="img" fit="cover" width="80" height="80" radius="8" />
              <van-icon name="cross" class="photo-remove" @click="removeImage(index)" />
            </div>
            <van-uploader :after-read="handleAfterRead" accept="image/*" capture="environment">
              <div class="photo-add">
                <van-icon name="photograph" size="24" color="#909399" />
                <span>拍照</span>
              </div>
            </van-uploader>
          </div>
          <van-button
            v-if="form.images.length > 0"
            class="ai-copy-btn"
            type="primary"
            plain
            round
            size="small"
            :loading="generatingCopy"
            @click="handleGenerateCopy"
          >
            ✨ 根据图片生成闲鱼文案
          </van-button>
        </div>
      </div>

      <div class="section-card">
        <van-cell-group inset>
          <van-field v-model="form.name" label="商品名称" placeholder="必填，可 AI 生成" required />
          <van-field
            v-model="form.description"
            label="闲鱼文案"
            type="textarea"
            rows="4"
            autosize
            placeholder="拍照后点上方按钮自动生成，也可手动填写"
          />
          <van-field v-model="form.sell_price" label="售价" type="number" placeholder="¥" required />
          <van-field
            v-if="form.source_type === 'purchase'"
            v-model="form.cost_price"
            label="进价"
            type="number"
            placeholder="进货成本"
            required
          />
          <van-cell title="来源">
            <template #value>
              <van-radio-group v-model="form.source_type" direction="horizontal">
                <van-radio v-for="(label, value) in PRODUCT_SOURCE_MAP" :key="value" :name="value">
                  {{ label }}
                </van-radio>
              </van-radio-group>
            </template>
          </van-cell>
          <van-field v-model="form.color" label="颜色" placeholder="默认均色" />
          <van-field v-model="form.size" label="尺码" placeholder="默认均码" />
          <van-field v-model="form.stock" label="库存" type="digit" placeholder="默认 1" />
          <van-cell title="分类" :value="form.category_name || '请选择'" is-link @click="showCategoryPicker = true" />
          <van-cell title="闲鱼账号" :value="form.account_name || '请选择'" is-link required @click="showAccountPicker = true" />
          <van-cell title="标记上新">
            <template #value>
              <van-switch
                v-model="form.is_new_arrival"
                size="20"
                @change="(checked: boolean) => {
                  form.listed_at = checked ? getTodayDateString() : null
                }"
              />
            </template>
          </van-cell>
          <van-cell v-if="form.is_new_arrival" title="说明" value="仅当天上架显示上新标签" />
        </van-cell-group>
      </div>
    </div>

    <div class="fixed-bottom-spacer" />
    <div class="fixed-bottom">
      <van-button type="primary" block round :loading="saving" @click="handleSave">
        保存到商品管理
      </van-button>
    </div>

    <van-popup v-model:show="showCategoryPicker" position="bottom" round>
      <van-picker :columns="categoryColumns" @confirm="onCategoryConfirm" @cancel="showCategoryPicker = false" />
    </van-popup>
    <van-popup v-model:show="showAccountPicker" position="bottom" round>
      <van-picker :columns="accountColumns" @confirm="onAccountConfirm" @cancel="showAccountPicker = false" />
    </van-popup>
  </div>
</template>

<style scoped>
.photo-section {
  padding: 16px;
}

.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.photo-item {
  position: relative;
}

.photo-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  padding: 2px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 12px;
}

.photo-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  color: #909399;
  font-size: 12px;
  gap: 4px;
}

.ai-copy-btn {
  margin-top: 12px;
}
</style>
