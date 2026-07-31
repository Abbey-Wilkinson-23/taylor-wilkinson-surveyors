import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Table, Input, Select, Button, Tag, Card, Space, Modal, Form, message, Popconfirm, Tooltip, Tabs
} from 'antd'
import { PlusOutlined, SearchOutlined, DeleteOutlined, EditOutlined, SettingOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  getPostcodeSurveyors, addPostcodeSurveyor, updatePostcodeSurveyor, deletePostcodeSurveyor,
  getPostcodeWorkTypes, addPostcodeWorkType, updatePostcodeWorkType, deletePostcodeWorkType,
  getPostcodeFeeTypes, addPostcodeFeeType, updatePostcodeFeeType, deletePostcodeFeeType,
} from '../api/client'
import { useAuth } from '../context/AuthContext'

const { Option } = Select

const POSTCODE_EDITOR = 'abbeywilkinson123@gmail.com'
const PREF_LABELS = { '##': '★★ Top pick', '#': '★ Preferred', '': '' }

const FEE_ORDER = ['QUOTABLE', 'HIGHER', 'STANDARD', 'Quotable', 'Higher', 'Standard']
const sortFeeCats = (cats) =>
  [...cats].sort((a, b) => {
    const ai = FEE_ORDER.indexOf(a)
    const bi = FEE_ORDER.indexOf(b)
    // Known types sorted by order; unknowns go at the end alphabetically
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

// Parse coverage string into individual district codes and leftover notes
function parseCoverage(str) {
  if (!str) return { codes: [], notes: '' }
  const codes = []
  // Replace em-dashes with hyphens, split on commas/newlines
  const cleaned = str.replace(/–/g, '-').replace(/\n/g, ' ')
  // Pull out all numeric tokens (plain numbers or ranges like 10-16)
  const remaining = cleaned.replace(/\b(\d+)\s*-\s*(\d+)\b/g, (match, a, b, offset) => {
    // Don't extract if preceded by £
    if (offset > 0 && cleaned[offset - 1] === '£') return match
    const start = parseInt(a), end = parseInt(b)
    if (end - start < 50) { // sanity cap — don't expand huge ranges
      for (let i = start; i <= end; i++) codes.push(String(i))
    } else {
      codes.push(`${a}-${b}`)
    }
    return ''
  }).replace(/(?<!£)\b(\d+)\b/g, (_, n) => { codes.push(n); return '' })
  const notes = remaining.replace(/[,\s]+/g, ' ').trim()
  return { codes: [...new Set(codes)].sort((a, b) => parseInt(a) - parseInt(b)), notes }
}

// Select that closes when the mouse leaves the dropdown area
function HoverSelect({ children, ...props }) {
  const [forceClose, setForceClose] = useState(false)
  const timerRef = useRef(null)
  const clear = () => clearTimeout(timerRef.current)
  const scheduleClose = () => { timerRef.current = setTimeout(() => setForceClose(true), 200) }
  const cancelClose  = () => { clear(); setForceClose(false) }
  return (
    <div onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
      <Select
        open={forceClose ? false : undefined}
        onDropdownVisibleChange={v => { if (v) cancelClose() }}
        dropdownRender={menu => (
          <div onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>{menu}</div>
        )}
        style={{ width: '100%' }}
        {...props}
      >
        {children}
      </Select>
    </div>
  )
}

function SurveyorModal({ open, onClose, onSave, initial, workTypes = [], feeTypes = [] }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial

  useEffect(() => {
    if (open) {
      form.setFieldsValue(initial ? {
        postcode_area:   initial.postcode_area,
        name:            initial.name.replace(/\s*\([\d\s,&–\-]+\)\s*/g, ' ').trim(),
        surveyor_number: initial.surveyor_number || '',
        preferred:       initial.preferred || undefined,
        coverage:        initial.coverage,
        work_types:      initial.work_types ? initial.work_types.split(/,|\s*\/\s*/).map(w => w.trim()).filter(Boolean) : [],
        fee_cat:         initial.fee_cat ? initial.fee_cat.split(',') : [],
      } : { fee_cat: [] })
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
          <Input placeholder="e.g. John Smith" />
        </Form.Item>
        <Form.Item name="surveyor_number" label="Surveyor Number">
          <Input placeholder="e.g. 123 or 160-169 or 758, 761 & 774" />
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
          <HoverSelect mode="multiple" placeholder="Select work types" allowClear>
            {workTypes.map(wt => <Option key={wt.id} value={wt.name}>{wt.name}</Option>)}
          </HoverSelect>
        </Form.Item>
        <Form.Item name="fee_cat" label="Fee Category" rules={[{ required: true, type: 'array', min: 1 }]}>
          <HoverSelect mode="multiple" placeholder="Select fee types">
            {feeTypes.map(ft => <Option key={ft.id} value={ft.name}>{ft.name}</Option>)}
          </HoverSelect>
        </Form.Item>
      </Form>
    </Modal>
  )
}

function WorkTypeManager({ workTypes, onChange }) {
  const [newName, setNewName]     = useState('')
  const [editingWt, setEditingWt] = useState(null) // { id, name }
  const [editName, setEditName]   = useState('')
  const [saving, setSaving]       = useState(false)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await addPostcodeWorkType({ name: newName.trim() })
      setNewName('')
      onChange()
    } catch {
      message.error('Failed to add — may already exist')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (id) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await updatePostcodeWorkType(id, { name: editName.trim() })
      setEditingWt(null)
      onChange()
    } catch {
      message.error('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deletePostcodeWorkType(id)
      onChange()
    } catch {
      message.error('Failed to delete')
    }
  }

  const content = (
    <>
      <div style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="New work type name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onPressEnter={handleAdd}
          />
          <Button type="primary" icon={<PlusOutlined />} loading={saving} onClick={handleAdd}>
            Add
          </Button>
        </Space.Compact>
      </div>
      <Table
        dataSource={workTypes}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          {
            title: 'Name',
            dataIndex: 'name',
            render: (name, r) => editingWt?.id === r.id
              ? <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onPressEnter={() => handleEdit(r.id)}
                  size="small"
                  autoFocus
                />
              : name,
          },
          {
            title: '',
            width: 80,
            render: (_, r) => editingWt?.id === r.id
              ? <Space>
                  <Button size="small" type="primary" loading={saving} onClick={() => handleEdit(r.id)}>Save</Button>
                  <Button size="small" onClick={() => setEditingWt(null)}>Cancel</Button>
                </Space>
              : <Space>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditingWt(r); setEditName(r.name) }} />
                  <Popconfirm title="Delete this work type?" onConfirm={() => handleDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>,
          },
        ]}
      />
    </>
  )
  return content
}

