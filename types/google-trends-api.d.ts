declare module 'google-trends-api' {
  interface RealTimeOptions {
    geo: string
    hl?: string
    timezone?: number
    category?: string
  }
  interface DailyTrendsOptions {
    geo: string
    hl?: string
    timezone?: number
    trendDate?: Date
  }
  function realTimeTrends(options: RealTimeOptions): Promise<string | unknown>
  function dailyTrends(options: DailyTrendsOptions): Promise<string | unknown>
}
