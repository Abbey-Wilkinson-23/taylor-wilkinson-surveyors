import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, Popconfirm, Switch, message, Checkbox,
} from 'antd'
import { PlusOutlined, SettingOutlined, EyeOutlined } from '@ant-design/icons'
import { getUsers, addUser, updateUser, removeUser } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const { Text } = Typography

const DEVELOPER_EMAIL = 'abbeywilkinson123@gmail.com'

const ALL_PAGES = [
  { key: 'instructions',      label: 'Instructions'      },
  { key: 'clients',           label: 'Clients'           },
  { key: 'surveyors',         label: 'Surveyors'         },
  { key: 'survey-types',      label: 'Survey Types'      },
  { key: 'postcode-coverage', label: 'Postcode Coverage' },
  { key: 'stats',             label: 'Stats'             },
  { key: 'users',             label: 'Users'             },
]

const DEFAULT_PERMISSIONS = {
  developer: ALL_PAGES.map(p => p.key).join(','),
  admin:     ALL_PAGES.map(p => p.key).join(','),
  user:      'instructions,clients,surveyors,survey-types,postcode-coverage',
}

function PermissionsModal({ open, onClose, target, currentUser, onChange }) {
  const [checked, setChecked] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && target) {
      const perms = target.page_permissions || DEFAULT_PERMISSIONS[target.role] || ''
      setChecked(perms.split(',').map(p => p.trim()).filter(Boolean))
    }
  }, [open, target])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateUser(target.id, { page_permissions: checked.join(',') })
      message.success('Permissions updated')
      onChange()
      onClose()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Failed to update permissions')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (key) => setChecked(prev =>
    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
  )

  return (
    <Modal
      title={`Page permissions — ${target?.email}`}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save"
      confirmLoading={saving}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {ALL_PAGES.map(p => (
          <Checkbox
            key={p.key}
            checked={checked.includes(p.key)}
            onChange={() => toggle(p.key)}
          >
            {p.label}
          </Checkbox>
        ))}
      </div>
    </Modal>
  )
}

export default function Users() {
  const { user: currentUser, impersonate } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [permTarget, setPermTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const isDeveloper = currentUser?.role === 'developer'

  const load = async () => {
    setLoading(true)
    try { setUsers(await getUsers()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await addUser(values)
      message.success(`${values.email} added`)
      setAddModal(false)
      form.resetFields()
      load()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Failed to add user')
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (id, role) => {
    try {
      await updateUser(id, { role })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
    } catch (e) {
      message.error(e.response?.data?.detail || 'Failed to update role')
    }
  }

  const handleActiveToggle = async (id, is_active) => {
    try {
      await updateUser(id, { is_active })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active } : u))
    } catch (e) {
      message.error(e.response?.data?.detail || 'Failed to update user')
    }
  }

  const handleRemove = async (id) => {
    try {
      await removeUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
      message.success('User removed')
    } catch (e) {
      message.error(e.response?.data?.detail || 'Failed to remove user')
    }
  }

  const roleTag = (role) => {
    const colours = { developer: 'volcano', admin: 'purple', user: 'default' }
    return <Tag color={colours[role] || 'default'}>{role.charAt(0).toUpperCase() + role.slice(1)}</Tag>
  }

  const columns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email) => (
        <Space>
          <Text>{email}</Text>
          {email === currentUser?.email && <Tag color="purple">You</Tag>}
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 180,
      render: (role, record) => {
        // Developer row — just show badge, never editable
        if (record.email === DEVELOPER_EMAIL) return roleTag(role)
        // Admins editing other admins — only developer can change role
        const canChangeRole = isDeveloper || role !== 'admin'
        const isSelf = record.email === currentUser?.email

        if (!canChangeRole || isSelf) return roleTag(role)

        return (
          <Select
            size="small"
            value={role}
            style={{ width: 120 }}
            onChange={v => handleRoleChange(record.id, v)}
            options={[
              { value: 'user',  label: 'User'  },
              { value: 'admin', label: 'Admin' },
            ]}
          />
        )
      },
    },
    {
      title: 'Pages',
      key: 'permissions',
      render: (_, record) => {
        if (record.email === DEVELOPER_EMAIL) return <Tag color="volcano">All (Developer)</Tag>
        const perms = record.page_permissions || DEFAULT_PERMISSIONS[record.role] || ''
        const pages = perms.split(',').filter(Boolean)
        return (
          <Space wrap size={[2, 2]}>
            {pages.map(p => {
              const page = ALL_PAGES.find(x => x.key === p)
              return <Tag key={p} style={{ fontSize: 11 }}>{page?.label || p}</Tag>
            })}
          </Space>
        )
      },
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'active',
      width: 70,
      render: (active, record) => (
        <Switch
          size="small"
          checked={active}
          disabled={record.email === DEVELOPER_EMAIL || record.email === currentUser?.email}
          onChange={v => handleActiveToggle(record.id, v)}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 130,
      render: (_, record) => {
        if (record.email === DEVELOPER_EMAIL) return null
        const isSelf = record.email === currentUser?.email
        const canEdit = isDeveloper || record.role !== 'admin'
        return (
          <Space>
            {isDeveloper && !isSelf && (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => { impersonate(record); navigate('/instructions') }}
              />
            )}
            {canEdit && !isSelf && (
              <Button
                size="small"
                icon={<SettingOutlined />}
                onClick={() => setPermTarget(record)}
              />
            )}
            {!isSelf && (
              <Popconfirm
                title="Remove this user?"
                description="They will no longer be able to log in."
                onConfirm={() => handleRemove(record.id)}
                okText="Remove"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger type="text">Remove</Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Approved Users</Typography.Title>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setAddModal(true)}>
          Add User
        </Button>
      </div>

      <Card>
        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
        />
      </Card>

      <Modal
        title="Add User"
        open={addModal}
        onOk={handleAdd}
        onCancel={() => { setAddModal(false); form.resetFields() }}
        confirmLoading={saving}
        okText="Add"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="email"
            label="Google Email"
            rules={[
              { required: true, message: 'Required' },
              { type: 'email', message: 'Must be a valid email' },
            ]}
          >
            <Input placeholder="name@example.com" />
          </Form.Item>
          <Form.Item name="role" label="Role" initialValue="user">
            <Select
              options={[
                { value: 'user',  label: 'User — limited page access' },
                { value: 'admin', label: 'Admin — full access' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <PermissionsModal
        open={!!permTarget}
        onClose={() => setPermTarget(null)}
        target={permTarget}
        currentUser={currentUser}
        onChange={load}
      />
    </>
  )
}
