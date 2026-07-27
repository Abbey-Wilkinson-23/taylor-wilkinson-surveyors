import { useEffect, useState } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Card, Space, Tag, Switch, Popconfirm, message
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UndoOutlined, SearchOutlined } from '@ant-design/icons'
import { getClients, createClient, updateClient, deleteClient, restoreClient } from '../api/client'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const fetch = async (deleted = showDeleted) => {
    setLoading(true)
    try {
      const data = await getClients(!deleted)
      setClients(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [])

  const handleToggleDeleted = (checked) => {
    setShowDeleted(checked)
    fetch(checked)
  }

  const handleCreate = async (values) => {
    setSubmitting(true)
    try {
      await createClient(values)
      message.success('Client created')
      setCreateModalOpen(false)
      createForm.resetFields()
      fetch()
    } catch {
      message.error('Failed to create client')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditOpen = (client) => {
    setEditingClient(client)
    editForm.setFieldsValue({
      company_name: client.company_name,
      type: client.type,
      email: client.email,
      phone: client.phone,
      address_line_1: client.address_line_1,
      town: client.town,
      postcode: client.postcode,
      notes: client.notes,
    })
    setEditModalOpen(true)
  }

  const handleEdit = async (values) => {
    setSubmitting(true)
    try {
      await updateClient(editingClient.id, values)
      message.success('Client updated')
      setEditModalOpen(false)
      setEditingClient(null)
      fetch()
    } catch {
      message.error('Failed to update client')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteClient(id)
      message.success('Client deleted')
      fetch()
    } catch {
      message.error('Failed to delete client')
    }
  }

  const handleRestore = async (id) => {
    try {
      await restoreClient(id)
      message.success('Client restored')
      fetch()
    } catch {
      message.error('Failed to restore client')
    }
  }

  const filtered = clients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return [c.company_name, c.type, c.email, c.phone, c.town, c.postcode, c.notes]
      .some(v => v?.toLowerCase().includes(q))
  })

  const columns = [
    { title: 'Company', dataIndex: 'company_name', key: 'company_name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t) => <Tag>{t.charAt(0).toUpperCase() + t.slice(1)}</Tag>,
    },
    { title: 'Email', dataIndex: 'email', key: 'email', render: v => v || '—' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: v => v || '—' },
    { title: 'Contacts', key: 'contacts', render: (_, r) => r.contacts?.length || 0 },
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
              title="Delete this client?"
              description="They won't appear in the system unless you filter by deleted."
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

  const clientForm = (form, onFinish) => (
    <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
      <Form.Item name="company_name" label="Company Name" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="type" label="Type" rules={[{ required: true }]}>
        <Select options={[
          { value: 'lender', label: 'Lender' },
          { value: 'broker', label: 'Broker' },
          { value: 'both', label: 'Both' },
        ]} />
      </Form.Item>
      <Form.Item name="email" label="Email">
        <Input />
      </Form.Item>
      <Form.Item name="phone" label="Phone">
        <Input />
      </Form.Item>
      <Form.Item name="address_line_1" label="Address Line 1">
        <Input />
      </Form.Item>
      <Form.Item name="town" label="Town">
        <Input />
      </Form.Item>
      <Form.Item name="postcode" label="Postcode">
        <Input />
      </Form.Item>
      <Form.Item name="notes" label="Notes">
        <Input.TextArea rows={2} />
      </Form.Item>
    </Form>
  )

  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'nowrap' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search by name, type, email, phone, town, postcode…"
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Space style={{ flexShrink: 0 }}>
          <span style={{ fontSize: 13 }}>Show deleted</span>
          <Switch size="small" checked={showDeleted} onChange={handleToggleDeleted} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Add Client
          </Button>
        </Space>
      </div>
      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="small"
      />

      <Modal
        title="Add Client"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
        okText="Create"
      >
        {clientForm(createForm, handleCreate)}
      </Modal>

      <Modal
        title="Edit Client"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingClient(null) }}
        onOk={() => editForm.submit()}
        confirmLoading={submitting}
        okText="Save"
      >
        {clientForm(editForm, handleEdit)}
      </Modal>
    </Card>
  )
}
