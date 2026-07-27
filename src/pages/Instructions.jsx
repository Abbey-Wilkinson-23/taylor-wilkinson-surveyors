import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Select, DatePicker, Space, Tag, Card, Typography, Input
} from 'antd'
import { PlusOutlined, DownloadOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getInstructions, getClients, getExportUrl, getChasers } from '../api/client'

const { RangePicker } = DatePicker
const { Text } = Typography

const STATUS_COLOURS = {
  received: 'blue',
  surveyor_assigned: 'purple',
  booked: 'cyan',
  report_received: 'geekblue',
  invoiced: 'volcano',
  complete: 'green',
  on_hold: 'gold',
  cancelled: 'red',
}

const STATUS_LABELS = {
  received: 'Received',
  surveyor_assigned: 'Surveyor Assigned',
  booked: 'Booked',
  report_received: 'Report Received',
  invoiced: 'Invoiced',
  complete: 'Complete',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
}

const columns = (navigate) => [
  {
    title: 'Our Ref',
    dataIndex: 'our_ref',
    key: 'our_ref',
    render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
  },
  { title: 'Client Ref', dataIndex: 'client_ref', key: 'client_ref', render: v => v || '—' },
  { title: 'Borrower', dataIndex: 'borrower_name', key: 'borrower_name' },
  { title: 'Client', dataIndex: 'client_name', key: 'client_name', render: v => v || '—' },
  {
    title: 'Property',
    key: 'property',
    render: (_, r) => {
      const line1 = r.property_address_line_1
      const postcode = r.property_postcode
      if (!line1 && !postcode) return '—'
      return (
        <span>
          {line1 && <span>{line1}</span>}
          {line1 && postcode && <br />}
          {postcode && <Text type="secondary" style={{ fontSize: 12 }}>{postcode}</Text>}
        </span>
      )
    },
  },
  { title: 'Survey Type', dataIndex: 'survey_type_name', key: 'survey_type_name', render: v => v || '—' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => (
      <Tag color={STATUS_COLOURS[status] || 'default'}>
        {STATUS_LABELS[status] || status}
      </Tag>
    ),
  },
  {
    title: 'Priority',
    dataIndex: 'priority',
    key: 'priority',
    render: (p) => p === 'urgent' ? <Tag color="red">Urgent</Tag> : <Tag>Standard</Tag>,
  },
  {
    title: 'Received',
    dataIndex: 'received_at',
    key: 'received_at',
    render: (v) => dayjs(v).format('DD/MM/YYYY'),
  },
  {
    title: 'Inspection Date',
    dataIndex: 'inspection_date',
    key: 'inspection_date',
    render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
  },
  { title: 'Surveyor', dataIndex: 'surveyor_name', key: 'surveyor_name', render: v => v || '—' },
  {
    title: 'Client Fee',
    dataIndex: 'agreed_client_fee',
    key: 'agreed_client_fee',
    render: v => v != null ? `£${Number(v).toFixed(2)}` : '—',
  },
  {
    title: 'Surveyor Fee',
    dataIndex: 'agreed_surveyor_fee',
    key: 'agreed_surveyor_fee',
    render: v => v != null ? `£${Number(v).toFixed(2)}` : '—',
  },
]

