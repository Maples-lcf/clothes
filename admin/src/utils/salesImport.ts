import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import type { ProductSku, SalesChannel, SaleOrderStatus } from '@shared/types'
import { SALES_CHANNEL_MAP, SALE_ORDER_STATUS_MAP } from '@shared/types'
import type { SaleFormData } from '@/services/sales'
import { calcXianyuFee } from '@/utils/money'

const TEMPLATE_HEADERS = [
  '商品名称*',
  '颜色*',
  '尺码*',
  '渠道*',
  '成交账号',
  '下单日期*',
  '订单状态',
  '数量*',
  '成交额*',
  '单件进价',
  '平台服务费',
  '运费',
  '其他费用',
  '备注',
] as const

const ORDER_STATUS_LABEL_MAP: Record<string, SaleOrderStatus> = Object.fromEntries(
  Object.entries(SALE_ORDER_STATUS_MAP).map(([value, label]) => [label, value as SaleOrderStatus]),
)

const CHANNEL_LABEL_MAP: Record<string, SalesChannel> = Object.fromEntries(
  Object.entries(SALES_CHANNEL_MAP).map(([value, label]) => [label, value as SalesChannel]),
)

export interface ParsedImportRow {
  row: number
  data?: SaleFormData
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

function parseRequiredNumber(value: unknown, field: string): number {
  const num = parseNumber(value, field)
  if (num === null) throw new Error(`${field} 不能为空`)
  return num
}

function parseDate(value: unknown): string {
  const text = normalizeText(value)
  if (!text) throw new Error('下单日期不能为空')

  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const parsed = XLSX.SSF.parse_date_code(Number(text))
    if (parsed) {
      return dayjs(`${parsed.y}-${parsed.m}-${parsed.d}`).format('YYYY-MM-DD')
    }
  }

  const date = dayjs(text)
  if (!date.isValid()) throw new Error('下单日期格式不正确，请使用 YYYY-MM-DD')
  return date.format('YYYY-MM-DD')
}

function parseOrderStatus(value: unknown): SaleOrderStatus {
  const text = normalizeText(value)
  if (!text || text === '成功') return 'success'
  const status = ORDER_STATUS_LABEL_MAP[text]
  if (!status) throw new Error(`订单状态「${text}」无效，请填写：成功/有退款`)
  return status
}

function findSku(skus: ProductSku[], name: string, color: string, size: string) {
  const normalizedName = name.toLowerCase()
  const normalizedColor = color.toLowerCase()
  const normalizedSize = size.toLowerCase()

  return skus.find((sku) => {
    const productName = sku.product?.name?.toLowerCase() ?? ''
    return (
      productName === normalizedName &&
      sku.color.toLowerCase() === normalizedColor &&
      sku.size.toLowerCase() === normalizedSize
    )
  })
}

function isExampleRow(name: string): boolean {
  return name === '示例连衣裙' || name.startsWith('示例')
}

