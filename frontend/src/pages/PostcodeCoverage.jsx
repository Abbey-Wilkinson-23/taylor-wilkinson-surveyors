import { useEffect, useState, useMemo } from 'react'
import {
  Table, Input, Select, Button, Tag, Card, Space, Modal, Form, message, Popconfirm
} from 'antd'
import { PlusOutlined, SearchOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { getPostcodeSurveyors, addPostcodeSurveyor, updatePostcodeSurveyor, deletePostcodeSurveyor } from '../api/client'
import { useAuth } from '../context/AuthContext'

const { Option } = Select

const POSTCODE_EDITOR = 'abbeywilkinson123@gmail.com'
const FEE_COLOURS = { STANDARD: 'green', QUOTABLE: 'red', HIGHER: 'gold' }
const FEE_LABELS  = { STANDARD: 'Standard', QUOTABLE: 'Quotable only', HIGHER: 'Higher fee' }
const PREF_LABELS = { '##': '★★ Top pick', '#': '★ Preferred', '': '' }

// Parse coverage string into individual district codes and leftover notes
function parseCoverage(str) {
  if (!str) return { codes: [], notes: '' }
  const codes = []
  // Replace em-dashes with hyphens, split on commas/newlines
  const cleaned = str.replace(/–/g, '-').replace(/\n/g, ' ')
  // Pull out all numeric tokens (plain numbers or ranges like 10-16)
  const remaining = cleaned.replace(/\b(\d+)\s*-\s*(\d+)\b/g, (_, a, b) => {
    const start = parseInt(a), end = parseInt(b)
    if (end - start < 50) { // sanity cap — don't expand huge ranges
      for (let i = start; i <= end; i++) codes.push(String(i))
    } else {
      codes.push(`${a}-${b}`)
    }
    return ''
  }).replace(/\b(\d+)\b/g, (_, n) => { codes.push(n); return '' })
  const notes = remaining.replace(/[,\s]+/g, ' ').trim()
  return { codes: [...new Set(codes)].sort((a, b) => parseInt(a) - parseInt(b)), notes }
}

function SurveyorModal({ open, onClose, onSave, initial }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial

  useEffect(() => {
    if (open) {
      form.setFieldsValue(initial ? {
        postcode_area: initial.postcode_area,
        name:          initial.name,
        preferred:     initial.preferred || undefined,
        coverage:      initial.coverage,
        work_types:    initial.work_types ? initial.work_types.split(',').map(w => w.trim()).filter(Boolean) : [],
        fee_cat:       initial.fee_cat ? initial.fee_cat.split(',') : [],
      } : { fee_cat: ['STANDARD'] })
    }
  }, [open, initial])

  const handleOk = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await onSave(values)
      form.resetFields()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Surveyor' : 'Add Surveyor'}
      open={open}
      onCancel={() => { form.resetFields(); onClose() }}
      onOk={handleOk}
      okText={isEdit ? 'Save' : 'Add'}
      confirmLoading={saving}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="postcode_area" label="Postcode Area" rules={[{ required: true }]}>
          <Input placeholder="e.g. SW" style={{ textTransform: 'uppercase' }} />
        </Form.Item>
        <Form.Item name="name" label="Surveyor / Firm Name" rules={[{ required: true }]}>
          <Input placeholder="e.g. John Smith (123) Acme Surveyors" />
        </Form.Item>
        <Form.Item name="preferred" label="Preference">
          <Select allowClear placeholder="None">
            <Option value="##">★★ Top pick (##)</Option>
            <Option value="#">★ Preferred (#)</Option>
          </Select>
        </Form.Item>
        <Form.Item name="coverage" label="Coverage">
          <Input.TextArea rows={2} placeholder="e.g. 1-10, 15, 20-25 (check distance)" />
        </Form.Item>
        <Form.Item name="work_types" label="Work Types">
          <Select mode="multiple" placeholder="Select work types" allowClear>
            <Option value="R">Residential (R)</Option>
            <Option value="C">Commercial (C)</Option>
            <Option value="GDV">GDV</Option>
            <Option value="Homebuyers">Homebuyers</Option>
            <Option value="HMO">HMO</Option>
            <Option value="Building Survey">Building Survey</Option>
            <Option value="Agricultural">Agricultural</Option>
            <Option value="Private Resi">Private Resi</Option>
            <Option value="L2">L2</Option>
            <Option value="L3">L3</Option>
            <Option value="Land Registry">Land Registry</Option>
            <Option value="Dilapidations">Schedule of Conditions / Dilapidations</Option>
          </Select>
        </Form.Item>
        <Form.Item name="fee_cat" label="Fee Category" rules={[{ required: true, type: 'array', min: 1 }]}>
          <Select mode="multiple">
            <Option value="STANDARD">Standard fee scale</Option>
            <Option value="QUOTABLE">Quotable work only</Option>
            <Option value="HIGHER">Higher / fix / min fee</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function PostcodeCoverage() {
  const { user } = useAuth()
  const canEdit = user?.email === POSTCODE_EDITOR

  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState('')
  const [areaFilter, setArea]     = useState(null)
  const [feeFilter, setFee]       = useState(null)
  const [workFilter, setWork]     = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)  // null = add mode, object = edit mode
  const [pageSize, setPageSize]   = useState(50)

  const load = async () => {
    setLoading(true)
    try { setData(await getPostcodeSurveyors()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const areas = useMemo(() => [...new Set(data.map(r => r.postcode_area))].sort(), [data])

  const filtered = useMemo(() => data.filter(r => {
    if (areaFilter && r.postcode_area !== areaFilter) return false
    if (feeFilter  && !r.fee_cat.split(',').includes(feeFilter)) return false
    if (workFilter && !r.work_types.split(',').map(w => w.trim()).includes(workFilter)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return [r.postcode_area, r.name, r.coverage].some(v => v?.toLowerCase().includes(q))
  }), [data, areaFilter, feeFilter, workFilter, search])

  const openAdd  = ()  => { setEditing(null); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r);    setModalOpen(true) }
  const closeModal = () => setModalOpen(false)

  const handleSave = async (values) => {
    const payload = {
      postcode_area: values.postcode_area.toUpperCase().trim(),
      name:          values.name.trim(),
      preferred:     values.preferred || '',
      coverage:      values.coverage  || '',
      work_types:    (values.work_types || []).join(','),
      fee_cat:       values.fee_cat.join(','),
    }
    try {
      if (editing) {
        const updated = await updatePostcodeSurveyor(editing.id, payload)
        setData(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Surveyor updated')
      } else {
        const created = await addPostcodeSurveyor(payload)
        setData(prev => [...prev, created])
        message.success('Surveyor added')
      }
      closeModal()
    } catch {
      message.error(editing ? 'Failed to update' : 'Failed to add')
      throw new Error() // keep modal open
    }
  }

  const handleDelete = async (id) => {
    try {
      await deletePostcodeSurveyor(id)
      setData(prev => prev.filter(r => r.id !== id))
      message.success('Removed')
    } catch {
      message.error('Failed to remove')
    }
  }

  const columns = [
    {
      title: 'No.',
      dataIndex: 'surveyor_number',
      key: 'surveyor_number',
      width: 80,
      sorter: (a, b) => {
        const n = s => parseInt((s?.surveyor_number || '').match(/\d+/)?.[0] ?? '0', 10)
        return n(a) - n(b)
      },
      render: v => <span style={{ color: '#888', fontSize: 12 }}>{v || '—'}</span>,
    },
    {
      title: 'Area',
      dataIndex: 'postcode_area',
      key: 'postcode_area',
      width: 70,
      sorter: (a, b) => a.postcode_area.localeCompare(b.postcode_area),
      render: v => <span style={{ fontWeight: 700, color: '#794899' }}>{v}</span>,
    },
    {
      title: 'Surveyor / Firm',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name, r) => (
        <span>
          {name}
          {r.preferred && (
            <Tag color="purple" style={{ marginLeft: 6, fontSize: 11 }}>
              {PREF_LABELS[r.preferred]}
            </Tag>
          )}
          {r.is_custom && (
            <Tag color="purple" style={{ marginLeft: 4, fontSize: 10 }}>added</Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Coverage',
      dataIndex: 'coverage',
      key: 'coverage',
      render: v => {
        if (!v) return <span style={{ color: '#bbb' }}>—</span>
        const lower = v.toLowerCase()
        if (lower.includes('all')) return (
          <div>
            <Tag color="blue">All</Tag>
            {v.replace(/all/i, '').replace(/[()]/g, '').trim() &&
              <span style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>
                {v.replace(/all/i, '').replace(/[()]/g, '').trim()}
              </span>
            }
          </div>
        )
        const { codes, notes } = parseCoverage(v)
        return (
          <div>
            <Space wrap size={[2, 2]}>
              {codes.map(c => <Tag key={c} style={{ margin: 0 }}>{c}</Tag>)}
            </Space>
            {notes && <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{notes}</div>}
          </div>
        )
      },
    },
    {
      title: 'Work Types',
      dataIndex: 'work_types',
      key: 'work_types',
      width: 110,
    },
    {
      title: 'Fee Category',
      dataIndex: 'fee_cat',
      key: 'fee_cat',
      width: 180,
      sorter: (a, b) => a.fee_cat.localeCompare(b.fee_cat),
      render: v => (
        <Space wrap size={2}>
          {(v || '').split(',').filter(Boolean).map(cat => (
            <Tag key={cat} color={FEE_COLOURS[cat]}>{FEE_LABELS[cat]}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, r) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() => openEdit(r)}
          />
          <Popconfirm
            title="Remove this surveyor?"
            onConfirm={() => handleDelete(r.id)}
            okText="Remove"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search by name, firm or coverage…"
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <Select
          placeholder="Postcode area"
          allowClear
          showSearch
          style={{ width: 150 }}
          value={areaFilter}
          onChange={v => setArea(v || null)}
          options={areas.map(a => ({ value: a, label: a }))}
        />
        <Select
          placeholder="Fee type"
          allowClear
          style={{ width: 160 }}
          value={feeFilter}
          onChange={v => setFee(v || null)}
        >
          <Option value="STANDARD">Standard fee scale</Option>
          <Option value="QUOTABLE">Quotable work only</Option>
          <Option value="HIGHER">Higher / fix / min fee</Option>
        </Select>
        <Select
          placeholder="Work type"
          allowClear
          style={{ width: 180 }}
          value={workFilter}
          onChange={v => setWork(v || null)}
        >
          <Option value="R">Residential (R)</Option>
          <Option value="C">Commercial (C)</Option>
          <Option value="GDV">GDV</Option>
          <Option value="Homebuyers">Homebuyers</Option>
          <Option value="HMO">HMO</Option>
          <Option value="Building Survey">Building Survey</Option>
          <Option value="Agricultural">Agricultural</Option>
          <Option value="Private Resi">Private Resi</Option>
          <Option value="L2">L2</Option>
          <Option value="L3">L3</Option>
          <Option value="Land Registry">Land Registry</Option>
          <Option value="Dilapidations">Dilapidations</Option>
        </Select>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          Add Surveyor
        </Button>
      </div>

      <div style={{ marginBottom: 8, color: '#888', fontSize: 13 }}>
        {filtered.length} surveyor{filtered.length !== 1 ? 's' : ''} shown
      </div>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200], onShowSizeChange: (_, size) => setPageSize(size) }}
        scroll={{ x: true }}
        rowClassName={r => r.is_custom ? 'custom-postcode-row' : ''}
      />

      <SurveyorModal
        open={modalOpen}
        onClose={closeModal}
        onSave={handleSave}
        initial={editing}
      />

      <style>{`.custom-postcode-row td { background: #f9f0ff !important; }`}</style>
    </Card>
  )
}