export default function Instructions() {
  const navigate = useNavigate()
  const [instructions, setInstructions] = useState([])
  const [chasers, setChasers] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showChasers, setShowChasers] = useState(false)
  const [inspectionFilter, setInspectionFilter] = useState(null)
  const [filters, setFilters] = useState({ status: [], client_id: [], date_from: null, date_to: null })

  const fetchInstructions = async (f = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (f.status) params.status = f.status
      if (f.client_id) params.client_id = f.client_id
      if (f.date_from) params.date_from = f.date_from
      if (f.date_to) params.date_to = f.date_to
      const data = await getInstructions(params)
      setInstructions(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getClients().then(setClients)
    fetchInstructions()
    getChasers().then(setChasers)
  }, [])

  const handleDateChange = (dates) => {
    const updated = {
      ...filters,
      date_from: dates ? dates[0].format('YYYY-MM-DD') : null,
      date_to: dates ? dates[1].format('YYYY-MM-DD') : null,
    }
    setFilters(updated)
    fetchInstructions(updated)
  }

  const handleFilterChange = (key, value) => {
    const updated = { ...filters, [key]: value || [] }
    setFilters(updated)
    fetchInstructions(updated)
  }

  const handleExport = () => {
    window.open(getExportUrl(filters), '_blank')
  }

  const today = dayjs().startOf('day')
  const overdueCount = chasers.filter(i => dayjs(i.report_due_date).isBefore(today, 'day')).length
  const chaserIds = new Set(chasers.map(i => i.id))

  const filtered = (showChasers ? instructions.filter(i => chaserIds.has(i.id)) : instructions).filter(i => {
    if (inspectionFilter === 'assigned' && !i.inspection_date) return false
    if (inspectionFilter === 'not_assigned' && i.inspection_date) return false
    if (!search) return true
    const q = search.toLowerCase()
    return [
      i.our_ref, i.client_ref, i.borrower_name, i.client_name,
      i.survey_type_name, i.surveyor_name, i.status,
      i.property_address_line_1, i.property_postcode,
      STATUS_LABELS[i.status],
    ].some(v => v?.toLowerCase().includes(q))
  })

  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'nowrap' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search by ref, borrower, client, address, postcode, surveyor, survey type…"
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Space style={{ flexShrink: 0 }}>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Export CSV</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/instructions/new')}>
            New Instruction
          </Button>
        </Space>
      </div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          mode="multiple"
          placeholder="Filter by status"
          allowClear
          style={{ minWidth: 200 }}
          onChange={(v) => handleFilterChange('status', v)}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          maxTagCount="responsive"
        />
        <Select
          mode="multiple"
          placeholder="Filter by client"
          allowClear
          style={{ minWidth: 220 }}
          onChange={(v) => handleFilterChange('client_id', v)}
          options={clients.map(c => ({ value: c.id, label: c.company_name }))}
          maxTagCount="responsive"
          optionFilterProp="label"
          showSearch
        />
        <RangePicker
          format="DD/MM/YYYY"
          onChange={handleDateChange}
          placeholder={['Received from', 'Received to']}
        />
        <Select
          placeholder="Inspection date"
          allowClear
          style={{ width: 180 }}
          value={inspectionFilter}
          onChange={v => setInspectionFilter(v || null)}
          options={[
            { value: 'assigned', label: 'Inspection date set' },
            { value: 'not_assigned', label: 'No inspection date' },
          ]}
        />
        {chasers.length > 0 && (
          <Button
            icon={overdueCount > 0 ? <WarningOutlined /> : undefined}
            onClick={() => setShowChasers(v => !v)}
            type={showChasers ? 'primary' : 'default'}
            danger={!showChasers && overdueCount > 0}
            style={showChasers && overdueCount > 0 ? { background: '#cf1322', borderColor: '#cf1322' } : undefined}
          >
            Reports to Chase ({chasers.length}{overdueCount > 0 ? `, ${overdueCount} overdue` : ''})
          </Button>
        )}
      </Space>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {filtered.length} instruction{filtered.length !== 1 ? 's' : ''}
      </Text>
      <Table
        dataSource={filtered}
        columns={columns(navigate)}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
        scroll={{ x: true }}
        onRow={(record) => {
          const isOverdue = showChasers && record.report_due_date && dayjs(record.report_due_date).isBefore(today, 'day')
          return {
            onClick: () => navigate(`/instructions/${record.id}`),
            style: {
              cursor: 'pointer',
              background: isOverdue ? '#fff1f0' : undefined,
              color: isOverdue ? '#cf1322' : undefined,
              fontWeight: isOverdue ? 600 : undefined,
            },
          }
        }}
      />
    </Card>
  )
}
