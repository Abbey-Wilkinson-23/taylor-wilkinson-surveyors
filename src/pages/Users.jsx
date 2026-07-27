import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, Popconfirm, Switch, message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getUsers, addUser, updateUser, removeUser } from '../api/client'
import { useAuth } from '../context/AuthContext'

const { Text } = Typography

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

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

  const columns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email, record) => (
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
      width: 160,
      render: (role, record) => (
        <Select
          size="small"
          value={role}
          style={{ width: 120 }}
          disabled={record.email === currentUser?.email}
          onChange={v => handleRoleChange(record.id, v)}
          options={[
            { value: 'user',  label: 'User'  },
            { value: 'admin', label: 'Admin' },
          ]}
        />
      ),
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'active',
      width: 80,
      render: (active, record) => (
        <Switch
          size="small"
          checked={active}
          disabled={record.email === currentUser?.email}
          onChange={v => handleActiveToggle(record.id, v)}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, record) =>
        record.email !== currentUser?.email ? (
          <Popconfirm
            title="Remove this user?"
            description="They will no longer be able to log in."
            onConfirm={() => handleRemove(record.id)}
            okText="Remove"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger type="text">Remove</Button>
          </Popconfirm>
        ) : null,
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
                { value: 'user',  label: 'User — can access all pages except Stats' },
                { value: 'admin', label: 'Admin — full access including Stats and Users' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
