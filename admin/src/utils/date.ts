import dayjs, { type Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

export type DatePreset = 'all_time' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'

export interface DateRange {
  start: Dayjs
  end: Dayjs
  label: string
}

export function getDateRange(preset: DatePreset, customRange?: [string, string]): DateRange {
  const now = dayjs()

  switch (preset) {
    case 'all_time':
      return {
        start: now.startOf('day'),
        end: now.endOf('day'),
        label: '全部日期',
      }
    case 'this_week':
      return {
        start: now.startOf('isoWeek'),
        end: now.endOf('isoWeek'),
        label: '本周',
      }
    case 'last_week': {
      const base = now.subtract(1, 'week')
      return {
        start: base.startOf('isoWeek'),
        end: base.endOf('isoWeek'),
        label: '上周',
      }
    }
    case 'this_month':
      return {
        start: now.startOf('month'),
        end: now.endOf('month'),
        label: '本月',
      }
    case 'last_month': {
      const base = now.subtract(1, 'month')
      return {
        start: base.startOf('month'),
        end: base.endOf('month'),
        label: '上月',
      }
    }
    case 'custom': {
      const start = dayjs(customRange?.[0])
      const end = dayjs(customRange?.[1])
      return {
        start,
        end,
        label: `${start.format('MM-DD')} ~ ${end.format('MM-DD')}`,
      }
    }
  }
}

export function isAllTimePreset(preset: DatePreset) {
  return preset === 'all_time'
}

export function formatRangeQuery(range: DateRange) {
  return {
    startDate: range.start.format('YYYY-MM-DD'),
    endDate: range.end.format('YYYY-MM-DD'),
  }
}

/** 生成范围内每一天，用于补全图表空数据 */
export function eachDayInRange(range: DateRange): string[] {
  const days: string[] = []
  let cursor = range.start.startOf('day')
  const end = range.end.startOf('day')

  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    days.push(cursor.format('YYYY-MM-DD'))
    cursor = cursor.add(1, 'day')
  }

  return days
}

export function formatChartLabel(date: string, preset: DatePreset) {
  const d = dayjs(date)
  if (preset === 'this_week' || preset === 'last_week') {
    const weekLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    return weekLabels[d.isoWeekday() - 1]
  }
  return d.format('MM-DD')
}
