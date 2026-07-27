import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Button, Select, Space,
  Input, DatePicker, Row, Col, Timeline, Typography, message, Spin, Modal, Popconfirm
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getInstruction, updateInstruction, updateInstructionProperty, updateStatus, undoStatus, getSurveyors } from '../api/client'

function addWorkingDays(date, days) {
  let result = date.clone()
  let added = 0
  while (added < days) {
    result = result.add(1, 'day')
    const dow = result.day()
    if (dow !== 0 && dow !== 6) added++
  }
  return result
}

const { Text, Title } = Typography

const STATUS_COLOURS = {
  received: 'blue',
  surveyor_assigned: 'purple',
  booked: 'cyan',
  report_received: 'geekblue',
  invoiced: 'volcano',
  complete: 'green',
  on_hold: 'gold',
  cancelled: 'red',
}

const STATUS_LABELS = {
  received: 'Received',
  surveyor_assigned: 'Surveyor Assigned',
  booked: 'Booked',
  report_received: 'Report Received',
  invoiced: 'Invoiced',
  complete: 'Complete',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
}

const STATUS_TRANSITIONS = {
  received: ['surveyor_assigned', 'on_hold', 'cancelled'],
  surveyor_assigned: ['booked', 'received', 'on_hold', 'cancelled'],
  booked: ['report_received', 'surveyor_assigned', 'on_hold', 'cancelled'],
  report_received: ['invoiced'],
  invoiced: ['complete'],
  on_hold: ['received', 'cancelled'],
  complete: [],
  cancelled: [],
}

const CARD_STYLE = { marginBottom: 16 }
const SECTION_LABEL_STYLE = { width: 130, color: '#888', fontWeight: 500 }

const PROPERTY_TYPE_OPTIONS = [
  { value: 'house', label: 'House' },
  { value: 'flat', label: 'Flat' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'maisonette', label: 'Maisonette' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'other', label: 'Other' },
]

const TENURE_OPTIONS = [
  { value: 'freehold', label: 'Freehold' },
  { value: 'leasehold', label: 'Leasehold' },
  { value: 'unknown', label: 'Unknown' },
]

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

function DateBlock({ label, date, warn }) {
  const formatted = date ? dayjs(date).format('DD MMM YYYY') : null
  return (
    <div style={{ textAlign: 'center', minWidth: 120 }}>
      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 20, fontWeight: 700, color: warn ? '#cf1322' : '#1a1a1a', display: 'block' }}>
        {formatted || '—'}
      </Text>
    </div>
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

