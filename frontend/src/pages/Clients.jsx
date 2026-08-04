import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Modal, Form, Input, Select, Card, Space, Tag, Switch, Popconfirm, message, Checkbox
} from 'antd'
import { PlusOutlined, DeleteOutlined, UndoOutlined, SearchOutlined } from '@ant-design/icons'
import { getClients, createClient, addContact, deleteClient, restoreClient } from '../api/client'

export default function Clients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [createForm] = Form.useForm()

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
      const { contacts: contactList, ...clientData } = values
      const client = await createClient(clientData)
      if (contactList?.length) {
        await Promise.all(contactList.map(c => addContact(client.id, c)))
      }
      message.success('Client created')
      setCreateModalOpen(false)
      createForm.resetFields()
      navigate(`/clients/${client.id}`)
    } catch {
      message.error('Failed to create client')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try {
      await deleteClient(id)
      message.success('Client deleted')
      fetch()
    } catch {
      message.error('Failed to delete client')
    }
  }

  const handleRestore = async (e, id) => {
    e.stopPropagation()
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
    return [c.company_name, c.type, c.town, c.postcode, c.notes]
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
    {
      title: 'Contacts',
      key: 'contacts',
      render: (_, r) => {
        const n = r.contacts?.length || 0
        return n > 0 ? <Tag>{n} contact{n !== 1 ? 's' : ''}</Tag> : <span style={{ color: '#bbb' }}>—</span>
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
              title="Delete this client?"
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

  const clientFields = (
    <>
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
    </>
  )

  const createClientForm = (
    <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
      {clientFields}
      <div style={{ fontWeight: 600, marginBottom: 8, marginTop: 4 }}>Contacts</div>
      <Form.List name="contacts">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...rest }) => (
              <div key={key} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '12px 12px 0', marginBottom: 8, position: 'relative' }}>
                <Button
                  type="text" danger size="small" icon={<DeleteOutlined />}
                  style={{ position: 'absolute', top: 6, right: 6 }}
                  onClick={() => remove(name)}
                />
                <Form.Item {...rest} name={[name, 'name']} label="Name" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
                  <Form.Item {...rest} name={[name, 'email']} label="Email" style={{ flex: 1 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'phone']} label="Phone" style={{ flex: 1 }}>
                    <Input />
                  </Form.Item>
                </Space>
                <Form.Item {...rest} name={[name, 'role']} label="Role">
                  <Input placeholder="e.g. Accounts, Relationship Manager" />
                </Form.Item>
                <Form.Item {...rest} name={[name, 'is_primary']} valuePropName="checked">
                  <Checkbox>Primary contact</Checkbox>
                </Form.Item>
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ is_primary: false })} block>
              Add Contact
            </Button>
          </>
        )}
      </Form.List>
    </Form>
  )

  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'nowrap' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search by name, type, town, postcode…"
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
        onRow={(record) => ({
          onClick: () => navigate(`/clients/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />

      <Modal
        title="Add Client"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
        okText="Create"
        width={600}
      >
        {createClientForm}
      </Modal>
    </Card>
  )
}
