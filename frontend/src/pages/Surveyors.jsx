import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Modal, Form, Input, Card, Tag, Space, Switch, Popconfirm, message, Select, Typography
} from 'antd'
import { PlusOutlined, DeleteOutlined, UndoOutlined, SearchOutlined } from '@ant-design/icons'
import { getSurveyors, createSurveyor, deleteSurveyor, restoreSurveyor } from '../api/client'

const { Text } = Typography

function formatPiCover(v) {
  if (v == null) return '—'
  const n = Number(v)
  if (n >= 1_000_000 && n % 1_000_000 === 0) return `£${n / 1_000_000}M`
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000 && n % 1_000 === 0) return `£${n / 1_000}K`
  if (n >= 1_000) return `£${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `£${n.toFixed(2)}`
}

export default function Surveyors() {
  const navigate = useNavigate()
  const [surveyors, setSurveyors] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [search, setSearch] = useState('')
  const [postcodeFilter, setPostcodeFilter] = useState(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createForm] = Form.useForm()

  const fetchData = async (deleted = showDeleted) => {
    setLoading(true)
    try {
      const data = await getSurveyors(!deleted)
      setSurveyors(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleToggleDeleted = (checked) => {
    setShowDeleted(checked)
    fetchData(checked)
  }

  const handleCreate = async (values) => {
    setSubmitting(true)
    try {
      const created = await createSurveyor(values)
      message.success('Surveyor added')
      setCreateModalOpen(false)
      createForm.resetFields()
      navigate(`/surveyors/${created.id}`)
    } catch {
      message.error('Failed to add surveyor')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try {
      await deleteSurveyor(id)
      message.success('Surveyor deleted')
      fetchData()
    } catch {
      message.error('Failed to delete surveyor')
    }
  }

  const handleRestore = async (e, id) => {
    e.stopPropagation()
    try {
      await restoreSurveyor(id)
      message.success('Surveyor restored')
      fetchData()
    } catch {
      message.error('Failed to restore surveyor')
    }
  }

  // coverage is [{code, distance_band}]
  const coverageCodes = (s) => (s.coverage || []).map(c => c.code)

  const allPostcodes = [...new Set(surveyors.flatMap(coverageCodes))].sort()

  const filtered = surveyors.filter(s => {
    if (postcodeFilter && !coverageCodes(s).includes(postcodeFilter)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return [
      s.surveyor_number, s.first_name, s.last_name,
      `${s.first_name} ${s.last_name}`, s.company_name,
      s.email, s.phone, s.qualification,
      ...coverageCodes(s),
    ].some(v => v?.toLowerCase().includes(q))
  })

  const columns = [
    { title: 'No.', dataIndex: 'surveyor_number', key: 'surveyor_number', width: 60, render: v => v || '—' },
    { title: 'Name', key: 'name', render: (_, r) => `${r.first_name} ${r.last_name}` },
    { title: 'Company', dataIndex: 'company_name', key: 'company_name', render: v => v || '—' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Work Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Base Postcode', dataIndex: 'base_postcode', key: 'base_postcode', render: v => v || '—' },
    {
      title: 'PI Cover',
      dataIndex: 'pi_cover_amount',
      key: 'pi_cover_amount',
      render: formatPiCover,
    },
    {
      title: 'Coverage',
      key: 'coverage',
      render: (_, r) => {
        const codes = [...(r.coverage || [])].sort((a, b) => {
          if (a.distance_band === b.distance_band) return a.code.localeCompare(b.code)
          return (a.distance_band === '25' ? 1 : 0) - (b.distance_band === '25' ? 1 : 0)
        })
        if (!codes.length) return <Text type="secondary">—</Text>
        const shown = codes.slice(0, 5)
        const rest = codes.length - 5
        return (
          <Space wrap size={2}>
            {shown.map(c => (
              <Tag key={c.code} style={{ marginBottom: 2, color: c.distance_band === '25' ? '#8753A8' : 'inherit', borderColor: c.distance_band === '25' ? '#8753A8' : undefined }}>
                {c.code}
              </Tag>
            ))}
            {rest > 0 && <Text type="secondary" style={{ fontSize: 11 }}>+{rest} more</Text>}
          </Space>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v) => v ? <Tag color="green">Active</Tag> : <Tag color="red">Deleted</Tag>,
    },
    {
      title: '',
      key: 'actions',
      render: (_, record) => (
        <Space onClick={e => e.stopPropagation()}>
          {record.is_active ? (
            <Popconfirm
              title="Delete this surveyor?"
              description="They won't appear in the system unless you filter by deleted."
              onConfirm={(e) => handleDelete(e || { stopPropagation: () => {} }, record.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()}>Delete</Button>
            </Popconfirm>
          ) : (
            <Button size="small" icon={<UndoOutlined />} onClick={(e) => handleRestore(e, record.id)}>
              Restore
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'nowrap' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search by name, number, company, email, postcode…"
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Space style={{ flexShrink: 0 }}>
          <span style={{ fontSize: 13 }}>Show deleted</span>
          <Switch size="small" checked={showDeleted} onChange={handleToggleDeleted} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Add Surveyor
          </Button>
        </Space>
      </div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Filter by postcode"
          allowClear
          showSearch
          style={{ width: 180 }}
          value={postcodeFilter}
          onChange={v => setPostcodeFilter(v || null)}
          options={allPostcodes.map(c => ({ value: c, label: c }))}
        />
      </Space>
      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
        scroll={{ x: true }}
        onRow={(record) => ({
          onClick: () => navigate(`/surveyors/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />

      <Modal
        title="Add Surveyor"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
        okText="Add"
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="surveyor_number" label="Surveyor Number"
            extra="Your internal reference number for this surveyor">
            <Input />
          </Form.Item>
          <Form.Item name="first_name" label="First Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Last Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="company_name" label="Company Name">
            <Input placeholder="Leave blank if sole trader" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Work Phone" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