export default function InstructionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [instruction, setInstruction] = useState(null)
  const [surveyors, setSurveyors] = useState([])
  const [loading, setLoading] = useState(true)

  // Single active field being edited
  const [editingField, setEditingField] = useState(null)
  const [editingValue, setEditingValue] = useState(null)
  const editingValueRef = useRef(null) // always holds latest value, avoids stale closure in onBlur

  // Notes
  const [notesEditing, setNotesEditing] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  // Status modal
  const [statusModal, setStatusModal] = useState(false)
  const [nextStatus, setNextStatus] = useState(null)
  const [statusNote, setStatusNote] = useState('')
  const [statusSurveyor, setStatusSurveyor] = useState(null)
  const [statusInspectionDate, setStatusInspectionDate] = useState(null)

  const refresh = async () => {
    const data = await getInstruction(id)
    setInstruction(data)
    setNotesValue(data.notes || '')
  }

  const load = async () => {
    setLoading(true)
    try { await refresh() } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    getSurveyors().then(setSurveyors)
  }, [id])

  // ── Field-level save ───────────────────────────────────────────────────────

  const startEdit = (field, value) => {
    setEditingField(field)
    setEditingValue(value)
    editingValueRef.current = value
  }

  const cancelEdit = () => setEditingField(null)

  // Generic field commit — handles instruction fields and property fields
  const commit = async (field, value) => {
    setEditingField(null)

    // Optimistically update the display immediately so the UI responds before the API returns
    const coerced = value !== '' && value != null ? value : null
    if (['property_type', 'tenure', 'num_bedrooms'].includes(field)) {
      setInstruction(prev => ({
        ...prev,
        property: { ...prev.property, [field]: field === 'num_bedrooms' && coerced != null ? Number(coerced) : coerced },
      }))
    } else if (field === 'assigned_surveyor_id') {
      const surveyor = surveyors.find(s => s.id === value) || null
      setInstruction(prev => ({ ...prev, assigned_surveyor_id: value || null, assigned_surveyor: surveyor }))
    } else if (field === 'inspection_date') {
      setInstruction(prev => ({ ...prev, inspection_date: value ? value.format('YYYY-MM-DD') : null }))
    } else if (field === 'report_due_date') {
      setInstruction(prev => ({ ...prev, report_due_date: value ? value.format('YYYY-MM-DD') : null }))
    } else {
      setInstruction(prev => ({ ...prev, [field]: coerced }))
    }

    try {
      if (['property_type', 'tenure', 'num_bedrooms'].includes(field)) {
        const updated = await updateInstructionProperty(id, {
          [field]: coerced != null ? (field === 'num_bedrooms' ? Number(coerced) : coerced) : null,
        })
        setInstruction(updated)
        return
      }

      if (field === 'inspection_date') {
        const payload = { inspection_date: value ? value.format('YYYY-MM-DD') : null }
        // Auto-calc report due if SLA set and date provided
        if (value && instruction?.survey_type?.report_due_days) {
          payload.report_due_date = addWorkingDays(value, instruction.survey_type.report_due_days).format('YYYY-MM-DD')
        }
        const updated = await updateInstruction(id, payload)
        // Auto-transition booked
        if (value && !instruction.inspection_date && instruction.status === 'surveyor_assigned') {
          await updateStatus(id, { new_status: 'booked', changed_by: 'system', notes: 'Inspection date set' })
          message.success('Saved — status moved to Booked')
          await refresh()
        } else {
          setInstruction(updated)
          setNotesValue(updated.notes || '')
        }
        return
      }

      if (field === 'assigned_surveyor_id') {
        const updated = await updateInstruction(id, { assigned_surveyor_id: value || null })
        // Auto-transition surveyor assigned
        if (value && !instruction.assigned_surveyor_id && instruction.status === 'received') {
          await updateStatus(id, { new_status: 'surveyor_assigned', changed_by: 'system', notes: 'Surveyor assigned' })
          message.success('Saved — status moved to Surveyor Assigned')
          await refresh()
        } else {
          setInstruction(updated)
          setNotesValue(updated.notes || '')
        }
        return
      }

      if (field === 'report_due_date') {
        const updated = await updateInstruction(id, { report_due_date: value ? value.format('YYYY-MM-DD') : null })
        setInstruction(updated)
        setNotesValue(updated.notes || '')
        return
      }

      // All other plain fields
      const updated = await updateInstruction(id, { [field]: value !== '' && value != null ? value : null })
      setInstruction(updated)
      setNotesValue(updated.notes || '')
    } catch {
      message.error('Failed to save')
    }
  }

  const handleNotesSave = async () => {
    setNotesSaving(true)
    try {
      const updated = await updateInstruction(id, { notes: notesValue || null })
      setInstruction(updated)
      setNotesEditing(false)
    } catch {
      message.error('Failed to save notes')
    } finally {
      setNotesSaving(false)
    }
  }

  // ── Status modal ───────────────────────────────────────────────────────────

  const handleStatusChange = async () => {
    try {
      if (nextStatus === 'surveyor_assigned' && statusSurveyor)
        await updateInstruction(id, { assigned_surveyor_id: statusSurveyor })
      if (nextStatus === 'booked' && statusInspectionDate) {
        const payload = { inspection_date: statusInspectionDate.format('YYYY-MM-DD') }
        if (instruction?.survey_type?.report_due_days)
          payload.report_due_date = addWorkingDays(statusInspectionDate, instruction.survey_type.report_due_days).format('YYYY-MM-DD')
        await updateInstruction(id, payload)
      }
      await updateStatus(id, { new_status: nextStatus, changed_by: 'user', notes: statusNote || null })
      message.success(`Status updated to ${STATUS_LABELS[nextStatus]}`)
      setStatusModal(false)
      setStatusNote('')
      setStatusSurveyor(null)
      setStatusInspectionDate(null)
      await refresh()
    } catch (e) {
      message.error(e.response?.data?.detail || 'Failed to update status')
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  // Text / number input that saves on blur
  const textField = (field, currentDisplay, currentValue, inputProps = {}) => (
    <Editable field={field} editingField={editingField} onStart={() => startEdit(field, currentValue ?? '')} display={currentDisplay}>
      <Input
        size="small"
        autoFocus
        value={editingValue}
        onChange={e => { setEditingValue(e.target.value); editingValueRef.current = e.target.value }}
        onBlur={() => commit(field, editingValueRef.current)}
        onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
        style={{ width: 180 }}
        {...inputProps}
      />
    </Editable>
  )

  // Select that saves immediately on option selection; closes without saving if user clicks away
  const selectField = (field, currentDisplay, currentValue, options, extraProps = {}) => (
    <Editable field={field} editingField={editingField} onStart={() => startEdit(field, currentValue)} display={currentDisplay}>
      <Select
        size="small"
        autoFocus
        defaultOpen
        allowClear
        style={{ minWidth: 180 }}
        value={editingValue}
        options={options}
        onChange={v => commit(field, v ?? null)}
        onDropdownVisibleChange={open => { if (!open) cancelEdit() }}
        {...extraProps}
      />
    </Editable>
  )

  // DatePicker that saves on date selection
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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Spin style={{ display: 'block', marginTop: 80 }} />
  if (!instruction) return <Text>Instruction not found.</Text>

  const allowedTransitions = (STATUS_TRANSITIONS[instruction.status] || []).filter(s =>
    !(s === 'surveyor_assigned' && instruction.assigned_surveyor_id)
  )

  const address = [
    instruction.property?.address_line_1,
    instruction.property?.address_line_2,
    instruction.property?.town,
    instruction.property?.county,
    instruction.property?.postcode,
  ].filter(Boolean).join(', ')

  const assignedSurveyorName = instruction.assigned_surveyor
    ? `${instruction.assigned_surveyor.first_name} ${instruction.assigned_surveyor.last_name}`
    : null

  const reportOverdue = instruction.report_due_date
    && !['complete', 'cancelled', 'report_received', 'invoiced'].includes(instruction.status)
    && dayjs(instruction.report_due_date).isBefore(dayjs(), 'day')

  const clientFee = instruction.agreed_client_fee != null ? Number(instruction.agreed_client_fee) : null
  const surveyorFee = instruction.agreed_surveyor_fee != null ? Number(instruction.agreed_surveyor_fee) : null

  const surveyorOptions = surveyors.map(s => ({
    value: s.id,
    label: s.surveyor_number
      ? `#${s.surveyor_number} — ${s.first_name} ${s.last_name}`
      : `${s.first_name} ${s.last_name}`,
  }))

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/instructions')}>Back</Button>
          <Tag color={STATUS_COLOURS[instruction.status]} style={{ fontSize: 13, padding: '2px 10px' }}>
            {STATUS_LABELS[instruction.status]}
          </Tag>
          {instruction.priority === 'urgent' && <Tag color="red">Urgent</Tag>}
        </Space>
      </div>

      {/* Header */}
      <Card style={CARD_STYLE} styles={{ body: { padding: '20px 24px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={3} style={{ margin: 0, lineHeight: 1.2 }}>{address || 'No address set'}</Title>
            <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>{instruction.our_ref}</Text>
              {instruction.client?.company_name && (
                <Text type="secondary" style={{ fontSize: 13 }}>· {instruction.client.company_name}</Text>
              )}
              {instruction.survey_type?.name && <Tag style={{ marginLeft: 0 }}>{instruction.survey_type.name}</Tag>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 32, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <DateBlock label="Inspection Date" date={instruction.inspection_date} />
            <div style={{ width: 1, background: '#f0f0f0', alignSelf: 'stretch' }} />
            <DateBlock label="Report Due" date={instruction.report_due_date} warn={reportOverdue} />
            <div style={{ width: 1, background: '#f0f0f0', alignSelf: 'stretch' }} />
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Client Fee</Text>
              {textField('agreed_client_fee', clientFee != null ? `£${clientFee.toFixed(2)}` : null, clientFee ?? '', { type: 'number', min: 0, step: '0.01', prefix: '£', style: { width: 100, textAlign: 'center' } })}
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Surveyor Fee</Text>
              {textField('agreed_surveyor_fee', surveyorFee != null ? `£${surveyorFee.toFixed(2)}` : null, surveyorFee ?? '', { type: 'number', min: 0, step: '0.01', prefix: '£', style: { width: 100, textAlign: 'center' } })}
            </div>
          </div>
        </div>
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={16}>

          {/* Borrower + Client */}
          <Row gutter={16} style={{ alignItems: 'stretch' }}>
            <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
              <SectionCard title="Client" style={{ flex: 1 }}>
                <Descriptions column={1} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
                  <Descriptions.Item label="Client">{instruction.client?.company_name || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Contact">{instruction.contact?.name || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Client Ref">
                    {textField('client_ref', instruction.client_ref, instruction.client_ref)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Priority">
                    {selectField(
                      'priority',
                      instruction.priority,
                      instruction.priority,
                      [{ value: 'standard', label: 'Standard' }, { value: 'urgent', label: 'Urgent' }],
                      { allowClear: false }
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </SectionCard>
            </Col>
            <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
              <SectionCard title="Borrower" style={{ flex: 1 }}>
                <Descriptions column={1} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
                  <Descriptions.Item label="Name">
                    {textField('borrower_name', instruction.borrower_name, instruction.borrower_name)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phone">
                    {textField('borrower_phone', instruction.borrower_phone, instruction.borrower_phone)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {textField('borrower_email', instruction.borrower_email, instruction.borrower_email)}
                  </Descriptions.Item>
                </Descriptions>
              </SectionCard>
            </Col>
          </Row>

          {/* Notes */}
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
                style={{ cursor: 'text', minHeight: 40, padding: '4px 0' }}
              >
                {instruction.notes
                  ? <Text style={{ whiteSpace: 'pre-wrap' }}>{instruction.notes}</Text>
                  : <Text type="secondary" style={{ fontStyle: 'italic' }}>Double-click to add notes…</Text>}
              </div>
            )}
          </SectionCard>

          {/* Survey */}
          <SectionCard title="Survey">
            <Descriptions column={2} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
              <Descriptions.Item label="Surveyor" span={2}>
                <Select
                  variant="borderless"
                  style={{ width: '100%', marginLeft: -7 }}
                  value={instruction.assigned_surveyor_id}
                  options={surveyorOptions}
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  placeholder={<Text type="secondary">Not assigned</Text>}
                  onChange={v => commit('assigned_surveyor_id', v ?? null)}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Inspection Date">
                {dateField(
                  'inspection_date',
                  instruction.inspection_date ? dayjs(instruction.inspection_date).format('DD/MM/YYYY') : null,
                  instruction.inspection_date ? dayjs(instruction.inspection_date) : null
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Report Due">
                {dateField(
                  'report_due_date',
                  instruction.report_due_date ? dayjs(instruction.report_due_date).format('DD/MM/YYYY') : null,
                  instruction.report_due_date ? dayjs(instruction.report_due_date) : null
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Report Received">
                {instruction.report_received_at ? dayjs(instruction.report_received_at).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
            </Descriptions>
          </SectionCard>

          {/* Property — bottom */}
          <SectionCard title="Property">
            <Descriptions column={3} size="small" styles={{ label: SECTION_LABEL_STYLE }}>
              <Descriptions.Item label="Type">
                {selectField('property_type', instruction.property?.property_type, instruction.property?.property_type, PROPERTY_TYPE_OPTIONS)}
              </Descriptions.Item>
              <Descriptions.Item label="Tenure">
                {selectField('tenure', instruction.property?.tenure, instruction.property?.tenure, TENURE_OPTIONS)}
              </Descriptions.Item>
              <Descriptions.Item label="Bedrooms">
                {textField('num_bedrooms', instruction.property?.num_bedrooms, instruction.property?.num_bedrooms ?? '', { type: 'number', min: 0, style: { width: 80 } })}
              </Descriptions.Item>
            </Descriptions>
          </SectionCard>

        </Col>

        <Col xs={24} lg={8}>
          <Card title="Update Status" style={CARD_STYLE}>
            {allowedTransitions.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {allowedTransitions.map(s => (
                  <Button key={s} block onClick={() => { setNextStatus(s); setStatusNote(''); setStatusSurveyor(null); setStatusInspectionDate(null); setStatusModal(true) }}>
                    → {STATUS_LABELS[s]}
                  </Button>
                ))}
              </Space>
            ) : (
              <Text type="secondary">No further transitions available.</Text>
            )}
          </Card>

          <Card title="History">
            <Timeline
              items={[...instruction.status_history].reverse().map((h, idx) => ({
                color: STATUS_COLOURS[h.new_status] || 'gray',
                children: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <Text strong>{STATUS_LABELS[h.new_status]}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(h.changed_at).format('DD/MM/YYYY HH:mm')}
                      </Text>
                      {h.notes && <><br /><Text style={{ fontSize: 12 }}>{h.notes}</Text></>}
                    </div>
                    {idx === 0 && h.old_status && (
                      <Popconfirm
                        title="Undo this status change?"
                        description={`Revert back to "${STATUS_LABELS[h.old_status]}"`}
                        onConfirm={async () => {
                          try {
                            const updated = await undoStatus(id)
                            setInstruction(updated)
                            setNotesValue(updated.notes || '')
                            message.success(`Reverted to ${STATUS_LABELS[h.old_status]}`)
                          } catch {
                            message.error('Failed to undo status')
                          }
                        }}
                        okText="Undo"
                        okButtonProps={{ danger: true }}
                        placement="left"
                      >
                        <Button size="small" type="text" danger style={{ marginTop: 2, flexShrink: 0 }}>
                          Undo
                        </Button>
                      </Popconfirm>
                    )}
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={`Move to: ${STATUS_LABELS[nextStatus]}`}
        open={statusModal}
        onOk={handleStatusChange}
        onCancel={() => { setStatusModal(false); setStatusNote(''); setStatusSurveyor(null); setStatusInspectionDate(null) }}
        okText="Confirm"
      >
        <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
          {nextStatus === 'surveyor_assigned' && !instruction?.assigned_surveyor_id && (
            <div>
              <Text strong>Assign Surveyor</Text>
              <Select
                showSearch allowClear placeholder="Select a surveyor" optionFilterProp="label"
                style={{ width: '100%', marginTop: 4 }}
                options={surveyorOptions}
                onChange={setStatusSurveyor}
              />
            </div>
          )}
          {nextStatus === 'booked' && !instruction?.inspection_date && (
            <div>
              <Text strong>Inspection Date</Text>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%', marginTop: 4 }} onChange={setStatusInspectionDate} />
            </div>
          )}
          <div>
            <Text strong>Note <Text type="secondary">(optional)</Text></Text>
            <Input.TextArea rows={2} placeholder="e.g. reason for hold, confirmation reference" value={statusNote} onChange={e => setStatusNote(e.target.value)} style={{ marginTop: 4 }} />
          </div>
        </Space>
      </Modal>
    </>
  )
}
