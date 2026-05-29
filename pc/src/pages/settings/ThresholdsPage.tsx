import { useState, useEffect } from 'react'
import {
  Card, Table, Typography, Button, InputNumber, message, Tag, Space, Alert,
} from 'antd'
import { SlidersHorizontal, Save } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface ThresholdConfig {
  key: string
  value: string
  label: string
  description: string
  group: string
  type: 'float' | 'int'
}

const GROUP_ORDER = ['Risk Detection', 'Academic Standing', 'Attendance', 'Class Management', 'Finance', 'CPD']

export default function ThresholdsPage() {
  const qc = useQueryClient()
  const { token } = useAuthStore()
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [sseToast, setSseToast] = useState<string | null>(null)

  const { data, isLoading } = useQuery<ThresholdConfig[]>({
    queryKey: ['config-thresholds'],
    queryFn: async () => {
      const res = await api.get('/config/thresholds')
      return res.data.data ?? []
    },
  })

  // SSE listener for threshold changes
  useEffect(() => {
    if (!token) return
    const base = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1'
    const es = new EventSource(`${base}/events/stream?topics=system&token=${token}`)
    es.addEventListener('system.thresholds.changed', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data)
        const keys = (payload.updatedKeys ?? []).join(', ')
        setSseToast(`Thresholds updated: ${keys}. Risk scores recalculating...`)
        setTimeout(() => setSseToast(null), 5000)
        qc.invalidateQueries({ queryKey: ['command-center'] })
      } catch { /* ignore */ }
    })
    return () => es.close()
  }, [token, qc])

  const saveMutation = useMutation({
    mutationFn: () => {
      const updates = Object.entries(edits).map(([key, value]) => ({ key, value }))
      return api.put('/config/thresholds', { updates })
    },
    onSuccess: () => {
      message.success('Thresholds saved — affected records are being recalculated')
      setEdits({})
      qc.invalidateQueries({ queryKey: ['config-thresholds'] })
    },
    onError: () => message.error('Failed to save thresholds'),
  })

  const thresholds = data ?? []
  const hasPendingEdits = Object.keys(edits).length > 0

  const grouped = GROUP_ORDER.map(group => ({
    group,
    items: thresholds.filter(t => t.group === group),
  })).filter(g => g.items.length > 0)

  const columns = [
    {
      title: 'Setting',
      key: 'label',
      render: (_: unknown, row: ThresholdConfig) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: 13 }}>{row.label}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{row.description}</Text>
        </Space>
      ),
    },
    {
      title: 'Current Value',
      key: 'current',
      width: 130,
      render: (_: unknown, row: ThresholdConfig) => (
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {row.value || '—'}
        </Tag>
      ),
    },
    {
      title: 'New Value',
      key: 'new',
      width: 150,
      render: (_: unknown, row: ThresholdConfig) => (
        <InputNumber
          size="small"
          style={{ width: 120 }}
          step={row.type === 'float' ? 0.05 : 1}
          min={0}
          max={row.type === 'float' ? 1 : 100}
          precision={row.type === 'float' ? 2 : 0}
          placeholder={row.value || '—'}
          value={edits[row.key] !== undefined ? Number(edits[row.key]) : undefined}
          onChange={val => {
            if (val === null) {
              setEdits(prev => { const next = { ...prev }; delete next[row.key]; return next })
            } else {
              setEdits(prev => ({ ...prev, [row.key]: String(val) }))
            }
          }}
          status={edits[row.key] !== undefined ? 'warning' : undefined}
        />
      ),
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <SlidersHorizontal size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            System Thresholds
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Adjust operational thresholds without code changes. Changes take effect immediately and recalculate affected records.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<Save size={14} />}
          disabled={!hasPendingEdits}
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Apply Changes {hasPendingEdits ? `(${Object.keys(edits).length})` : ''}
        </Button>
      </div>

      {sseToast && (
        <Alert type="info" message={sseToast} showIcon closable style={{ marginBottom: 16 }} />
      )}

      {hasPendingEdits && (
        <Alert
          type="warning"
          showIcon
          message={`${Object.keys(edits).length} unsaved change(s). Click "Apply Changes" to save.`}
          style={{ marginBottom: 16 }}
        />
      )}

      {grouped.map(({ group, items }) => (
        <Card
          key={group}
          title={group}
          size="small"
          style={{ marginBottom: 16 }}
          headStyle={{ background: '#fafafa', fontWeight: 600 }}
        >
          <Table
            dataSource={items}
            columns={columns}
            rowKey="key"
            loading={isLoading}
            pagination={false}
            size="small"
            showHeader={false}
          />
        </Card>
      ))}

      <Text type="secondary" style={{ fontSize: 11 }}>
        Note: Changing Risk Detection thresholds triggers a background recalculation for all MONITOR and HIGH_RISK students. Dashboard widgets update live via SSE.
      </Text>
    </div>
  )
}
