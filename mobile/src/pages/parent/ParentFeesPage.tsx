import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag, DotLoading, Toast } from 'antd-mobile'
import { DollarSign, AlertCircle, CheckCircle2, Clock, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface Invoice {
  id: string
  studentId: string
  studentName: string
  invoiceNumber: string | null
  semester: string | null
  amount: number
  status: string
  dueDate: string | null
  paidAt: string | null
  description: string | null
}

interface FeeSummary {
  totalBilled: number
  paid: number
  outstanding: number
}

const STATUS_MAP: Record<string, { color: string; labelKey: string }> = {
  paid: { color: '#00B42A', labelKey: 'parent.paid' },
  unpaid: { color: '#FAAD14', labelKey: 'common.unknown' },
  overdue: { color: '#F53F3F', labelKey: 'parent.outstanding' },
}

function fmt(n: number) {
  return `BND ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ParentFeesPage() {
  const { t } = useTranslation()
  const [payingId, setPayingId] = useState<string | null>(null)

  const { data: feeData, isLoading, refetch } = useQuery({
    queryKey: ['parent-fees'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ invoices: Invoice[]; summary: FeeSummary }>>('/parent/fees')
      return data.data ?? { invoices: [], summary: { totalBilled: 0, paid: 0, outstanding: 0 } }
    },
  })

  const invoices = feeData?.invoices ?? []
  const summary = feeData?.summary ?? { totalBilled: 0, paid: 0, outstanding: 0 }

  const handlePay = (invoiceId: string) => {
    setPayingId(invoiceId)
    Toast.show({ icon: 'loading', content: 'Processing...', duration: 2000 })
    setTimeout(() => {
      setPayingId(null)
      Toast.show({ icon: 'success', content: t('parent.paid') })
      void refetch()
    }, 2000)
  }

  return (
    <AppLayout title={t('parent.fees')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            {
              label: t('parent.totalDue'),
              value: fmt(summary.totalBilled),
              icon: <DollarSign size={16} />,
              color: '#165DFF',
              bg: '#E6F4FF',
            },
            {
              label: t('parent.paid'),
              value: fmt(summary.paid),
              icon: <CheckCircle2 size={16} />,
              color: '#00B42A',
              bg: '#E8F5E9',
            },
            {
              label: t('parent.outstanding'),
              value: fmt(summary.outstanding),
              icon: <AlertCircle size={16} />,
              color: summary.outstanding > 0 ? '#F53F3F' : '#86909c',
              bg: summary.outstanding > 0 ? '#FFF1F0' : '#f5f5f5',
            },
          ].map(item => (
            <div key={item.label} style={{
              background: item.bg, borderRadius: 12,
              padding: '12px 8px', textAlign: 'center',
            }}>
              <div style={{ color: item.color, marginBottom: 4 }}>{item.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: item.color }}>
                {item.value}
              </div>
              <div style={{ fontSize: 10, color: '#86909c', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Section Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
          <FileText size={15} color="#165DFF" />
          {t('parent.feeSummary')}
          <span style={{ fontSize: 12, color: '#86909c', fontWeight: 400 }}>({invoices.length})</span>
        </div>

        {/* Invoice List */}
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <Skeleton animated style={{ height: 14, width: '60%', marginBottom: 8 }} />
                <Skeleton animated style={{ height: 12, width: '40%', marginBottom: 6 }} />
                <Skeleton animated style={{ height: 24, width: '80%' }} />
              </div>
            ))}
          </>
        ) : invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <DollarSign size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>{t('parent.noFees')}</div>
          </div>
        ) : (
          invoices.map(inv => {
            const st = STATUS_MAP[inv.status] ?? STATUS_MAP.unpaid
            const isOverdue = inv.status === 'overdue'
            const canPay = inv.status !== 'paid'

            return (
              <div key={inv.id} className="fee-card" style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                borderLeft: isOverdue ? '3px solid #F53F3F' : '3px solid transparent',
              }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1d1d1f' }}>
                      {inv.description ?? inv.semester ?? t('parent.feeType')}
                    </div>
                    <div style={{ fontSize: 12, color: '#86909c', marginTop: 2 }}>
                      {inv.studentName}
                      {inv.invoiceNumber && ` · #${inv.invoiceNumber}`}
                    </div>
                  </div>
                  <Tag
                    fill="outline"
                    color={st.color}
                    style={{ fontSize: 11, flexShrink: 0 }}
                  >
                    {t(st.labelKey)}
                  </Tag>
                </div>

                {/* Amount + Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
                  <div>
                    <span style={{ fontSize: 20, fontWeight: 700, color: isOverdue ? '#F53F3F' : '#1d1d1f' }}>
                      {fmt(inv.amount)}
                    </span>
                    {inv.dueDate && (
                      <div style={{
                        fontSize: 11, color: isOverdue ? '#F53F3F' : '#86909c',
                        marginTop: 2, display: 'flex', alignItems: 'center', gap: 3,
                      }}>
                        <Clock size={10} />
                        {t('teacher.assignmentDueDate')}: {dayjs(inv.dueDate).format('DD/MM/YYYY')}
                        {isOverdue && dayjs(inv.dueDate).isBefore(dayjs()) && ` (${t('student.overdue')})`}
                      </div>
                    )}
                  </div>

                  {canPay && (
                    <button
                      onClick={() => handlePay(inv.id)}
                      disabled={payingId === inv.id}
                      style={{
                        background: payingId === inv.id ? '#e0e0e0' : '#165DFF',
                        color: 'white', border: 'none', borderRadius: 16,
                        padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        cursor: payingId === inv.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {payingId === inv.id ? (
                        <DotLoading color="primary" style={{ '--size': '14px' } as React.CSSProperties} />
                      ) : (
                        t('parent.payNow')
                      )}
                    </button>
                  )}
                </div>

                {inv.paidAt && (
                  <div style={{ fontSize: 11, color: '#00B42A', marginTop: 4 }}>
                    <CheckCircle2 size={10} /> {t('parent.paid')}: {dayjs(inv.paidAt).format('DD/MM/YYYY HH:mm')}
                  </div>
                )}
              </div>
            )
          })
        )}

        <div style={{ height: 24 }} />
      </PullToRefresh>
    </AppLayout>
  )
}
