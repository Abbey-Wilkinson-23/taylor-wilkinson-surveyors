import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Tag, Typography, Card } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getChasers } from '../api/client'

const { Text } = Typography

const STATUS_COLOURS = {
  received: 'blue',
  surveyor_assigned: 'purple',
  booked: 'cyan',
  inspection_complete: 'orange',
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
  inspection_complete: 'Inspection Complete',
  report_received: 'Report Received',
  invoiced: 'Invoiced',
  complete: 'Complete',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
}

export default function Chasers() {
  const navigate = useNavigate()
  const [chasers, setChasers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChasers()
      .then(setChasers)
      .finally(() => setLoading(false))
  }, [])

  const today = dayjs().startOf('day')

  const overdue = chasers.filter(i => dayjs(i.report_due_date).isBefore(today, 'day'))
  const dueSoon = chasers.filter(i => !dayjs(i.report_due_date).isBefore(today, 'day'))

  const columns = [
    {
      title: 'Our Ref',
      dataIndex: 'our_ref',
      key: 'our_ref',
      render: (v, r) => {
        const isOverdue = dayjs(r.report_due_date).isBefore(today, 'day')
        return (
          <Text strong style={isOverdue ? { color: '#cf1322' } : {}}>
            {v}
          </Text>
        )
      },
    },
    {
      title: 'Borrower',
      dataIndex: 'borrower_name',
      key: 'borrower_name',
      render: (v, r) => {
        const isOverdue = dayjs(r.report_due_date).isBefore(today, 'day')
        return <Text strong={isOverdue} style={isOverdue ? { color: '#cf1322' } : {}}>{v}</Text>
      },
    },
    {
      title: 'Property',
      key: 'property',
      render: (_, r) => {
        const isOverdue = dayjs(r.report_due_date).isBefore(today, 'day')
        return (
          <span>
            {r.property_address_line_1 && (
              <Text strong={isOverdue} style={isOverdue ? { color: '#cf1322' } : {}}>
                {r.property_address_line_1}
              </Text>
            )}
            {r.property_address_line_1 && r.property_postcode && <br />}
            {r.property_postcode && (
              <Text type={isOverdue ? undefined : 'secondary'} style={{ fontSize: 12, color: isOverdue ? '#cf1322' : undefined }}>
                {r.property_postcode}
              </Text>
            )}
          </span>
        )
      },
    },
    {
      title: 'Client',
      dataIndex: 'client_name',
      key: 'client_name',
      render: (v, r) => {
        const isOverdue = dayjs(r.report_due_date).isBefore(today, 'day')
        return <Text strong={isOverdue} style={isOverdue ? { color: '#cf1322' } : {}}>{v || '—'}</Text>
      },
    },
    {
      title: 'Survey Type',
      dataIndex: 'survey_type_name',
      key: 'survey_type_name',
      render: v => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'Surveyor',
      dataIndex: 'surveyor_name',
      key: 'surveyor_name',
      render: v => v || <Text type="secondary">Unassigned</Text>,
    },
    {
      title: 'Inspection Date',
      dataIndex: 'inspection_date',
      key: 'inspection_date',
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Report Due',
      dataIndex: 'report_due_date',
      key: 'report_due_date',
      render: (v, r) => {
        if (!v) return '—'
        const d = dayjs(v)
        const isOverdue = d.isBefore(today, 'day')
        const isToday = d.isSame(today, 'day')
        const isTomorrow = d.isSame(today.add(1, 'day'), 'day')
        const label = isOverdue
          ? `${today.diff(d, 'day')}d overdue`
          : isToday ? 'Today'
          : isTomorrow ? 'Tomorrow'
          : d.format('DD/MM/YYYY')
        return (
          <Text strong style={{ color: isOverdue ? '#cf1322' : isToday ? '#d46b08' : '#1a1a1a' }}>
            {isOverdue && <WarningOutlined style={{ marginRight: 4 }} />}
            {label}
          </Text>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: s => <Tag color={STATUS_COLOURS[s]}>{STATUS_LABELS[s]}</Tag>,
    },
  ]

  const rowProps = (record) => ({
    onClick: () => navigate(`/instructions/${record.id}`),
    style: { cursor: 'pointer' },
  })

  return (
    <>
      {overdue.length > 0 && (
        <Card
          title={
            <span style={{ color: '#cf1322' }}>
              <WarningOutlined style={{ marginRight: 8 }} />
              Overdue Reports ({overdue.length})
            </span>
          }
          style={{ marginBottom: 16, borderColor: '#ffccc7' }}
          styles={{ header: { borderBottom: '1px solid #ffccc7' } }}
        >
          <Table
            dataSource={overdue}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={false}
            onRow={rowProps}
          />
        </Card>
      )}

      <Card
        title={`Reports Due Soon (${dueSoon.length})`}
        style={{ marginBottom: 16 }}
      >
        <Table
          dataSource={dueSoon}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: 'No reports due soon' }}
          onRow={rowProps}
        />
      </Card>
    </>
  )
}
