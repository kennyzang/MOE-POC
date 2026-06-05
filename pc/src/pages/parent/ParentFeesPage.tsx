import { useState, useRef } from 'react'
import {
  Card, Row, Col, Table, Tag, Statistic, Spin, Typography, Space, Button, Modal,
  Form, Input, Select, Divider, Steps, Result, message,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, CheckCircle, AlertTriangle, FileText, CreditCard, Building2, Landmark } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import api from '@/lib/api'

const { Title, Text } = Typography

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
  lineItems?: string | null
}

interface FeeData {
  invoices: Invoice[]
  summary: { totalBilled: number; paid: number; outstanding: number }
}

const STATUS_COLOR: Record<string, string> = { paid: 'green', unpaid: 'orange', overdue: 'red' }

// ─── Payment Modal ──────────────────────────────────────────────────────────

type PaymentMethod = 'card' | 'fpx' | 'bank'
type PayStep = 'method' | 'details' | 'processing' | 'success'

const FPX_BANKS = [
  'Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank',
  'AmBank', 'Bank Islam', 'Bank Rakyat', 'Affin Bank', 'BSN',
]

function formatCardNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

function detectCardType(number: string): string {
  const n = number.replace(/\s/g, '')
  if (/^4/.test(n)) return 'VISA'
  if (/^5[1-5]/.test(n)) return 'Mastercard'
  if (/^3[47]/.test(n)) return 'Amex'
  return ''
}

function mockTxnId(): string {
  return 'TXN-' + Math.random().toString(36).substring(2, 10).toUpperCase()
}

interface PaymentModalProps {
  invoice: Invoice | null
  open: boolean
  onClose: () => void
  onPaid: (invoiceId: string) => void
}

