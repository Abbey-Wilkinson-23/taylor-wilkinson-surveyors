import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space,
  Input, Select, DatePicker, Row, Col, Typography, message, Spin, Popconfirm,
} from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getSurveyor, updateSurveyor, deleteSurveyor, restoreSurveyor,
  getSurveyTypes, getClients,
  setSurveyorCoverage, setSurveyorClientExclusions,
  getPostcodeFeeTypes,
} from '../api/client'

const { Text, Title } = Typography

const FEE_ORDER = ['QUOTABLE', 'HIGHER', 'STANDARD', 'Quotable', 'Higher', 'Standard']
const sortFeeCats = (cats) =>
  [...cats].sort((a, b) => {
    const ai = FEE_ORDER.indexOf(a)
    const bi = FEE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

function formatPiCover(v) {
  if (v == null) return '—'
  const n = Number(v)
  if (n >= 1_000_000 && n % 1_000_000 === 0) return `£${n / 1_000_000}M`
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000 && n % 1_000 === 0) return `£${n / 1_000}K`
  if (n >= 1_000) return `£${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `£${n.toFixed(2)}`
}

function PiExpiryDate({ date }) {
  if (!date) return <Text type="secondary">—</Text>
  const d = dayjs(date)
  const daysLeft = d.diff(dayjs().startOf('day'), 'day')
  const color = daysLeft < 0 ? '#cf1322' : daysLeft <= 30 ? '#d4780a' : undefined
  return (
    <Text style={color ? { color, fontWeight: 600 } : undefined}>
      {d.format('DD/MM/YYYY')}
      {daysLeft < 0 && ' (expired)'}
      {daysLeft >= 0 && daysLeft <= 30 && ` (${daysLeft}d left)`}
    </Text>
  )
}

const FIRM_TYPE_LABELS = {
  sole_trader: 'Sole Trader',
  partnership: 'Partnership',
  limited_company: 'Limited Company',
}

const CARD_STYLE = { marginBottom: 16 }
const SECTION_LABEL_STYLE = { width: 160, color: '#888', fontWeight: 500 }

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

// Sort outward codes alphabetically by letter prefix, then numerically by
// the number suffix (so CA2 comes before CA10, not after).
function compareOutwardCodes(a, b) {
  const pa = a.match(/^([A-Za-z]+)(\d+)$/)
  const pb = b.match(/^([A-Za-z]+)(\d+)$/)
  if (pa && pb) {
    if (pa[1] !== pb[1]) return pa[1].localeCompare(pb[1])
    return parseInt(pa[2], 10) - parseInt(pb[2], 10)
  }
  return a.localeCompare(b)
}

function CoverageTags({ coverage }) {
  if (!coverage.length) return <Text type="secondary">None set</Text>
  const sorted = [...coverage].sort((a, b) => {
    if (a.distance_band === b.distance_band) return compareOutwardCodes(a.code, b.code)
    return (a.distance_band === '25' ? 1 : 0) - (b.distance_band === '25' ? 1 : 0)
  })
  return (
    <Space wrap size={4}>
      {sorted.map(c => (
        <Tag
          key={c.code}
          style={c.distance_band === '25' ? { color: '#8753A8', borderColor: '#8753A8' } : undefined}
        >
          {c.code}
        </Tag>
      ))}
    </Space>
  )
}

// Wraps a read-only value so it becomes double-clickable to start editing
function Editable({ field, editingField, onStart, display, children }) {
  if (editingField === field) return children
  return (
    <span
      onDoubleClick={onStart}
      style={{ cursor: 'default', display: 'inline-block', minWidth: 40 }}
      title="Double-click to edit"
    >
      {display ?? '—'}
    </span>
  )
}

export default function SurveyorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [surveyor, setSurveyor] = useState(null)
  const [surveyTypes, setSurveyTypes] = useState([])
  const [clients, setClients] = useState([])
  const [feeTypes, setFeeTypes] = useState([])
  const [loading, setLoading] = useState(true)

  // Single active field being edited (double-click / click-out pattern)
  const [editingField, setEditingField] = useState(null)
  const [editingValue, setEditingValue] = useState(null)
  const editingValueRef = useRef(null) // always holds latest value, avoids stale closure in onBlur

  // Notes
  const [notesEditing, setNotesEditing] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  // Coverage postcodes (both bands saved together)
  const [coverageEditing, setCoverageEditing] = useState(false)
  const [coverage15Value, setCoverage15Value] = useState([])
  const [coverage25Value, setCoverage25Value] = useState([])

  // Cannot Work For
  const [exclusionsEditing, setExclusionsEditing] = useState(false)
  const [exclusionsValue, setExclusionsValue] = useState([])

  const load = async () => {
    setLoading(true)
    try {
      const data = await getSurveyor(id)
      setSurveyor(data)
      setNotesValue(data.notes || '')
      setCoverage15Value(
        data.coverage
          .filter(c => c.distance_band === '15' || !c.distance_band)
          .sort((a, b) => compareOutwardCodes(a.code, b.code))
          .map(c => c.code)
      )
      setCoverage25Value(
        data.coverage
          .filter(c => c.distance_band === '25')
          .sort((a, b) => compareOutwardCodes(a.code, b.code))
          .map(c => c.code)
      )
      setExclusionsValue(data.excluded_client_ids)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    getSurveyTypes().then(setSurveyTypes)
    getClients().then(setClients)
    getPostcodeFeeTypes().then(setFeeTypes)
  }, [id])

  // ── Field-level save ───────────────────────────────────────────────────────

  const startEdit = (field, value) => {
    setEditingField(field)
    setEditingValue(value)
    editingValueRef.current = value
  }

  const cancelEdit = () => setEditingField(null)

  const commit = async (field, value) => {
    setEditingField(null)
    const payload = {}
    if (field === 'work_types') {
      payload.work_types = (value || []).join(', ') || null
    } else if (field === 'fee_cat') {
      payload.fee_cat = sortFeeCats(value || []).join(',') || null
    } else if (field === 'pi_expiry_date') {
      payload.pi_expiry_date = value ? value.format('YYYY-MM-DD') : null
    } else if (field === 'base_postcode') {
      payload.base_postcode = value?.trim().toUpperCase() || null
    } else {
      payload[field] = value !== '' && value != null ? value : null
    }
    try {
      const updated = await updateSurveyor(id, payload)
      setSurveyor(updated)
    } catch {
      message.error('Failed to save')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteSurveyor(id)
      message.success('Surveyor deleted')
      navigate('/surveyors')
    } catch {
      message.error('Failed to delete surveyor')
    }
  }

  const handleNotesSave = async () => {
    setNotesSaving(true)
    try {
      await updateSurveyor(id, { notes: notesValue || null })
      setSurveyor(prev => ({ ...prev, notes: notesValue || null }))
      setNotesEditing(false)
    } catch {
      message.error('Failed to save notes')
    } finally {
      setNotesSaving(false)
    }
  }

  const saveCoverage = async () => {
    setCoverageEditing(false)
    try {
      const coverage15 = coverage15Value.map(code => ({ code: code.toUpperCase(), distance_band: '15' }))
      const coverage25 = coverage25Value.map(code => ({ code: code.toUpperCase(), distance_band: '25' }))
      const updated = await setSurveyorCoverage(id, [...coverage15, ...coverage25])
      setSurveyor(updated)
    } catch {
      message.error('Failed to save coverage')
    }
  }

  const saveExclusions = async () => {
    setExclusionsEditing(false)
    try {
      const updated = await setSurveyorClientExclusions(id, exclusionsValue || [])
      setSurveyor(updated)
    } catch {
      message.error('Failed to save')
    }
  }

  const handleRestore = async () => {
    try {
      await restoreSurveyor(id)
      message.success('Surveyor restored')
      load()
    } catch {
      message.error('Failed to restore surveyor')
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const textField = (field, currentDisplay, currentValue, inputProps = {}) => (
    <Editable field={field} editingField={editingField} onStart={() => startEdit(field, currentValue ?? '')} display={currentDisplay}>
      <Input
        size="small"
        autoFocus
        value={editingValue}
        onChange={e => { setEditingValue(e.target.value); editingValueRef.current = e.target.value }}
        onBlur={() => commit(field, editingValueRef.current)}
        onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
        style={{ width: 200 }}
        {...inputProps}
      />
    </Editable>
  )

  const selectField = (field, currentDisplay, currentValue, options, extraProps = {}) => (
    <Editable field={field} editingField={editingField} onStart={() => startEdit(field, currentValue)} display={currentDisplay}>
      <Select
        size="small"
        autoFocus
        defaultOpen
        allowClear
        style={{ minWidth: 200 }}
        value={editingValue}
        options={options}
        onChange={v => commit(field, v ?? null)}
        onDropdownVisibleChange={open => { if (!open) cancelEdit() }}
        {...extraProps}
      />
    </Editable>
  )

  const dateField = (field, currentDisplay, currentValue) => (
    <Editable field={field} editingField={editingField} onStart={() => startEdit(field, currentValue)} display={currentDisplay}>
      <DatePicker
        size="small"
        autoFocus
        defaultOpen
        format="DD/MM/YYYY"
        value={editingValue}
        onChange={date => { if (date) commit(field, date); else cancelEdit() }}
        onOpenChange={open => { if (!open) cancelEdit() }}
      />
    </Editable>
  )

  if (loading) return <Spin style={{ display: 'block', marginTop: 80 }} />
  if (!surveyor) return <Text>Surveyor not found.</Text>

  const fullName = [surveyor.first_name, surveyor.last_name].filter(Boolean).join(' ') || 'Unnamed Surveyor'

  const feeCats = surveyor.fee_cat ? surveyor.fee_cat.split(',').filter(Boolean) : []
  const workTypeList = surveyor.work_types ? surveyor.work_types.split(/,\s*/).filter(Boolean) : []

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/surveyors')}>Back</Button>
        <Space>
          {surveyor.is_active ? (
            <Popconfirm
              title="Delete this surveyor?"
              onConfirm={handleDelete}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          ) : (
            <Button icon={<UndoOutlined />} onClick={handleRestore}>Restore</Button>
          )}
        </Space>
      </div>

      {/* Header */}
      <Card style={CARD_STYLE} styles={{ body: { padding: '20px 24px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>{fullName}</Title>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {surveyor.surveyor_number && (
                <Text type="secondary" style={{ fontSize: 13 }}>#{surveyor.surveyor_number}</Text>
              )}
              {surveyor.company_name && (
                <Text type="secondary" style={{ fontSize: 13 }}>{surveyor.surveyor_number ? '·' : ''} {surveyor.company_name}</Text>
              )}
              {surveyor.firm_type && (
                <Tag style={{ marginLeft: 4 }}>{FIRM_TYPE_LABELS[surveyor.firm_type]}</Tag>
              )}
              {!surveyor.is_active && <Tag color="red">Deleted</Tag>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>PI Cover</Text>
            {textField('pi_cover_amount', formatPiCover(surveyor.pi_cover_amount), surveyor.pi_cover_amount ?? '', { type: 'number', min: 0, step: '0.01', prefix: '£', style: { width: 140 } })}
          </div>
        </div>
      </Card>

      {/* Contact + Firm */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <SectionCard title="Contact">
            <Descriptions column={1} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
              <Descriptions.Item label="Surveyor No.">
                {textField('surveyor_number', surveyor.surveyor_number, surveyor.surveyor_number)}
              </Descriptions.Item>
              <Descriptions.Item label="First Name">
                {textField('first_name', surveyor.first_name, surveyor.first_name)}
              </Descriptions.Item>
              <Descriptions.Item label="Last Name">
                {textField('last_name', surveyor.last_name, surveyor.last_name)}
              </Descriptions.Item>
              <Descriptions.Item label="Qualification">
                {textField('qualification', surveyor.qualification, surveyor.qualification, { placeholder: 'e.g. FRICS, MRICS' })}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {textField('email', surveyor.email, surveyor.email)}
              </Descriptions.Item>
              <Descriptions.Item label="Work Phone">
                {textField('phone', surveyor.phone, surveyor.phone)}
              </Descriptions.Item>
              <Descriptions.Item label="Personal Phone">
                {textField('personal_phone', surveyor.personal_phone, surveyor.personal_phone)}
              </Descriptions.Item>
            </Descriptions>
          </SectionCard>
        </Col>
        <Col xs={24} md={12}>
          <SectionCard title="Firm">
            <Descriptions column={1} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
              <Descriptions.Item label="Company">
                {textField('company_name', surveyor.company_name, surveyor.company_name, { placeholder: 'Leave blank if sole trader' })}
              </Descriptions.Item>
              <Descriptions.Item label="Firm Type">
                {selectField(
                  'firm_type',
                  FIRM_TYPE_LABELS[surveyor.firm_type] || '—',
                  surveyor.firm_type,
                  Object.entries(FIRM_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
                )}
              </Descriptions.Item>
              <Descriptions.Item label="No. of Partners">
                {textField('num_partners', surveyor.num_partners ?? '—', surveyor.num_partners ?? '', { type: 'number', min: 1, style: { width: 100 } })}
              </Descriptions.Item>
              <Descriptions.Item label="PI Expiry">
                {dateField(
                  'pi_expiry_date',
                  <PiExpiryDate date={surveyor.pi_expiry_date} />,
                  surveyor.pi_expiry_date ? dayjs(surveyor.pi_expiry_date) : null
                )}
              </Descriptions.Item>
            </Descriptions>
          </SectionCard>
        </Col>
      </Row>

      {/* Office Address */}
      <SectionCard title="Office Address">
        <Descriptions column={2} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
          <Descriptions.Item label="Address Line 1">
            {textField('office_address_line_1', surveyor.office_address_line_1, surveyor.office_address_line_1)}
          </Descriptions.Item>
          <Descriptions.Item label="Address Line 2">
            {textField('office_address_line_2', surveyor.office_address_line_2, surveyor.office_address_line_2)}
          </Descriptions.Item>
          <Descriptions.Item label="Town">
            {textField('office_town', surveyor.office_town, surveyor.office_town)}
          </Descriptions.Item>
          <Descriptions.Item label="County">
            {textField('office_county', surveyor.office_county, surveyor.office_county)}
          </Descriptions.Item>
          <Descriptions.Item label="Postcode">
            {textField('office_postcode', surveyor.office_postcode, surveyor.office_postcode, { style: { width: 140, textTransform: 'uppercase' } })}
          </Descriptions.Item>
          <Descriptions.Item label="Base Postcode">
            {textField('base_postcode', surveyor.base_postcode, surveyor.base_postcode, { style: { width: 140, textTransform: 'uppercase' }, placeholder: 'e.g. EH1 1AB' })}
          </Descriptions.Item>
        </Descriptions>
      </SectionCard>

      {/* Work Types + Fee Category */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <SectionCard title="Work Types">
            <Editable
              field="work_types"
              editingField={editingField}
              onStart={() => startEdit('work_types', workTypeList)}
              display={
                workTypeList.length > 0
                  ? <Space wrap size={4}>{workTypeList.map(w => <Tag key={w}>{w}</Tag>)}</Space>
                  : <Text type="secondary">None set</Text>
              }
            >
              <Select
                mode="multiple"
                size="small"
                autoFocus
                defaultOpen
                allowClear
                style={{ width: '100%' }}
                placeholder="Select work types"
                value={editingValue}
                options={surveyTypes.map(st => ({ value: st.name, label: st.name }))}
                onChange={v => { setEditingValue(v); editingValueRef.current = v }}
                onDropdownVisibleChange={open => { if (!open) commit('work_types', editingValueRef.current) }}
              />
            </Editable>
          </SectionCard>
        </Col>
        <Col xs={24} md={12}>
          <SectionCard title="Fee Category">
            <Editable
              field="fee_cat"
              editingField={editingField}
              onStart={() => startEdit('fee_cat', feeCats)}
              display={
                feeCats.length > 0
                  ? (
                    <Space wrap size={4}>
                      {sortFeeCats(feeCats).map(cat => {
                        const ft = feeTypes.find(f => f.name === cat)
                        return <Tag key={cat} color={ft?.colour || undefined}>{cat}</Tag>
                      })}
                    </Space>
                  )
                  : <Text type="secondary">None set</Text>
              }
            >
              <Select
                mode="multiple"
                size="small"
                autoFocus
                defaultOpen
                allowClear
                style={{ width: '100%' }}
                placeholder="Select fee types"
                value={editingValue}
                options={feeTypes.map(ft => ({ value: ft.name, label: ft.name }))}
                onChange={v => { setEditingValue(v); editingValueRef.current = v }}
                onDropdownVisibleChange={open => { if (!open) commit('fee_cat', editingValueRef.current) }}
              />
            </Editable>
          </SectionCard>
        </Col>
      </Row>

      {/* Coverage */}
      <SectionCard title="Coverage Postcodes">
        {coverageEditing ? (
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Within 15 miles</Text>
            <Select
              mode="tags"
              autoFocus
              tokenSeparators={[',', ' ']}
              placeholder="SW1A, E1, B1…"
              style={{ width: '100%', marginBottom: 12 }}
              value={coverage15Value}
              onChange={setCoverage15Value}
              options={[]}
              onBlur={saveCoverage}
            />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Within 25 miles (over 15)</Text>
            <Select
              mode="tags"
              tokenSeparators={[',', ' ']}
              placeholder="SW1A, E1, B1…"
              style={{ width: '100%' }}
              value={coverage25Value}
              onChange={setCoverage25Value}
              options={[]}
              onBlur={saveCoverage}
            />
          </div>
        ) : (
          <div onDoubleClick={() => setCoverageEditing(true)} style={{ cursor: 'default' }} title="Double-click to edit">
            <div style={{ marginBottom: surveyor.coverage.length > 0 ? 8 : 0 }}>
              <CoverageTags coverage={surveyor.coverage} />
            </div>
            {surveyor.coverage.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, background: '#d9d9d9', borderRadius: 2, marginRight: 4 }} />
                  Within 15 miles ({surveyor.coverage.filter(c => c.distance_band !== '25').length})
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, background: '#8753A8', borderRadius: 2, marginRight: 4, opacity: 0.4 }} />
                  Within 25 miles ({surveyor.coverage.filter(c => c.distance_band === '25').length})
                </Text>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Cannot Work For */}
      <SectionCard title="Cannot Work For">
        {exclusionsEditing ? (
          <Select
            mode="multiple"
            autoFocus
            defaultOpen
            optionFilterProp="label"
            placeholder="Select clients"
            style={{ width: '100%' }}
            value={exclusionsValue}
            options={clients.map(c => ({ value: c.id, label: c.company_name }))}
            onChange={setExclusionsValue}
            onDropdownVisibleChange={open => { if (!open) saveExclusions() }}
          />
        ) : (
          <div onDoubleClick={() => setExclusionsEditing(true)} style={{ cursor: 'default' }} title="Double-click to edit">
            <Space wrap size={4}>
              {surveyor.excluded_client_names.length > 0
                ? surveyor.excluded_client_names.map(n => <Tag key={n} color="red">{n}</Tag>)
                : <Text type="secondary">No exclusions</Text>}
            </Space>
          </div>
        )}
      </SectionCard>

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
            {surveyor.notes
              ? <Text style={{ whiteSpace: 'pre-wrap' }}>{surveyor.notes}</Text>
              : <Text type="secondary" style={{ fontStyle: 'italic' }}>Double-click to add notes…</Text>}
          </div>
        )}
      </SectionCard>
    </>
  )
}