export function downloadSalesTemplate(
  skus: ProductSku[],
  accounts: Array<{ name: string }>,
) {
  const exampleAccount = accounts[0]?.name ?? '请填写闲鱼账号名'
  const templateData: (string | number)[][] = [
    [...TEMPLATE_HEADERS],
    ['示例连衣裙', '黑色', 'M', '闲鱼', exampleAccount, dayjs().format('YYYY-MM-DD'), '成功', 1, 99, '', '', 0, 0, '买家昵称等备注'],
  ]

  const skuRefData = [
    ['商品名称', '颜色', '尺码', '当前库存', '售价', '进价'],
    ...skus.map((sku) => [
      sku.product?.name ?? '',
      sku.color,
      sku.size,
      sku.stock,
      sku.sell_price,
      sku.product?.source_type === 'own' ? 0 : sku.cost_price,
    ]),
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(templateData)
  ws['!cols'] = [
    { wch: 16 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
    { wch: 10 },
    { wch: 20 },
  ]

  const wsRef = XLSX.utils.aoa_to_sheet(skuRefData)
  wsRef['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]

  XLSX.utils.book_append_sheet(wb, ws, '销售记录')
  XLSX.utils.book_append_sheet(wb, wsRef, 'SKU参考')
  XLSX.writeFile(wb, '销售记录导入模板.xlsx')
}

export function parseSalesImportFile(
  buffer: ArrayBuffer,
  skus: ProductSku[],
  accounts: Array<{ id: string; name: string; platform: SalesChannel }>,
): ParsedImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames.find((name) => name === '销售记录') ?? workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return [{ row: 1, error: 'Excel 文件中没有可读取的工作表' }]

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (rows.length === 0) return [{ row: 2, error: '文件中没有数据行' }]

  const results: ParsedImportRow[] = []

  rows.forEach((row, index) => {
    const rowNum = index + 2
    const name = normalizeText(row['商品名称*'] ?? row['商品名称'])
    const color = normalizeText(row['颜色*'] ?? row['颜色'])
    const size = normalizeText(row['尺码*'] ?? row['尺码'])

    if (!name && !color && !size) return
    if (isExampleRow(name)) return

    try {
      if (!name) throw new Error('商品名称不能为空')
      if (!color) throw new Error('颜色不能为空')
      if (!size) throw new Error('尺码不能为空')

      const sku = findSku(skus, name, color, size)
      if (!sku) throw new Error(`未找到 SKU：${name} / ${color} / ${size}`)

      const channelLabel = normalizeText(row['渠道*'] ?? row['渠道'])
      if (!channelLabel) throw new Error('渠道不能为空')
      const channel = CHANNEL_LABEL_MAP[channelLabel]
      if (!channel) throw new Error(`渠道「${channelLabel}」无效，请填写：闲鱼/微信/抖音/其他`)

      const accountName = normalizeText(row['成交账号'])
      let accountId: string | null = null
      if (channel === 'xianyu') {
        if (!accountName) throw new Error('闲鱼渠道必须填写成交账号')
        const account = accounts.find(
          (item) => item.platform === 'xianyu' && item.name === accountName,
        )
        if (!account) throw new Error(`未找到闲鱼账号「${accountName}」`)
        accountId = account.id
      }

      const soldAt = parseDate(row['下单日期*'] ?? row['下单日期'] ?? row['成交日期*'] ?? row['成交日期'])
      const orderStatus = parseOrderStatus(row['订单状态'])
      const quantity = parseRequiredNumber(row['数量*'] ?? row['数量'], '数量')
      if (quantity <= 0) throw new Error('数量必须大于 0')

      const saleAmount = parseRequiredNumber(row['成交额*'] ?? row['成交额'], '成交额')
      if (saleAmount <= 0) throw new Error('成交额必须大于 0')

      const unitCostRaw = parseNumber(row['单件进价'], '单件进价')
      const unitCost =
        unitCostRaw !== null
          ? unitCostRaw
          : sku.product?.source_type === 'own'
            ? 0
            : Number(sku.cost_price)

      const platformFeeRaw = parseNumber(row['平台服务费'], '平台服务费')
      const platformFee =
        platformFeeRaw !== null
          ? platformFeeRaw
          : channel === 'xianyu'
            ? calcXianyuFee(saleAmount)
            : 0

      const shippingFee = parseNumber(row['运费'], '运费') ?? 0
      const otherFee = parseNumber(row['其他费用'], '其他费用') ?? 0
      const note = normalizeText(row['备注']) || null

      results.push({
        row: rowNum,
        data: {
          sku_id: sku.id,
          channel,
          account_id: accountId,
          quantity,
          sale_amount: saleAmount,
          unit_cost: unitCost,
          platform_fee: platformFee,
          shipping_fee: shippingFee,
          other_fee: otherFee,
          sold_at: soldAt,
          note,
          order_status: orderStatus,
        },
      })
    } catch (error) {
      results.push({
        row: rowNum,
        error: error instanceof Error ? error.message : '解析失败',
      })
    }
  })

  if (results.length === 0) {
    return [{ row: 2, error: '没有可导入的数据行（请删除示例行后填写真实数据）' }]
  }

  return results
}
