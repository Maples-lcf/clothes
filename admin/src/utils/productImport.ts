import * as XLSX from 'xlsx'
import type { Category, ProductSourceType, ProductStatus } from '@shared/types'
import { PRODUCT_SOURCE_MAP, PRODUCT_STATUS_MAP } from '@shared/types'
import type { ProductFormData } from '@/services/products'

const TEMPLATE_HEADERS = [
  '商品名称*',
  '分类',
  '商品来源*',
  '状态',
  '备注',
  '闲鱼链接',
  '图片URL',
  '颜色',
  '尺码',
  '进价',
  '售价',
  '库存',
  '预警值',
] as const

const SOURCE_LABEL_MAP: Record<string, ProductSourceType> = Object.fromEntries(
  Object.entries(PRODUCT_SOURCE_MAP).map(([value, label]) => [label, value as ProductSourceType]),
)

const STATUS_LABEL_MAP: Record<string, ProductStatus> = Object.fromEntries(
  Object.entries(PRODUCT_STATUS_MAP).map(([value, label]) => [label, value as ProductStatus]),
)

export interface ParsedProductRow {
  row: number
  name: string
  categoryName: string
  sourceType: ProductSourceType
  status: ProductStatus
  description: string | null
  xianyuLink: string | null
  images: string[]
  sku: ProductFormData['skus'][number]
  error?: string
}