const TAG_COLOURS = [
  'default', 'red', 'volcano', 'orange', 'gold', 'yellow',
  'lime', 'green', 'cyan', 'blue', 'geekblue', 'purple', 'magenta',
]

function ColourSelect({ value, onChange }) {
  return (
    <Select value={value || 'default'} onChange={onChange} style={{ width: 130 }} size="small">
      {TAG_COLOURS.map(c => (
        <Option key={c} value={c}>
          <Tag color={c} style={{ margin: 0 }}>{c}</Tag>
        </Option>
      ))}
    </Select>
  )
}

function FeeTypeManager({ feeTypes, onChange }) {
  const [newName, setNewName]     = useState('')
  const [newColour, setNewColour] = useState('default')
  const [editingFt, setEditingFt] = useState(null)
  const [editName, setEditName]   = useState('')
  const [editColour, setEditColour] = useState('default')
  const [saving, setSaving]       = useState(false)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await addPostcodeFeeType({ name: newName.trim(), colour: newColour === 'default' ? null : newColour })
      setNewName('')
      setNewColour('default')
      onChange()
    } catch {
      message.error('Failed to add — may already exist')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (id) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await updatePostcodeFeeType(id, { name: editName.trim(), colour: editColour === 'default' ? null : editColour })
      setEditingFt(null)
      onChange()
    } catch {
      message.error('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deletePostcodeFeeType(id)
      onChange()
    } catch {
      message.error('Failed to delete')
    }
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="New fee type name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onPressEnter={handleAdd}
          />
          <ColourSelect value={newColour} onChange={setNewColour} />
          <Button type="primary" icon={<PlusOutlined />} loading={saving} onClick={handleAdd}>
            Add
          </Button>
        </Space.Compact>
      </div>
      <Table
        dataSource={feeTypes}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          {
            title: 'Name',
            render: (_, r) => editingFt?.id === r.id
              ? <Space>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    size="small"
                    autoFocus
                    style={{ width: 160 }}
                  />
                  <ColourSelect value={editColour} onChange={setEditColour} />
                </Space>
              : <Tag color={r.colour || undefined}>{r.name}</Tag>,
          },
          {
            title: '',
            width: 100,
            render: (_, r) => editingFt?.id === r.id
              ? <Space>
                  <Button size="small" type="primary" loading={saving} onClick={() => handleEdit(r.id)}>Save</Button>
                  <Button size="small" onClick={() => setEditingFt(null)}>Cancel</Button>
                </Space>
              : <Space>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditingFt(r); setEditName(r.name); setEditColour(r.colour || 'default') }} />
                  <Popconfirm title="Delete this fee type?" onConfirm={() => handleDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>,
          },
        ]}
      />
    </>
  )
}

