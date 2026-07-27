import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Card, Row, Col, Select, DatePicker, Switch, Table,
  Typography, Space, Statistic, Segmented, Spin,
} from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getStatsOverview, getStatsDaily, getStatsByClient, getClients } from '../api/client'

dayjs.extend(isoWeek)

const { Text } = Typography
const { RangePicker } = DatePicker

const PRIMARY = '#8753A8'
const COMPARE_COLOR = '#aaa'

// ── Date helpers ──────────────────────────────────────────────────────────────

function getRange(period, custom) {
  const t = dayjs()
  if (period === 'week')  return [t.startOf('isoWeek'), t.endOf('isoWeek')]
  if (period === 'month') return [t.startOf('month'), t.endOf('month')]
  if (period === 'year')  return [t.startOf('year'), t.endOf('year')]
  return custom
}

function getPrevRange(period, [from, to]) {
  if (period === 'week') return [from.subtract(1, 'week'), to.subtract(1, 'week')]
  if (period === 'month') {
    const prev = from.subtract(1, 'month')
    return [prev.startOf('month'), prev.endOf('month')]
  }
  if (period === 'year') return [from.subtract(1, 'year'), to.subtract(1, 'year')]
  const days = to.diff(from, 'day') + 1
  return [from.subtract(days, 'day'), to.subtract(days, 'day')]
}

