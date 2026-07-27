import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Form, Input, Select, DatePicker, Button, Card, Row, Col, Divider, Space, message
} from 'antd'
import { getClients, getSurveyors, getSurveyTypes, createInstruction } from '../api/client'

const PROPERTY_TYPES = ['house', 'flat', 'bungalow', 'maisonette', 'commercial', 'other']
const TENURES = ['freehold', 'leasehold', 'unknown']

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

export default function NewInstruction() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [clients, setClients] = useState([])
  const [contacts, setContacts] = useState([])
  const [surveyors, setSurveyors] = useState([])
  const [surveyTypes, setSurveyTypes] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getClients().then(setClients)
    getSurveyors().then(setSurveyors)
    getSurveyTypes().then(setSurveyTypes)
  }, [])

  const handleClientChange = (clientId) => {
    form.setFieldValue('contact_id', null)
    const client = clients.find(c => c.id === clientId)
    setContacts(client?.contacts || [])
  }

  const recalcReportDueDate = (inspectionDate, surveyTypeId) => {
    const typeId = surveyTypeId ?? form.getFieldValue('survey_type_id')
    const date = inspectionDate ?? form.getFieldValue('inspection_date')
    if (!date || !typeId) return
    const surveyType = surveyTypes.find(t => t.id === typeId)
    if (surveyType?.report_due_days) {
      form.setFieldValue('report_due_date', addWorkingDays(date, surveyType.report_due_days))
    }
  }

  const handleSurveyTypeChange = (typeId) => recalcReportDueDate(null, typeId)
  const handleInspectionDateChange = (date) => recalcReportDueDate(date, null)

  const handleSubmit = async (values) => {
    setSubmitting(true)
    try {
      const payload = {
        client_id: values.client_id,
        contact_id: values.contact_id || null,
        survey_type_id: values.survey_type_id,
        client_ref: values.client_ref || null,
        borrower_name: values.borrower_name,
        borrower_phone: values.borrower_phone || null,
        borrower_email: values.borrower_email || null,
        assigned_surveyor_id: values.assigned_surveyor_id || null,
        inspection_date: values.inspection_date ? values.inspection_date.format('YYYY-MM-DD') : null,
        report_due_date: values.report_due_date ? values.report_due_date.format('YYYY-MM-DD') : null,
        priority: values.priority || 'standard',
        notes: values.notes || null,
        property: {
          address_line_1: values.address_line_1,
          address_line_2: values.address_line_2 || null,
          town: values.town,
          county: values.county || null,
          postcode: values.postcode,
          property_type: values.property_type || null,
          tenure: values.tenure || null,
          num_bedrooms: values.num_bedrooms ? parseInt(values.num_bedrooms) : null,
        },
      }
      const created = await createInstruction(payload)
      message.success(`Instruction ${created.our_ref} created`)
      navigate(`/instructions/${created.id}`)
    } catch (e) {
      message.error('Failed to create instruction. Check all required fields.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="New Instruction">
      <Form form={form} layout="vertical" onFinish={handleSubmit}>

        <Divider orientation="left">Client</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="client_id" label="Client" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Select client"
                optionFilterProp="label"
                options={clients.map(c => ({ value: c.id, label: c.company_name }))}
                onChange={handleClientChange}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="contact_id" label="Contact">
              <Select
                placeholder="Select contact"
                allowClear
                options={contacts.map(c => ({ value: c.id, label: `${c.name}${c.role ? ` (${c.role})` : ''}` }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="client_ref" label="Client Reference">
              <Input placeholder="Client's own case number" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Borrower</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="borrower_name" label="Borrower Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="borrower_phone" label="Borrower Phone">
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="borrower_email" label="Borrower Email">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Property</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="address_line_1" label="Address Line 1" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="address_line_2" label="Address Line 2">
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="town" label="Town" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="county" label="County">
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="postcode" label="Postcode" rules={[{ required: true }]}>
              <Input style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="property_type" label="Property Type">
              <Select allowClear options={PROPERTY_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="tenure" label="Tenure">
              <Select allowClear options={TENURES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="num_bedrooms" label="Bedrooms">
              <Input type="number" min={0} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Survey</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="survey_type_id" label="Survey Type" rules={[{ required: true }]}>
              <Select
                options={surveyTypes.map(t => ({ value: t.id, label: t.name }))}
                placeholder="Select survey type"
                onChange={handleSurveyTypeChange}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="assigned_surveyor_id" label="Assign Surveyor">
              <Select
                showSearch
                allowClear
                placeholder="Assign later"
                optionFilterProp="label"
                options={surveyors.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="priority" label="Priority" initialValue="standard">
              <Select options={[{ value: 'standard', label: 'Standard' }, { value: 'urgent', label: 'Urgent' }]} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="inspection_date" label="Inspection Date">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} onChange={handleInspectionDateChange} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="report_due_date" label="Report Due Date"
              extra="Auto-calculated from survey type SLA. Override if needed.">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Notes</Divider>
        <Form.Item name="notes">
          <Input.TextArea rows={3} placeholder="Any additional notes" />
        </Form.Item>

        <Row justify="end">
          <Space>
            <Button onClick={() => navigate('/instructions')}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Create Instruction
            </Button>
          </Space>
        </Row>
      </Form>
    </Card>
  )
}

