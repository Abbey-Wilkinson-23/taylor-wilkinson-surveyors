import { useEffect, useMemo, useState } from 'react'
import {
  Table, Button, Modal, Form, Input, Card, Tag, Space, Switch, Popconfirm, message
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UndoOutlined, SearchOutlined } from '@ant-design/icons'
import {
  getSurveyTypes, createSurveyType, updateSurveyType, deleteSurveyType, restoreSurveyType
} from '../api/client'

export default function SurveyTypes() {
  const [surveyTypes, setSurveyTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [search, setSearch] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingType, setEditingType] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const fetch = async (deleted = showDeleted) => {
    setLoading(true)
    try {
      const data = await getSurveyTypes(!deleted)
      setSurveyTypes(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [])

  const filtered = useMemo(() => {
    if (!search) return surveyTypes
    const q = search.toLowerCase()
    return surveyTypes.filter(t =>
      [t.name, t.code, t.description].some(v => v?.toLowerCase().includes(q))
    )
  }, [surveyTypes, search])

  const handleToggleDeleted = (checked) => {
    setShowDeleted(checked)
    fetch(checked)
  }

  const handleCreate = async (values) => {
    setSubmitting(true)
    try {
      await createSurveyType(values)
      message.success('Survey type created')
      setCreateModalOpen(false)
      createForm.resetFields()
      fetch()
    } catch {
      message.error('Failed to create survey type')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditOpen = (type) => {
    setEditingType(type)
    editForm.setFieldsValue({ name: type.name, code: type.code, description: type.description, report_due_days: type.report_due_days })
    setEditModalOpen(true)
  }

  const handleEdit = async (values) => {
    setSubmitting(true)
    try {
      await updateSurveyType(editingType.id, values)
      message.success('Survey type updated')
      setEditModalOpen(false)
      setEditingType(null)
      fetch()
    } catch {
      message.error('Failed to update survey type')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteSurveyType(id)
      message.success('Survey type deleted')
      fetch()
    } catch {
      message.error('Failed to delete survey type')
    }
  }

  const handleRestore = async (id) => {
    try {
      await restoreSurveyType(id)
      message.success('Survey type restored')
      fetch()
    } catch {
      message.error('Failed to restore survey type')
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Code', dataIndex: 'code', key: 'code', render: v => <Tag>{v}</Tag> },
    { title: 'Description', dataIndex: 'description', key: 'description', render: v => v || '—' },
    { title: 'Report SLA (days)', dataIndex: 'report_due_days', key: 'report_due_days', render: v => v != null ? v : '—' },
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
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditOpen(record)}>
            Edit
          </Button>
          {record.is_active ? (
            <Popconfirm
              title="Delete this survey type?"
              description="It won't appear as an option unless you filter by deleted."
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          ) : (
            <Button size="small" icon={<UndoOutlined />} onClick={() => handleRestore(record.id)}>
              Restore
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const typeForm = (form, onFinish) => (
    <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
      <Form.Item name="name" label="Name" rules={[{ required: true }]}
        extra="e.g. Mortgage Valuation">
        <Input />
      </Form.Item>
      <Form.Item name="code" label="Code" rules={[{ required: true }]}
        extra="Short code e.g. MV, L2, L3">
        <Input style={{ textTransform: 'uppercase' }} />
      </Form.Item>
      <Form.Item name="description" label="Description">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item name="report_due_days" label="Report SLA (working days)"
        extra="Number of working days from inspection to report due. Leave blank if not applicable.">
        <Input type="number" min={1} max={90} style={{ width: 120 }} />
      </Form.Item>
    </Form>
  )

  return (
    <Card
      extra={
        <Space>
          <Space>
            <span style={{ fontSize: 13 }}>Show deleted</span>
            <Switch size="small" checked={showDeleted} onChange={handleToggleDeleted} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Add Survey Type
          </Button>
        </Space>
      }
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder="Search by name, code, description…"
        allowClear
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12, maxWidth: 360 }}
      />
      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="small"
      />

      <Modal
        title="Add Survey Type"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
        okText="Create"
      >
        {typeForm(createForm, handleCreate)}
      </Modal>

      <Modal
        title="Edit Survey Type"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingType(null) }}
        onOk={() => editForm.submit()}
        confirmLoading={submitting}
        okText="Save"
      >
        {typeForm(editForm, handleEdit)}
      </Modal>
    </Card>
  )
}
