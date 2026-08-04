import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Divider, Form,
  Input, Select, Row, Col, Typography, message, Spin, Popconfirm, Table, Checkbox, Modal,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined, SaveOutlined, CloseOutlined, DeleteOutlined, UndoOutlined, PlusOutlined } from '@ant-design/icons'
import {
  getClient, updateClient, deleteClient, restoreClient,
  addContact, updateContact, deleteContact,
} from '../api/client'

const { Text, Title } = Typography

const CARD_STYLE = { marginBottom: 16 }
const SECTION_LABEL_STYLE = { width: 160, color: '#888', fontWeight: 500 }

const TYPE_LABELS = { lender: 'Lender', broker: 'Broker', both: 'Both' }

function SectionCard({ title, children, style }) {
  return (
    <Card
      title={<span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888' }}>{title}</span>}
      size="small"
      style={{ ...CARD_STYLE, ...style }}
      styles={{ header: { borderBottom: '1px solid #f0f0f0', minHeight: 36 }, body: { padding: '12px 16px' } }}
    >
      {children}
    </Card>
  )
}

function ContactsSection({ client, onChange }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [form] = Form.useForm()

  const openAdd = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (c) => {
    setEditing(c)
    form.setFieldsValue({ name: c.name, email: c.email, phone: c.phone, role: c.role, is_primary: c.is_primary })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await updateContact(client.id, editing.id, values)
      } else {
        await addContact(client.id, values)
      }
      message.success(editing ? 'Contact updated' : 'Contact added')
      setModalOpen(false)
      onChange()
    } catch {
      message.error('Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (contactId) => {
    try {
      await deleteContact(client.id, contactId)
      message.success('Contact removed')
      onChange()
    } catch {
      message.error('Failed to remove contact')
    }
  }

  const columns = [
    { title: 'Name',  dataIndex: 'name',  key: 'name',
      render: (name, r) => <span>{name}{r.is_primary && <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>Primary</Tag>}</span> },
    { title: 'Email', dataIndex: 'email', key: 'email', render: v => v || '—' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: v => v || '—' },
    { title: 'Role',  dataIndex: 'role',  key: 'role',  render: v => v || '—' },
    {
      title: '', key: 'actions', width: 80,
      render: (_, c) => (
        <Space>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(c)} />
          <Popconfirm title="Remove this contact?" onConfirm={() => handleDelete(c.id)} okText="Remove" okButtonProps={{ danger: true }}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <SectionCard title="Contacts">
      <Table
        dataSource={client.contacts}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        locale={{ emptyText: 'No contacts yet' }}
      />
      <Button type="dashed" icon={<PlusOutlined />} size="small" style={{ marginTop: 8 }} onClick={openAdd}>
        Add Contact
      </Button>

      <Modal
        title={editing ? 'Edit Contact' : 'Add Contact'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={editing ? 'Save' : 'Add'}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role">
            <Input placeholder="e.g. Accounts, Relationship Manager" />
          </Form.Item>
          <Form.Item name="is_primary" valuePropName="checked">
            <Checkbox>Primary contact</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </SectionCard>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notesEditing, setNotesEditing] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const data = await getClient(id)
      setClient(data)
      setNotesValue(data.notes || '')
      form.setFieldsValue({
        company_name: data.company_name,
        type: data.type,
        email: data.email,
        phone: data.phone,
        address_line_1: data.address_line_1,
        address_line_2: data.address_line_2,
        town: data.town,
        county: data.county,
        postcode: data.postcode,
        notes: data.notes,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleSave = async (values) => {
    setSaving(true)
    try {
      await updateClient(id, {
        company_name: values.company_name,
        type: values.type,
        email: values.email || null,
        phone: values.phone || null,
        address_line_1: values.address_line_1 || null,
        address_line_2: values.address_line_2 || null,
        town: values.town || null,
        county: values.county || null,
        postcode: values.postcode || null,
        notes: values.notes || null,
      })
      message.success('Saved')
      setEditing(false)
      load()
    } catch {
      message.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteClient(id)
      message.success('Client deleted')
      navigate('/clients')
    } catch {
      message.error('Failed to delete client')
    }
  }

  const handleNotesSave = async () => {
    setNotesSaving(true)
    try {
      await updateClient(id, { notes: notesValue || null })
      setClient(prev => ({ ...prev, notes: notesValue || null }))
      setNotesEditing(false)
    } catch {
      message.error('Failed to save notes')
    } finally {
      setNotesSaving(false)
    }
  }

  const handleRestore = async () => {
    try {
      await restoreClient(id)
      message.success('Client restored')
      load()
    } catch {
      message.error('Failed to restore client')
    }
  }

  if (loading) return <Spin style={{ display: 'block', marginTop: 80 }} />
  if (!client) return <Text>Client not found.</Text>

  const addressParts = [
    client.address_line_1,
    client.address_line_2,
    client.town,
    client.county,
    client.postcode,
  ].filter(Boolean)

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')}>Back</Button>
        </Space>

        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Card
            title={client.company_name}
            extra={
              <Space>
                <Button icon={<CloseOutlined />} onClick={() => { setEditing(false); load() }}>Cancel</Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()}>Save</Button>
              </Space>
            }
            style={CARD_STYLE}
          >
            <Divider orientation="left">Company</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="company_name" label="Company Name" rules={[{ required: true }]}><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                  <Select options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="email" label="Email"><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="phone" label="Phone"><Input /></Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">Address</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="address_line_1" label="Address Line 1"><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="address_line_2" label="Address Line 2"><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="town" label="Town"><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="county" label="County"><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="postcode" label="Postcode"><Input style={{ textTransform: 'uppercase' }} /></Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">Notes</Divider>
            <Form.Item name="notes">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Card>
        </Form>

        <ContactsSection client={client} onChange={load} />
      </>
    )
  }

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')}>Back</Button>
        <Space>
          {client.is_active ? (
            <Popconfirm
              title="Delete this client?"
              onConfirm={handleDelete}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          ) : (
            <Button icon={<UndoOutlined />} onClick={handleRestore}>Restore</Button>
          )}
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>Edit</Button>
        </Space>
      </div>

      {/* Header */}
      <Card style={CARD_STYLE} styles={{ body: { padding: '20px 24px' } }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <Title level={3} style={{ margin: 0 }}>{client.company_name}</Title>
          <Tag>{TYPE_LABELS[client.type]}</Tag>
          {!client.is_active && <Tag color="red">Deleted</Tag>}
        </div>
      </Card>

      {/* Contact + Address */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <SectionCard title="Contact">
            <Descriptions column={1} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
              <Descriptions.Item label="Email">{client.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Phone">{client.phone || '—'}</Descriptions.Item>
            </Descriptions>
          </SectionCard>
        </Col>
        <Col xs={24} md={12}>
          <SectionCard title="Address">
            <Descriptions column={1} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
              <Descriptions.Item label="Address">
                {addressParts.length > 0 ? <Text>{addressParts.join(', ')}</Text> : <Text type="secondary">—</Text>}
              </Descriptions.Item>
            </Descriptions>
          </SectionCard>
        </Col>
      </Row>

      {/* Contacts */}
      <ContactsSection client={client} onChange={load} />

      {/* Notes — inline editable */}
      <SectionCard title="Notes">
        {notesEditing ? (
          <Input.TextArea
            rows={4}
            autoFocus
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            onBlur={handleNotesSave}
          />
        ) : (
          <div
            onDoubleClick={() => setNotesEditing(true)}
            style={{ cursor: 'text', minHeight: 40, padding: '4px 0', borderRadius: 4 }}
          >
            {client.notes
              ? <Text style={{ whiteSpace: 'pre-wrap' }}>{client.notes}</Text>
              : <Text type="secondary" style={{ fontStyle: 'italic' }}>Double-click to add notes…</Text>}
          </div>
        )}
      </SectionCard>
    </>
  )
}