function prevLabel(period) {
  if (period === 'week')  return 'Previous week'
  if (period === 'month') return 'Previous month'
  if (period === 'year')  return 'Previous year'
  return 'Previous period'
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function getGranularity(dateFrom, dateTo) {
  const days = dayjs(dateTo).diff(dayjs(dateFrom), 'day')
  if (days <= 60)  return 'day'
  if (days <= 180) return 'week'
  return 'month'
}

function fillDates(rows, dateFrom, dateTo) {
  const map = {}
  rows.forEach(r => { map[r.day] = r })
  const result = []
  let d = dayjs(dateFrom)
  const end = dayjs(dateTo)
  while (!d.isAfter(end, 'day')) {
    const key = d.format('YYYY-MM-DD')
    result.push(map[key] ?? { day: key, instruction_count: 0, total_client_fee: 0, total_surveyor_fee: 0, margin: 0 })
    d = d.add(1, 'day')
  }
  return result
}

function aggregate(rows, granularity) {
  if (granularity === 'day') return rows
  const buckets = {}
  for (const r of rows) {
    const key = granularity === 'week'
      ? dayjs(r.day).startOf('isoWeek').format('YYYY-MM-DD')
      : dayjs(r.day).startOf('month').format('YYYY-MM-DD')
    if (!buckets[key]) buckets[key] = { day: key, instruction_count: 0, total_client_fee: 0, total_surveyor_fee: 0, margin: 0 }
    buckets[key].instruction_count  += r.instruction_count
    buckets[key].total_client_fee   += r.total_client_fee
    buckets[key].total_surveyor_fee += r.total_surveyor_fee
    buckets[key].margin             += r.margin
  }
  return Object.values(buckets).sort((a, b) => a.day.localeCompare(b.day))
}

function formatTick(day, granularity) {
  if (granularity === 'month') return dayjs(day).format("MMM 'YY")
  return dayjs(day).format('D MMM')
}

// ── Change badge ──────────────────────────────────────────────────────────────

function ChangeBadge({ current, prev }) {
  if (prev == null) return null
  if (prev === 0 && current === 0) return <Text type="secondary" style={{ fontSize: 12 }}><MinusOutlined /></Text>
  if (prev === 0) return <Text type="success" style={{ fontSize: 12 }}><ArrowUpOutlined /> New</Text>
  const p = ((current - prev) / Math.abs(prev)) * 100
  if (Math.abs(p) < 0.5) return <Text type="secondary" style={{ fontSize: 12 }}><MinusOutlined /> 0%</Text>
  const up = p > 0
  return (
    <Text type={up ? 'success' : 'danger'} style={{ fontSize: 12 }}>
      {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(p).toFixed(1)}%
    </Text>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Stats() {
  const [period, setPeriod] = useState('month')
  const [customRange, setCustomRange] = useState([dayjs().startOf('month'), dayjs()])
  const [compare, setCompare] = useState(false)
  const [clientIds, setClientIds] = useState([])
  const [metric, setMetric] = useState('margin')
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState([])

  const [curOverview, setCurOverview]   = useState(null)
  const [prevOverview, setPrevOverview] = useState(null)
  const [curDaily, setCurDaily]         = useState([])
  const [prevDaily, setPrevDaily]       = useState([])
  const [curClients, setCurClients]     = useState([])
  const [prevClients, setPrevClients]   = useState([])

  useEffect(() => { getClients(false).then(setClients) }, [])

  const [from, to] = useMemo(() => {
    const [f, t] = getRange(period, customRange)
    return [f.format('YYYY-MM-DD'), t.format('YYYY-MM-DD')]
  }, [period, customRange])

  const [pFrom, pTo] = useMemo(() => {
    const [f, t] = getRange(period, customRange)
    const [pf, pt] = getPrevRange(period, [f, t])
    return [pf.format('YYYY-MM-DD'), pt.format('YYYY-MM-DD')]
  }, [period, customRange])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const p = { date_from: from, date_to: to }
      if (clientIds.length) p.client_id = clientIds

      const [overview, daily, byClient] = await Promise.all([
        getStatsOverview(p),
        getStatsDaily(p),
        getStatsByClient({ date_from: from, date_to: to }),
      ])
      setCurOverview(overview)
      setCurDaily(daily)
      setCurClients(byClient)

      if (compare) {
        const pp = { date_from: pFrom, date_to: pTo }
        if (clientIds.length) pp.client_id = clientIds
        const [po, pd, pbc] = await Promise.all([
          getStatsOverview(pp),
          getStatsDaily(pp),
          getStatsByClient({ date_from: pFrom, date_to: pTo }),
        ])
        setPrevOverview(po)
        setPrevDaily(pd)
        setPrevClients(pbc)
      } else {
        setPrevOverview(null)
        setPrevDaily([])
        setPrevClients([])
      }
    } catch {
      // silently ignore — data will just be empty
    } finally {
      setLoading(false)
    }
  }, [from, to, pFrom, pTo, compare, clientIds])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Chart data ─────────────────────────────────────────────────────────────

  const granularity = useMemo(() => getGranularity(from, to), [from, to])

  const chartData = useMemo(() => {
    const cur  = aggregate(fillDates(curDaily, from, to), granularity)
    const prev = aggregate(prevDaily.length ? fillDates(prevDaily, pFrom, pTo) : [], granularity)
    return cur.map((d, i) => {
      const getValue = (row) =>
        metric === 'margin'       ? row.margin :
        metric === 'instructions' ? row.instruction_count :
        row.total_client_fee
      return {
        day:       d.day,
        value:     getValue(d),
        prevValue: compare && prev[i] ? getValue(prev[i]) : undefined,
        prevDay:   prev[i]?.day,
      }
    })
  }, [curDaily, prevDaily, granularity, metric, compare, from, to, pFrom, pTo])

  // ── Derived values ─────────────────────────────────────────────────────────

  const avgMargin     = curOverview?.instruction_count  > 0 ? curOverview.margin  / curOverview.instruction_count  : 0
  const prevAvgMargin = prevOverview?.instruction_count > 0 ? prevOverview.margin / prevOverview.instruction_count : 0

  const isMoney       = metric !== 'instructions'
  const metricLabel   = metric === 'margin' ? 'Margin' : metric === 'instructions' ? 'Instructions' : 'Revenue'
  const compLabel     = prevLabel(period)

  // ── Client table ───────────────────────────────────────────────────────────

  const clientTableData = useMemo(() => {
    const prevMap = Object.fromEntries(prevClients.map(r => [r.client_id, r]))
    return curClients.map(r => ({ ...r, key: r.client_id, prev: prevMap[r.client_id] ?? null }))
  }, [curClients, prevClients])

  const clientColumns = [
    {
      title: 'Client',
      dataIndex: 'client_name',
      key: 'name',
    },
    {
      title: 'Instructions',
      dataIndex: 'instruction_count',
      key: 'cnt',
      sorter: (a, b) => a.instruction_count - b.instruction_count,
      render: (v, r) => (
        <Space size={6}>
          <Text>{v}</Text>
          {compare && <ChangeBadge current={v} prev={r.prev?.instruction_count ?? null} />}
        </Space>
      ),
    },
    {
      title: 'Revenue',
      dataIndex: 'total_client_fee',
      key: 'rev',
      sorter: (a, b) => a.total_client_fee - b.total_client_fee,
      render: (v, r) => (
        <Space size={6}>
          <Text>£{v.toFixed(2)}</Text>
          {compare && <ChangeBadge current={v} prev={r.prev?.total_client_fee ?? null} />}
        </Space>
      ),
    },
    {
      title: 'Surveyor Cost',
      dataIndex: 'total_surveyor_fee',
      key: 'sf',
      sorter: (a, b) => a.total_surveyor_fee - b.total_surveyor_fee,
      render: v => `£${v.toFixed(2)}`,
    },
    {
      title: 'Margin',
      dataIndex: 'margin',
      key: 'margin',
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.margin - b.margin,
      render: (v, r) => (
        <Space size={6}>
          <Text strong>£{v.toFixed(2)}</Text>
          {compare && <ChangeBadge current={v} prev={r.prev?.margin ?? null} />}
        </Space>
      ),
    },
    {
      title: 'Margin %',
      key: 'pct',
      sorter: (a, b) => {
        const ap = a.total_client_fee > 0 ? a.margin / a.total_client_fee : 0
        const bp = b.total_client_fee > 0 ? b.margin / b.total_client_fee : 0
        return ap - bp
      },
      render: (_, r) =>
        r.total_client_fee > 0
          ? `${((r.margin / r.total_client_fee) * 100).toFixed(1)}%`
          : '—',
    },
  ]

  // ── KPI cards config ───────────────────────────────────────────────────────

  const kpis = curOverview ? [
    { title: 'Instructions',            value: curOverview.instruction_count,  prev: prevOverview?.instruction_count,  money: false },
    { title: 'Revenue',                 value: curOverview.total_client_fee,   prev: prevOverview?.total_client_fee,   money: true  },
    { title: 'Total Margin',            value: curOverview.margin,             prev: prevOverview?.margin,             money: true  },
    { title: 'Avg Margin / Instruction',value: avgMargin,                      prev: compare ? prevAvgMargin : null,   money: true  },
  ] : []

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Spin spinning={loading}>

      {/* Controls */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={[12, 8]} align="middle" wrap>
          <Col>
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                { label: 'This Week',  value: 'week'   },
                { label: 'This Month', value: 'month'  },
                { label: 'This Year',  value: 'year'   },
                { label: 'Custom',     value: 'custom' },
              ]}
            />
          </Col>
          {period === 'custom' && (
            <Col>
              <RangePicker
                value={customRange}
                format="DD/MM/YYYY"
                onChange={v => v && setCustomRange(v)}
              />
            </Col>
          )}
          <Col>
            <Select
              mode="multiple"
              allowClear
              placeholder="All clients"
              style={{ minWidth: 200 }}
              value={clientIds}
              onChange={setClientIds}
              options={clients.map(c => ({ value: c.id, label: c.company_name }))}
            />
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
            <Space>
              <Text type="secondary" style={{ fontSize: 13 }}>Compare to {compLabel.toLowerCase()}</Text>
              <Switch checked={compare} onChange={setCompare} />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPI Cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {kpis.map(kpi => (
          <Col xs={12} lg={6} key={kpi.title} style={{ marginBottom: 0 }}>
            <Card style={{ marginBottom: 16 }}>
              <Statistic
                title={kpi.title}
                value={kpi.money ? kpi.value.toFixed(2) : kpi.value}
                prefix={kpi.money ? '£' : undefined}
              />
              {compare && kpi.prev != null && (
                <div style={{ marginTop: 6 }}>
                  <ChangeBadge current={kpi.value} prev={kpi.prev} />
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    vs {kpi.money ? `£${kpi.prev.toFixed(2)}` : kpi.prev} last {period === 'custom' ? 'period' : period}
                  </Text>
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* Chart */}
      <Card
        style={{ marginBottom: 16 }}
        styles={{ body: { paddingTop: 8 } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span>Over Time</span>
            <Segmented
              size="small"
              value={metric}
              onChange={setMetric}
              options={[
                { label: 'Margin',       value: 'margin'       },
                { label: 'Revenue',      value: 'revenue'      },
                { label: 'Instructions', value: 'instructions' },
              ]}
            />
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={d => formatTick(d, granularity)}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => isMoney ? `£${v % 1 === 0 ? v : v.toFixed(0)}` : v}
              width={64}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const cur  = payload.find(p => p.dataKey === 'value')
                const prev = payload.find(p => p.dataKey === 'prevValue')
                const fmt  = v => isMoney ? `£${Number(v).toFixed(2)}` : v
                return (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 6, padding: '8px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{formatTick(label, granularity)}</div>
                    {cur  && <div style={{ color: PRIMARY }}>{metricLabel}: {fmt(cur.value)}</div>}
                    {prev && prev.value != null && (
                      <div style={{ color: COMPARE_COLOR }}>
                        {compLabel} ({prev.payload?.prevDay ? formatTick(prev.payload.prevDay, granularity) : '—'}): {fmt(prev.value)}
                      </div>
                    )}
                  </div>
                )
              }}
            />
            {compare && (
              <Legend
                formatter={v => v === 'value' ? metricLabel : compLabel}
                wrapperStyle={{ fontSize: 12 }}
              />
            )}
            <Bar
              dataKey="value"
              name="value"
              fill={PRIMARY}
              radius={[3, 3, 0, 0]}
              maxBarSize={36}
            />
            {compare && (
              <Line
                dataKey="prevValue"
                name="prevValue"
                stroke={COMPARE_COLOR}
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 3"
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Client Breakdown */}
      <Card title="By Client">
        <Table
          dataSource={clientTableData}
          columns={clientColumns}
          size="small"
          pagination={false}
          rowKey="client_id"
          locale={{ emptyText: 'No instructions in this period' }}
        />
      </Card>

    </Spin>
  )
}