export default function PostcodeCoverage() {
  const { user } = useAuth()
  const canEdit = user?.email === POSTCODE_EDITOR

  const [data, setData]               = useState([])
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')
  const [areaFilter, setArea]         = useState(null)
  const [feeFilter, setFee]           = useState(null)
  const [workFilter, setWork]         = useState(null)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState(null)
  const [pageSize, setPageSize]       = useState(50)
  const [workTypes, setWorkTypes]     = useState([])
  const [feeTypes, setFeeTypes]       = useState([])
  const [settingsOpen, setSettings]   = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await getPostcodeSurveyors()) }
    finally { setLoading(false) }
  }

  const loadWorkTypes = async () => {
    setWorkTypes(await getPostcodeWorkTypes())
  }

  const loadFeeTypes = async () => {
    setFeeTypes(await getPostcodeFeeTypes())
  }

  useEffect(() => { load(); loadWorkTypes(); loadFeeTypes() }, [])

  const areas = useMemo(() => [...new Set(data.map(r => r.postcode_area))].sort(), [data])

  const filtered = useMemo(() => data.filter(r => {
    if (areaFilter && r.postcode_area !== areaFilter) return false
    if (feeFilter  && !r.fee_cat.split(',').includes(feeFilter)) return false
    if (workFilter && !r.work_types.split(/,|\s*\/\s*/).map(w => w.trim()).includes(workFilter)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return [r.postcode_area, r.name, r.coverage].some(v => v?.toLowerCase().includes(q))
  }), [data, areaFilter, feeFilter, workFilter, search])

  const openAdd  = ()  => { setEditing(null); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r);    setModalOpen(true) }
  const closeModal = () => setModalOpen(false)

  const handleSave = async (values) => {
    const payload = {
      postcode_area:   values.postcode_area.toUpperCase().trim(),
      name:            values.name.trim(),
      surveyor_number: values.surveyor_number?.trim() || null,
      preferred:       values.preferred || '',
      coverage:        values.coverage  || '',
      work_types:      (values.work_types || []).join(','),
      fee_cat:         sortFeeCats(values.fee_cat).join(','),
    }
    try {
      if (editing) {
        const updated = await updatePostcodeSurveyor(editing.id, payload)
        setData(prev => prev.map(r => r.id === updated.id ? updated : r))

        // Propagate fee_cat change to all rows with the same surveyor number
        const feeCatChanged = payload.fee_cat !== editing.fee_cat
        const siblings = payload.surveyor_number && feeCatChanged
          ? data.filter(r => r.id !== editing.id && r.surveyor_number === payload.surveyor_number)
          : []
        if (siblings.length > 0) {
          await Promise.all(siblings.map(r => updatePostcodeSurveyor(r.id, { fee_cat: payload.fee_cat })))
          setData(prev => prev.map(r =>
            r.id !== editing.id && r.surveyor_number === payload.surveyor_number
              ? { ...r, fee_cat: payload.fee_cat }
              : r
          ))
          message.success(`Updated — also applied to ${siblings.length} other area${siblings.length > 1 ? 's' : ''} with the same surveyor number`)
        } else {
          message.success('Surveyor updated')
        }
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
          {name.replace(/\s*\([\d\s,&–\-]+\)\s*/g, ' ').trim()}
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
      render: v => (v || '').split(/,|\s*\/\s*/).map(w => w.trim()).filter(Boolean).join(' / ') || '—',
    },
    {
      title: 'Fee Category',
      dataIndex: 'fee_cat',
      key: 'fee_cat',
      width: 180,
      sorter: (a, b) => a.fee_cat.localeCompare(b.fee_cat),
      render: v => (
        <Space wrap size={2}>
          {sortFeeCats((v || '').split(',').filter(Boolean)).map(cat => {
            const ft = feeTypes.find(f => f.name === cat)
            return <Tag key={cat} color={ft?.colour || undefined}>{cat}</Tag>
          })}
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
          style={{ width: 180 }}
          value={feeFilter}
          onChange={v => setFee(v || null)}
        >
          {feeTypes.map(ft => <Option key={ft.id} value={ft.name}>{ft.name}</Option>)}
        </Select>
        <Select
          placeholder="Work type"
          allowClear
          style={{ width: 180 }}
          value={workFilter}
          onChange={v => setWork(v || null)}
        >
          {workTypes.map(wt => <Option key={wt.id} value={wt.name}>{wt.name}</Option>)}
        </Select>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          Add Surveyor
        </Button>
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined />} onClick={() => { load(); loadWorkTypes(); loadFeeTypes() }} loading={loading} />
        </Tooltip>
        <Tooltip title="Settings">
          <Button icon={<SettingOutlined />} onClick={() => setSettings(true)} />
        </Tooltip>
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
        workTypes={workTypes}
        feeTypes={feeTypes}
      />

      <Modal
        title="Settings"
        open={settingsOpen}
        onCancel={() => setSettings(false)}
        footer={null}
        width={480}
      >
        <Tabs
          items={[
            {
              key: 'work-types',
              label: 'Work Types',
              children: <WorkTypeManager inline workTypes={workTypes} onChange={loadWorkTypes} />,
            },
            {
              key: 'fee-types',
              label: 'Fee Types',
              children: <FeeTypeManager inline feeTypes={feeTypes} onChange={loadFeeTypes} />,
            },
          ]}
        />
      </Modal>

      <style>{`.custom-postcode-row td { background: #f9f0ff !important; }`}</style>
    </Card>
  )
}