export interface ProductImportBatch {
  rows: number[]
  data?: ProductFormData
  error?: string
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function parseNumber(value: unknown, field: string): number | null {
  const text = normalizeText(value)
  if (!text) return null
  const num = Number(text)
  if (Number.isNaN(num)) throw new Error(`${field} 必须是数字`)
  return num
}

function parseImages(value: unknown): string[] {
  const text = normalizeText(value)
  if (!text) return []
  return text
    .split(/[,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function isExampleRow(name: string): boolean {
  return name === '示例连衣裙' || name.startsWith('示例')
}

function productKey(name: string): string {
  return name.toLowerCase()
}

export function downloadProductTemplate(categories: Category[]) {
  const exampleCategory = categories[0]?.name ?? '上衣'
  const templateData: (string | number)[][] = [
    [...TEMPLATE_HEADERS],
    [
      '示例连衣裙',
      exampleCategory,
      '自有闲置',
      '在售',
      '闲鱼标题、卖点等',
      '',
      '',
      '黑色',
      'M',
      0,
      99,
      1,
      2,
    ],
  ]

  const categoryRefData = [
    ['分类名称'],
    ...categories.map((item) => [item.name]),
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(templateData)
  ws['!cols'] = [
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    { wch: 20 },
    { wch: 28 },
    { wch: 28 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
  ]

  const wsRef = XLSX.utils.aoa_to_sheet(categoryRefData)
  wsRef['!cols'] = [{ wch: 16 }]

  XLSX.utils.book_append_sheet(wb, ws, '商品数据')
  XLSX.utils.book_append_sheet(wb, wsRef, '分类参考')
  XLSX.writeFile(wb, '商品导入模板.xlsx')
}

export function parseProductImportFile(buffer: ArrayBuffer): ParsedProductRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames.find((name) => name === '商品数据') ?? workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return [{ row: 1, name: '', categoryName: '', sourceType: 'own', status: 'active', description: null, xianyuLink: null, images: [], sku: createEmptySku(), error: 'Excel 文件中没有可读取的工作表' }]

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (rows.length === 0) {
    return [{
      row: 2,
      name: '',
      categoryName: '',
      sourceType: 'own',
      status: 'active',
      description: null,
      xianyuLink: null,
      images: [],
      sku: createEmptySku(),
      error: '文件中没有数据行',
    }]
  }

  const results: ParsedProductRow[] = []

  rows.forEach((row, index) => {
    const rowNum = index + 2
    const name = normalizeText(row['商品名称*'] ?? row['商品名称'])

    if (!name) return
    if (isExampleRow(name)) return

    const base = {
      row: rowNum,
      name,
      categoryName: normalizeText(row['分类']),
      sourceType: 'own' as ProductSourceType,
      status: 'active' as ProductStatus,
      description: normalizeText(row['备注']) || null,
      xianyuLink: normalizeText(row['闲鱼链接']) || null,
      images: parseImages(row['图片URL']),
      sku: createEmptySku(),
    }

    try {
      const sourceLabel = normalizeText(row['商品来源*'] ?? row['商品来源'])
      if (!sourceLabel) throw new Error('商品来源不能为空')
      const sourceType = SOURCE_LABEL_MAP[sourceLabel]
      if (!sourceType) throw new Error(`商品来源「${sourceLabel}」无效，请填写：自有闲置/进货`)

      const statusLabel = normalizeText(row['状态'])
      const status = statusLabel ? STATUS_LABEL_MAP[statusLabel] : 'active'
      if (statusLabel && !status) {
        throw new Error(`状态「${statusLabel}」无效，请填写：在售/主动下架/售出下架`)
      }

      const color = normalizeText(row['颜色*'] ?? row['颜色']) || '均色'
      const size = normalizeText(row['尺码*'] ?? row['尺码']) || '均码'

      const stock = parseNumber(row['库存*'] ?? row['库存'], '库存') ?? 1
      if (stock < 0) throw new Error('库存不能小于 0')

      const sellPrice = parseNumber(row['售价'], '售价') ?? 0
      const costPriceRaw = parseNumber(row['进价'], '进价')
      const costPrice = sourceType === 'own' ? 0 : (costPriceRaw ?? 0)

      const lowStockThreshold = parseNumber(row['预警值'], '预警值') ?? 2

      results.push({
        ...base,
        sourceType,
        status,
        sku: {
          color,
          size,
          cost_price: costPrice,
          sell_price: sellPrice,
          stock,
          low_stock_threshold: lowStockThreshold,
        },
      })
    } catch (error) {
      results.push({
        ...base,
        error: error instanceof Error ? error.message : '解析失败',
      })
    }
  })

  if (results.length === 0) {
    return [{
      row: 2,
      name: '',
      categoryName: '',
      sourceType: 'own',
      status: 'active',
      description: null,
      xianyuLink: null,
      images: [],
      sku: createEmptySku(),
      error: '没有可导入的数据行（请删除示例行后填写真实数据）',
    }]
  }

  return results
}

export function buildProductImportBatches(
  rows: ParsedProductRow[],
  categories: Category[],
): ProductImportBatch[] {
  const batches = new Map<string, ProductImportBatch>()

  for (const row of rows) {
    if (row.error) {
      return [{ rows: [row.row], error: `第 ${row.row} 行：${row.error}` }]
    }

    const key = productKey(row.name)
    const existing = batches.get(key)

    if (!existing) {
      const categoryId = row.categoryName
        ? categories.find((item) => item.name === row.categoryName)?.id ?? null
        : null

      if (row.categoryName && !categoryId) {
        return [{ rows: [row.row], error: `第 ${row.row} 行：未找到分类「${row.categoryName}」` }]
      }

      batches.set(key, {
        rows: [row.row],
        data: {
          category_id: categoryId,
          account_id: null,
          name: row.name,
          description: row.description,
          xianyu_link: row.xianyuLink,
          images: [...row.images],
          original_images: [...row.images],
          status: row.status,
          source_type: row.sourceType,
          is_new_arrival: false,
          listed_at: null,
          skus: [{ ...row.sku }],
        },
      })
      continue
    }

    if (!existing.data) continue

    const conflict = validateProductRowConsistency(existing.data, row)
    if (conflict) {
      return [{ rows: [...existing.rows, row.row], error: `第 ${row.row} 行：${conflict}` }]
    }

    const duplicateSku = existing.data.skus.some(
      (sku) => sku.color === row.sku.color && sku.size === row.sku.size,
    )
    if (duplicateSku) {
      return [{
        rows: [...existing.rows, row.row],
        error: `第 ${row.row} 行：SKU「${row.sku.color}/${row.sku.size}」与前面行重复`,
      }]
    }

    existing.rows.push(row.row)
    existing.data.skus.push({ ...row.sku })
    if (row.images.length > 0) {
      existing.data.images = [...new Set([...existing.data.images, ...row.images])]
      existing.data.original_images = [...new Set([...existing.data.original_images, ...row.images])]
    }
  }

  return [...batches.values()]
}

function validateProductRowConsistency(data: ProductFormData, row: ParsedProductRow): string | null {
  if (data.source_type !== row.sourceType) {
    return '商品来源与同商品的其他行不一致'
  }
  if (data.status !== row.status) {
    return '状态与同商品的其他行不一致'
  }
  if ((data.description ?? '') !== (row.description ?? '')) {
    return '备注与同商品的其他行不一致'
  }
  if ((data.xianyu_link ?? '') !== (row.xianyuLink ?? '')) {
    return '闲鱼链接与同商品的其他行不一致'
  }
  return null
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