function PaymentModal({ invoice, open, onClose, onPaid }: PaymentModalProps) {
  const [step, setStep] = useState<PayStep>('method')
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [txnId, setTxnId] = useState('')
  const [form] = Form.useForm()
  const processingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const payMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/parent/fees/${id}/pay`)
      return data
    },
    onSuccess: () => {
      setTxnId(mockTxnId())
      setStep('success')
      if (invoice) onPaid(invoice.id)
    },
    onError: () => {
      message.error('Payment failed. Please try again.')
      setStep('details')
    },
  })

  const handleClose = () => {
    setStep('method')
    setMethod(null)
    setCardNumber('')
    setTxnId('')
    form.resetFields()
    onClose()
  }

  const handleMethodSelect = (m: PaymentMethod) => {
    setMethod(m)
    setStep('details')
  }

  const handlePay = async () => {
    try {
      await form.validateFields()
    } catch {
      return
    }
    setStep('processing')
    if (processingRef.current) clearTimeout(processingRef.current)
    processingRef.current = setTimeout(() => {
      if (invoice) payMutation.mutate(invoice.id)
    }, 2000)
  }

  const fmt = (n: number) => `BND ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <Modal
      title="Online Payment"
      open={open}
      onCancel={step === 'success' || step === 'processing' ? undefined : handleClose}
      closable={step !== 'processing' && step !== 'success'}
      footer={null}
      width={480}
      destroyOnHidden
    >
      {invoice && (
        <>
          {/* Invoice summary */}
          {step !== 'success' && (
            <Card size="small" style={{ marginBottom: 20, background: '#f6f8ff', border: '1px solid #d0e0ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <Text strong>{invoice.studentName}</Text>
                  <div style={{ fontSize: 12, color: '#888' }}>{invoice.description ?? invoice.semester ?? 'Fee Invoice'}</div>
                  {invoice.invoiceNumber && <div style={{ fontSize: 12, color: '#888' }}>#{invoice.invoiceNumber}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#165DFF' }}>{fmt(invoice.amount)}</div>
                  {invoice.dueDate && (
                    <div style={{ fontSize: 12, color: '#f5222d' }}>Due: {new Date(invoice.dueDate).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Step indicator */}
          {step !== 'success' && (
            <Steps
              size="small"
              current={step === 'method' ? 0 : step === 'details' ? 1 : 2}
              items={[{ title: 'Method' }, { title: 'Details' }, { title: 'Confirm' }]}
              style={{ marginBottom: 24 }}
            />
          )}

          {/* Step 1 — Method selection */}
          {step === 'method' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Text strong style={{ marginBottom: 4 }}>Select Payment Method</Text>
              {[
                { key: 'card' as PaymentMethod, icon: <CreditCard size={24} color="#165DFF" />, label: 'Credit / Debit Card', desc: 'Visa, Mastercard, Amex' },
                { key: 'fpx' as PaymentMethod, icon: <Building2 size={24} color="#52c41a" />, label: 'FPX Online Banking', desc: 'Transfer from your bank account' },
                { key: 'bank' as PaymentMethod, icon: <Landmark size={24} color="#fa8c16" />, label: 'Bank Transfer', desc: 'Manual bank transfer' },
              ].map((m) => (
                <div
                  key={m.key}
                  onClick={() => handleMethodSelect(m.key)}
                  style={{
                    border: '1.5px solid #d9d9d9',
                    borderRadius: 10,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#165DFF'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 2px rgba(22,93,255,0.12)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#d9d9d9'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
                >
                  {m.icon}
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{m.desc}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 18, color: '#bbb' }}>›</div>
                </div>
              ))}
            </div>
          )}

          {/* Step 2 — Card details */}
          {step === 'details' && method === 'card' && (
            <Form form={form} layout="vertical">
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={16} color="#165DFF" />
                <Text strong>Credit / Debit Card</Text>
                {detectCardType(cardNumber) && (
                  <Tag color="blue" style={{ marginLeft: 4 }}>{detectCardType(cardNumber)}</Tag>
                )}
              </div>
              <Form.Item
                name="cardholderName"
                label="Cardholder Name"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="FULL NAME AS ON CARD" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
              <Form.Item
                name="cardNumber"
                label="Card Number"
                rules={[
                  { required: true, message: 'Required' },
                  { len: 19, message: 'Enter 16-digit card number' },
                ]}
              >
                <Input
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => {
                    const formatted = formatCardNumber(e.target.value)
                    setCardNumber(formatted)
                    form.setFieldValue('cardNumber', formatted)
                  }}
                />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="expiry"
                    label="Expiry Date"
                    rules={[
                      { required: true, message: 'Required' },
                      { pattern: /^(0[1-9]|1[0-2])\/\d{2}$/, message: 'Format: MM/YY' },
                    ]}
                  >
                    <Input
                      placeholder="MM/YY"
                      maxLength={5}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, '')
                        if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2, 4)
                        form.setFieldValue('expiry', v)
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="cvv"
                    label="CVV / CVC"
                    rules={[
                      { required: true, message: 'Required' },
                      { pattern: /^\d{3,4}$/, message: '3 or 4 digits' },
                    ]}
                  >
                    <Input placeholder="•••" maxLength={4} type="password" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="billingAddress" label="Billing Address (optional)">
                <Input placeholder="123 Jalan Tutong, Bandar Seri Begawan" />
              </Form.Item>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, color: '#52c41a', fontSize: 12 }}>
                <CheckCircle size={14} />
                <span>256-bit SSL encrypted · Your card details are secure</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={() => { setStep('method'); form.resetFields(); setCardNumber('') }}>Back</Button>
                <Button type="primary" onClick={handlePay} style={{ flex: 1 }}>
                  Pay {fmt(invoice.amount)}
                </Button>
              </div>
            </Form>
          )}

          {/* Step 2b — FPX bank selection */}
          {step === 'details' && method === 'fpx' && (
            <Form form={form} layout="vertical">
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} color="#52c41a" />
                <Text strong>FPX Online Banking</Text>
              </div>
              <Form.Item
                name="fpxBank"
                label="Select Your Bank"
                rules={[{ required: true, message: 'Please select a bank' }]}
              >
                <Select
                  placeholder="Choose bank..."
                  options={FPX_BANKS.map((b) => ({ value: b, label: b }))}
                  size="large"
                />
              </Form.Item>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
                You will be redirected to your bank's secure login page to authorise payment.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={() => { setStep('method'); form.resetFields() }}>Back</Button>
                <Button type="primary" onClick={handlePay} style={{ flex: 1 }}>
                  Proceed to Bank — {fmt(invoice.amount)}
                </Button>
              </div>
            </Form>
          )}

          {/* Step 2c — Bank Transfer */}
          {step === 'details' && method === 'bank' && (
            <div>
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Landmark size={16} color="#fa8c16" />
                <Text strong>Bank Transfer Details</Text>
              </div>
              <Card size="small" style={{ marginBottom: 16, background: '#fffbe6', border: '1px solid #ffe58f' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Bank', 'Bank Islam Brunei Darussalam (BIBD)'],
                    ['Account Name', 'MOE School Collections'],
                    ['Account Number', '01-234-5678-9'],
                    ['Reference', invoice.invoiceNumber ?? invoice.id.slice(0, 8).toUpperCase()],
                    ['Amount', fmt(invoice.amount)],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">{label}</Text>
                      <Text strong copyable>{value}</Text>
                    </div>
                  ))}
                </div>
              </Card>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
                After transferring, click "Confirm Transfer" and the payment will be marked as received.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={() => setStep('method')}>Back</Button>
                <Button type="primary" onClick={handlePay} style={{ flex: 1 }}>
                  Confirm Transfer
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Processing */}
          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 20, fontWeight: 600, fontSize: 16 }}>Processing Payment…</div>
              <div style={{ color: '#888', marginTop: 8 }}>Please do not close this window</div>
            </div>
          )}

          {/* Step 4 — Success */}
          {step === 'success' && (
            <Result
              status="success"
              title="Payment Successful!"
              subTitle={
                <div style={{ textAlign: 'left', marginTop: 16 }}>
                  {[
                    ['Transaction ID', txnId],
                    ['Amount Paid', fmt(invoice.amount)],
                    ['Student', invoice.studentName],
                    ['Date', new Date().toLocaleString()],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <Text type="secondary">{label}</Text>
                      <Text strong>{value}</Text>
                    </div>
                  ))}
                </div>
              }
              extra={[
                <Button key="close" onClick={handleClose}>Close</Button>,
                <Button key="invoice" type="primary" icon={<FileText size={14} />} onClick={handleClose}>
                  View Invoice
                </Button>,
              ]}
            />
          )}
        </>
      )}
    </Modal>
  )
}

