import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Space, Divider, Form,
  Input, Select, DatePicker, Row, Col, Typography, message, Spin, Popconfirm,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined, SaveOutlined, CloseOutlined, DeleteOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getSurveyor, updateSurveyor, deleteSurveyor, restoreSurveyor,
  getSurveyTypes, getClients,
  setSurveyorCoverage, setSurveyorClientExclusions,
  getPostcodeFeeTypes,
} from '../api/client'

const { Text, Title } = Typography

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

export default function SurveyorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [surveyor, setSurveyor] = useState(null)
  const [surveyTypes, setSurveyTypes] = useState([])
  const [clients, setClients] = useState([])
  const [feeTypes, setFeeTypes] = useState([])
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
      const data = await getSurveyor(id)
      setSurveyor(data)
      setNotesValue(data.notes || '')
      form.setFieldsValue({
        surveyor_number: data.surveyor_number,
        first_name: data.first_name,
        last_name: data.last_name,
        company_name: data.company_name,
        email: data.email,
        phone: data.phone,
        personal_phone: data.personal_phone,
        qualification: data.qualification,
        pi_cover_amount: data.pi_cover_amount,
        pi_expiry_date: data.pi_expiry_date ? dayjs(data.pi_expiry_date) : null,
        office_address_line_1: data.office_address_line_1,
        office_address_line_2: data.office_address_line_2,
        office_town: data.office_town,
        office_county: data.office_county,
        office_postcode: data.office_postcode,
        base_postcode: data.base_postcode,
        work_types: data.work_types ? data.work_types.split(/,|\s*\/\s*/).map(w => w.trim()).filter(Boolean) : [],
        fee_cat: data.fee_cat ? data.fee_cat.split(',').map(f => f.trim()).filter(Boolean) : [],
        firm_type: data.firm_type,
        num_partners: data.num_partners,
        notes: data.notes,
        coverage_15: data.coverage
          .filter(c => c.distance_band === '15' || !c.distance_band)
          .sort((a, b) => compareOutwardCodes(a.code, b.code))
          .map(c => c.code),
        coverage_25: data.coverage
          .filter(c => c.distance_band === '25')
          .sort((a, b) => compareOutwardCodes(a.code, b.code))
          .map(c => c.code),
        excluded_client_ids: data.excluded_client_ids,
      })
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

  const handleSave = async (values) => {
    setSaving(true)
    try {
      await updateSurveyor(id, {
        surveyor_number: values.surveyor_number || null,
        first_name: values.first_name,
        last_name: values.last_name,
        company_name: values.company_name || null,
        email: values.email,
        phone: values.phone,
        personal_phone: values.personal_phone || null,
        qualification: values.qualification || null,
        pi_cover_amount: values.pi_cover_amount || null,
        pi_expiry_date: values.pi_expiry_date ? values.pi_expiry_date.format('YYYY-MM-DD') : null,
        office_address_line_1: values.office_address_line_1 || null,
        office_address_line_2: values.office_address_line_2 || null,
        office_town: values.office_town || null,
        office_county: values.office_county || null,
        office_postcode: values.office_postcode || null,
        base_postcode: values.base_postcode?.trim().toUpperCase() || null,
        work_types: (values.work_types || []).join(', ') || null,
        fee_cat: (values.fee_cat || []).join(',') || null,
        firm_type: values.firm_type || null,
        num_partners: values.num_partners || null,
        notes: values.notes || null,
      })
      const coverage15 = (values.coverage_15 || []).map(code => ({ code: code.toUpperCase(), distance_band: '15' }))
      const coverage25 = (values.coverage_25 || []).map(code => ({ code: code.toUpperCase(), distance_band: '25' }))
      await setSurveyorCoverage(id, [...coverage15, ...coverage25])
      await setSurveyorClientExclusions(id, values.excluded_client_ids || [])
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

  const handleRestore = async () => {
    try {
      await restoreSurveyor(id)
      message.success('Surveyor restored')
      load()
    } catch {
      message.error('Failed to restore surveyor')
    }
  }

  if (loading) return <Spin style={{ display: 'block', marginTop: 80 }} />
  if (!surveyor) return <Text>Surveyor not found.</Text>

  const fullName = `${surveyor.first_name} ${surveyor.last_name}`
  const addressParts = [
    surveyor.office_address_line_1,
    surveyor.office_address_line_2,
    surveyor.office_town,
    surveyor.office_county,
    surveyor.office_postcode,
  ].filter(Boolean)

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/surveyors')}>Back</Button>
        </Space>

        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Card
            title={fullName}
            extra={
              <Space>
                <Button icon={<CloseOutlined />} onClick={() => { setEditing(false); load() }}>Cancel</Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()}>Save</Button>
              </Space>
            }
            style={CARD_STYLE}
          >
            <Divider orientation="left">Contact</Divider>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="surveyor_number" label="Surveyor No."><Input /></Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="first_name" label="First Name" rules={[{ required: true }]}><Input /></Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="last_name" label="Last Name" rules={[{ required: true }]}><Input /></Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="qualification" label="Qualification"><Input placeholder="e.g. FRICS, MRICS, AssocRICS" /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="email" label="Email" rules={[{ required: true }]}><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="phone" label="Work Phone" rules={[{ required: true }]}><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="personal_phone" label="Personal Phone"><Input /></Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">Firm</Divider>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="company_name" label="Company Name"><Input placeholder="Leave blank if sole trader" /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="firm_type" label="Firm Type">
                  <Select allowClear options={Object.entries(FIRM_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="num_partners" label="Number of Partners"><Input type="number" min={1} /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="pi_cover_amount" label="PI Cover Amount">
                  <Input type="number" min={0} step="0.01" prefix="£" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="pi_expiry_date" label="PI Expiry Date">
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">Office Address</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="office_address_line_1" label="Address Line 1"><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="office_address_line_2" label="Address Line 2"><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="office_town" label="Town"><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="office_county" label="County"><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="office_postcode" label="Postcode"><Input style={{ textTransform: 'uppercase' }} /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="base_postcode" label="Base Postcode" extra="Where this surveyor is based">
                  <Input style={{ textTransform: 'uppercase' }} placeholder="e.g. EH1 1AB" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="work_types" label="Work Types">
                  <Select mode="multiple" placeholder="Select work types" allowClear
                    options={surveyTypes.map(st => ({ value: st.name, label: st.name }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="fee_cat" label="Fee Category">
                  <Select mode="multiple" placeholder="Select fee types" allowClear
                    options={feeTypes.map(ft => ({ value: ft.name, label: ft.name }))} />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">Coverage Postcodes</Divider>
            <Form.Item name="coverage_15" label="Within 15 miles" extra="Outward codes — type and press Enter or comma.">
              <Select mode="tags" tokenSeparators={[',', ' ']} placeholder="SW1A, E1, B1…" options={[]} />
            </Form.Item>
            <Form.Item name="coverage_25" label="Within 25 miles (over 15)">
              <Select mode="tags" tokenSeparators={[',', ' ']} placeholder="SW1A, E1, B1…" options={[]} />
            </Form.Item>

            <Divider orientation="left">Cannot Work For</Divider>
            <Form.Item name="excluded_client_ids" extra="Clients this surveyor should not be assigned to.">
              <Select
                mode="multiple"
                optionFilterProp="label"
                placeholder="Select clients"
                options={clients.map(c => ({ value: c.id, label: c.company_name }))}
              />
            </Form.Item>

            <Divider orientation="left">Notes</Divider>
            <Form.Item name="notes">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Card>
        </Form>
      </>
    )
  }

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
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
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>Edit</Button>
        </Space>
      </div>

      {/* Header */}
      <Card style={CARD_STYLE} styles={{ body: { padding: '20px 24px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <Title level={3} style={{ margin: 0 }}>{fullName}</Title>
              {surveyor.qualification && (
                <Text style={{ fontSize: 15, color: '#8753A8', fontWeight: 500 }}>{surveyor.qualification}</Text>
              )}
            </div>
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
          {surveyor.pi_cover_amount && (
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>PI Cover</Text>
              <Text style={{ fontSize: 22, fontWeight: 600, color: '#1a1a1a' }}>{formatPiCover(surveyor.pi_cover_amount)}</Text>
            </div>
          )}
        </div>
      </Card>

      {/* Contact + Firm */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <SectionCard title="Contact">
            <Descriptions column={1} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
              <Descriptions.Item label="Email">{surveyor.email}</Descriptions.Item>
              <Descriptions.Item label="Work Phone">{surveyor.phone}</Descriptions.Item>
              <Descriptions.Item label="Personal Phone">{surveyor.personal_phone || '—'}</Descriptions.Item>
            </Descriptions>
          </SectionCard>
        </Col>
        <Col xs={24} md={12}>
          <SectionCard title="Firm">
            <Descriptions column={1} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
              <Descriptions.Item label="Company">{surveyor.company_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Firm Type">{FIRM_TYPE_LABELS[surveyor.firm_type] || '—'}</Descriptions.Item>
              <Descriptions.Item label="No. of Partners">{surveyor.num_partners ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="PI Expiry"><PiExpiryDate date={surveyor.pi_expiry_date} /></Descriptions.Item>
            </Descriptions>
          </SectionCard>
        </Col>
      </Row>

      {/* Office Address */}
      <SectionCard title="Office Address">
        <Descriptions column={1} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
          <Descriptions.Item label="Address">
            {addressParts.length > 0 ? <Text>{addressParts.join(', ')}</Text> : <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Base Postcode">
            {surveyor.base_postcode || <Text type="secondary">—</Text>}
          </Descriptions.Item>
        </Descriptions>
      </SectionCard>

      {/* Work Types + Fee Category */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <SectionCard title="Work Types">
            <Space wrap size={4}>
              {surveyor.work_types
                ? surveyor.work_types.split(/,\s*/).filter(Boolean).map(w => <Tag key={w}>{w}</Tag>)
                : <Text type="secondary">None set</Text>}
            </Space>
          </SectionCard>
        </Col>
        <Col xs={24} md={12}>
          <SectionCard title="Fee Category">
            <Space wrap size={4}>
              {surveyor.fee_cat
                ? surveyor.fee_cat.split(',').filter(Boolean).map(f => <Tag key={f}>{f}</Tag>)
                : <Text type="secondary">None set</Text>}
            </Space>
          </SectionCard>
        </Col>
      </Row>

      {/* Coverage */}
      <SectionCard title="Coverage Postcodes">
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
      </SectionCard>

      {/* Cannot Work For */}
      <SectionCard title="Cannot Work For">
        <Space wrap size={4}>
          {surveyor.excluded_client_names.length > 0
            ? surveyor.excluded_client_names.map(n => <Tag key={n} color="red">{n}</Tag>)
            : <Text type="secondary">No exclusions</Text>}
        </Space>
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