// ─── Invoice Preview Modal ───────────────────────────────────────────────────

interface InvoicePreviewProps {
  invoice: Invoice | null
  open: boolean
  onClose: () => void
}

function InvoicePreviewModal({ invoice, open, onClose }: InvoicePreviewProps) {
  if (!invoice) return null

  const fmt = (n: number) => `BND ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  let lineItems: Array<{ code?: string; name: string; amount: number }> = []
  if (invoice.lineItems) {
    try { lineItems = JSON.parse(invoice.lineItems) } catch { /* ignore */ }
  }
  if (lineItems.length === 0) {
    lineItems = [{ name: invoice.description ?? 'School Fee', amount: invoice.amount }]
  }

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-print-area')
    if (!printContent) return
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber ?? invoice.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #222; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
            .label { color: #888; font-size: 12px; }
            .value { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #f5f5f5; text-align: left; padding: 10px; font-size: 13px; }
            td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
            .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #222; }
            .footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; }
            .status-paid { color: #52c41a; font-weight: 700; }
            .status-unpaid { color: #fa8c16; font-weight: 700; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  return (
    <Modal
      title={
        <Space>
          <FileText size={16} />
          Invoice Preview
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        <Button key="print" type="primary" icon={<FileText size={14} />} onClick={handlePrint}>
          Download / Print PDF
        </Button>,
      ]}
      destroyOnHidden
    >
      <div id="invoice-print-area" style={{ fontFamily: 'Arial, sans-serif', padding: 8 }}>
        {/* School header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#165DFF' }}>MOE School</div>
            <div style={{ fontSize: 12, color: '#888' }}>Ministry of Education · Brunei Darussalam</div>
            <div style={{ fontSize: 12, color: '#888' }}>Jalan Dewan Bahasa, Bandar Seri Begawan</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#333' }}>INVOICE</div>
            <div style={{ fontSize: 13, color: '#888' }}>
              #{invoice.invoiceNumber ?? invoice.id.slice(0, 8).toUpperCase()}
            </div>
            {invoice.status === 'paid' && (
              <div style={{ fontSize: 13, color: '#52c41a', fontWeight: 700, marginTop: 4 }}>✓ PAID</div>
            )}
            {invoice.status === 'unpaid' && (
              <div style={{ fontSize: 13, color: '#fa8c16', fontWeight: 700, marginTop: 4 }}>UNPAID</div>
            )}
            {invoice.status === 'overdue' && (
              <div style={{ fontSize: 13, color: '#f5222d', fontWeight: 700, marginTop: 4 }}>OVERDUE</div>
            )}
          </div>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* Bill to / dates */}
        <Row gutter={24} style={{ marginBottom: 20 }}>
          <Col span={12}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>BILL TO</div>
            <div style={{ fontWeight: 600 }}>{invoice.studentName}</div>
            {invoice.semester && <div style={{ fontSize: 12, color: '#888' }}>{invoice.semester}</div>}
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#888' }}>ISSUE DATE</div>
            <div style={{ fontWeight: 600 }}>{new Date().toLocaleDateString()}</div>
            {invoice.dueDate && (
              <>
                <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>DUE DATE</div>
                <div style={{ fontWeight: 600, color: '#f5222d' }}>{new Date(invoice.dueDate).toLocaleDateString()}</div>
              </>
            )}
            {invoice.paidAt && (
              <>
                <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>PAID ON</div>
                <div style={{ fontWeight: 600, color: '#52c41a' }}>{new Date(invoice.paidAt).toLocaleDateString()}</div>
              </>
            )}
          </Col>
        </Row>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Description</th>
              <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 8px', fontSize: 13 }}>
                  {item.code ? <span style={{ color: '#888', marginRight: 8 }}>[{item.code}]</span> : null}
                  {item.name}
                </td>
                <td style={{ padding: '10px 8px', fontSize: 13, textAlign: 'right' }}>{fmt(item.amount)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #222' }}>
              <td style={{ padding: '12px 8px', fontWeight: 700, fontSize: 15 }}>Total</td>
              <td style={{ padding: '12px 8px', fontWeight: 700, fontSize: 15, textAlign: 'right', color: '#165DFF' }}>
                {fmt(invoice.amount)}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          This is a computer-generated document. No signature required. · MOE School Finance Department
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const ParentFeesPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)

  const { data: feeData, isLoading } = useQuery({
    queryKey: ['parent-fees'],
    queryFn: async () => {
      const { data } = await api.get('/parent/fees')
      return data.data as FeeData
    },
  })

  const fmt = (n: number) =>
    `BND ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handlePaid = (invoiceId: string) => {
    void queryClient.invalidateQueries({ queryKey: ['parent-fees'] })
    // Update local data optimistically so the preview can reflect paid status
    const updatedInvoices = feeData?.invoices.map((inv) =>
      inv.id === invoiceId ? { ...inv, status: 'paid', paidAt: new Date().toISOString() } : inv
    )
    if (updatedInvoices) {
      const paid = updatedInvoices.find((i) => i.id === invoiceId)
      if (paid) setPreviewInvoice(paid)
    }
  }

  const columns: ColumnsType<Invoice> = [
    {
      title: t('students.title'),
      dataIndex: 'studentName',
      key: 'studentName',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: t('finance.invoiceAmount'),
      dataIndex: 'amount',
      key: 'amount',
      render: (amt: number) => fmt(amt),
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: t('courses.semester'),
      dataIndex: 'semester',
      key: 'semester',
      render: (s: string | null) => s ?? '—',
    },
    {
      title: t('finance.dueDate'),
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—'),
      sorter: (a, b) =>
        (a.dueDate ? new Date(a.dueDate).getTime() : 0) -
        (b.dueDate ? new Date(b.dueDate).getTime() : 0),
    },
    {
      title: t('finance.invoiceStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={STATUS_COLOR[s] ?? 'default'}>{t(`finance.${s}` as never, s)}</Tag>
      ),
      filters: [
        { text: t('finance.paid'), value: 'paid' },
        { text: t('finance.unpaid'), value: 'unpaid' },
        { text: t('finance.overdue'), value: 'overdue' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: t('finance.paidAt'),
      dataIndex: 'paidAt',
      key: 'paidAt',
      render: (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—'),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<FileText size={13} />}
            onClick={() => setPreviewInvoice(record)}
          >
            Invoice
          </Button>
          {(record.status === 'unpaid' || record.status === 'overdue') && (
            <Button
              size="small"
              type="primary"
              icon={<CreditCard size={13} />}
              onClick={() => setPayingInvoice(record)}
            >
              Pay Now
            </Button>
          )}
        </Space>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const summary = feeData?.summary ?? { totalBilled: 0, paid: 0, outstanding: 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <Card style={{ marginBottom: 0 }}>
        <Space align="center">
          <DollarSign size={24} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>
            {t('parentPortal.feeInvoices', { defaultValue: 'Fee Invoices' })}
          </Title>
        </Space>
      </Card>

      {/* Summary KPIs */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('finance.totalFees')}
              value={fmt(summary.totalBilled)}
              prefix={<DollarSign size={16} color="#165DFF" style={{ marginRight: 4 }} />}
              styles={{ content: { color: '#165DFF', fontWeight: 700 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('finance.totalCollected')}
              value={fmt(summary.paid)}
              prefix={<CheckCircle size={16} color="#52c41a" style={{ marginRight: 4 }} />}
              styles={{ content: { color: '#52c41a', fontWeight: 700 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('finance.totalOutstanding')}
              value={fmt(summary.outstanding)}
              prefix={<AlertTriangle size={16} color={summary.outstanding > 0 ? '#f5222d' : '#52c41a'} style={{ marginRight: 4 }} />}
              styles={{ content: { color: summary.outstanding > 0 ? '#f5222d' : '#52c41a', fontWeight: 700 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Invoice Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={feeData?.invoices ?? []}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{ emptyText: t('common.noData') }}
          size="middle"
        />
      </Card>

      {/* Payment Modal */}
      <PaymentModal
        invoice={payingInvoice}
        open={!!payingInvoice}
        onClose={() => setPayingInvoice(null)}
        onPaid={handlePaid}
      />

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        invoice={previewInvoice}
        open={!!previewInvoice}
        onClose={() => setPreviewInvoice(null)}
      />
    </div>
  )
}

export default ParentFeesPage
