import { useState } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Steps,
  Tag,
  Alert,
  Space,
  Divider,
  List,
  Badge,
  Row,
  Col,
  message,
} from 'antd'
import { Search, FileText, CheckCircle, XCircle, Clock, AlertCircle, UserCheck, Copy } from 'lucide-react'
import api from '@/lib/api'

const { Title, Text, Paragraph } = Typography

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  draft:                { color: 'default',   label: 'Draft',                       icon: <Clock size={14} /> },
  submitted:            { color: 'blue',      label: 'Submitted — Awaiting Review', icon: <Clock size={14} /> },
  under_review:         { color: 'processing',label: 'Under Review',                icon: <Search size={14} /> },
  documents_required:   { color: 'warning',   label: 'Additional Documents Required',icon: <AlertCircle size={14} /> },
  offer_issued:         { color: 'cyan',      label: 'Offer Issued',                icon: <FileText size={14} /> },
  offer_accepted:       { color: 'success',   label: 'Enrolled',                    icon: <CheckCircle size={14} /> },
  rejected:             { color: 'error',     label: 'Application Rejected',        icon: <XCircle size={14} /> },
  waitlisted:           { color: 'purple',    label: 'Waitlisted',                  icon: <Clock size={14} /> },
}

const DOC_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending:  { color: 'default', label: 'Pending Review' },
  verified: { color: 'success', label: 'Verified' },
  rejected: { color: 'error',   label: 'Rejected' },
  required: { color: 'warning', label: 'Additional Required' },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  BIRTH_CERTIFICATE: 'Birth Certificate',
  STUDENT_IC:        'Child\'s IC / Passport',
  PARENT_IC:         'Parent\'s IC / Passport',
  PHOTO:             'Passport Photo',
  REPORT_CARD:       'Previous School Report',
  MEDICAL:           'Medical Report',
  OTHER:             'Other Document',
}

interface ApplicationStatus {
  applicationNumber: string
  applicantName: string
  gradeApplied: string
  status: string
  statusLabel: string
  submittedAt: string
  decidedAt?: string
  remarks?: string
  documentsRequiredNote?: string
  parentEmail?: string
  enrolledStudent?: {
    studentId: string
    className: string
    gradeLevel: string
    username: string
    password: string | null
  }
  documents: Array<{
    id: string
    type: string
    filename: string
    docStatus: string
    rejectionReason?: string
    uploadedAt: string
  }>
  timeline: Array<{ step: string; done: boolean; date?: string }>
}

export default function RegistrationStatusPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [appStatus, setAppStatus] = useState<ApplicationStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedUser, setCopiedUser] = useState(false)

  const handleSearch = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      setError(null)
      setAppStatus(null)

      const res = await api.get('/registration/status', {
        params: { appId: values.appId },
      })
      setAppStatus(res.data.data)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('No application found with that ID. Please check your details.')
      } else if (err.isAxiosError) {
        setError(err.response?.data?.message || 'Failed to fetch application status.')
      }
      // Validation errors are handled by form
    } finally {
      setLoading(false)
    }
  }

  const cfg = appStatus ? (STATUS_CONFIG[appStatus.status] ?? { color: 'default', label: appStatus.status, icon: null }) : null

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '24px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 4 }}>Application Status</Title>
          <Text type="secondary">Check the status of your student registration application</Text>
        </div>

        {/* Lookup Form */}
        <Card style={{ marginBottom: 24 }}>
          <Form form={form} layout="vertical" onFinish={handleSearch}>
            <Form.Item
              name="appId"
              label="Application ID or Student ID"
              rules={[{ required: true, message: 'Enter your Application ID or Student ID' }]}
            >
              <Input
                placeholder="e.g. APP-2026-0001 or STU2026001"
                style={{ textTransform: 'uppercase' }}
                onChange={e => form.setFieldValue('appId', e.target.value.toUpperCase())}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<Search size={14} />}
              block
            >
              Check Status
            </Button>
          </Form>
        </Card>

        {error && (
          <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
        )}

        {/* Status Result */}
        {appStatus && cfg && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* Overview Card */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <Title level={4} style={{ marginBottom: 4 }}>{appStatus.applicantName}</Title>
                  <Text type="secondary">{appStatus.applicationNumber} · Applying for {appStatus.gradeApplied}</Text>
                </div>
                <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 13, padding: '4px 12px' }}>
                  {cfg.label}
                </Tag>
              </div>

              {appStatus.submittedAt && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                  Submitted: {new Date(appStatus.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              )}
            </Card>

            {/* Progress Timeline */}
            <Card title="Application Progress">
              <Steps
                direction="vertical"
                size="small"
                current={appStatus.timeline.filter(t => t.done).length - 1}
                items={appStatus.timeline.map(t => ({
                  title: t.step,
                  description: t.date ? new Date(t.date).toLocaleDateString('en-GB') : undefined,
                  status: t.done ? 'finish' : 'wait',
                }))}
              />
            </Card>

            {/* Enrolled: show student account credentials */}
            {appStatus.status === 'offer_accepted' && appStatus.enrolledStudent && (
              <Card
                style={{ border: '2px solid #52c41a', background: '#f6ffed' }}
                title={
                  <Space>
                    <UserCheck size={18} color="#52c41a" />
                    <Text strong style={{ color: '#389e0d', fontSize: 16 }}>
                      Congratulations — Your Child is Now Enrolled!
                    </Text>
                  </Space>
                }
              >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Student ID</Text>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#1677ff' }}>
                        {appStatus.enrolledStudent.studentId}
                      </div>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Class Assigned</Text>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1d2129' }}>
                        {appStatus.enrolledStudent.className} ({appStatus.enrolledStudent.gradeLevel})
                      </div>
                    </Col>
                  </Row>
                  <Divider style={{ margin: '8px 0' }} />
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Student Login</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong style={{ fontSize: 14 }}>Username:</Text>
                      <Text code style={{ fontSize: 15 }}>{appStatus.enrolledStudent.username}</Text>
                      <Button
                        size="small"
                        icon={<Copy size={12} />}
                        onClick={() => {
                          navigator.clipboard.writeText(appStatus.enrolledStudent!.username)
                          setCopiedUser(true)
                          setTimeout(() => setCopiedUser(false), 2000)
                        }}
                        type={copiedUser ? 'primary' : 'default'}
                      >
                        {copiedUser ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                    {appStatus.enrolledStudent.password && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ fontSize: 14 }}>Password:</Text>
                        <Text code style={{ fontSize: 15 }}>{appStatus.enrolledStudent.password}</Text>
                        <Button
                          size="small"
                          icon={<Copy size={12} />}
                          onClick={() => {
                            navigator.clipboard.writeText(appStatus.enrolledStudent!.password!)
                            message.success('Password copied')
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    )}
                  </Space>
                  <Divider style={{ margin: '8px 0' }} />
                  <Alert
                    type="info"
                    showIcon
                    message={`Login credentials have also been sent to ${appStatus.parentEmail ?? 'your registered email'}.`}
                  />
                  <Button type="primary" href="/login">
                    Go to Student Login
                  </Button>
                </Space>
              </Card>
            )}

            {/* Special Alerts */}
            {appStatus.status === 'documents_required' && appStatus.documentsRequiredNote && (
              <Alert
                type="warning"
                showIcon
                message="Additional Documents Required"
                description={appStatus.documentsRequiredNote}
              />
            )}
            {appStatus.status === 'rejected' && appStatus.remarks && (
              <Alert
                type="error"
                showIcon
                message="Application Rejected"
                description={appStatus.remarks}
              />
            )}
            {appStatus.status === 'offer_issued' && (
              <Alert
                type="success"
                showIcon
                message="Congratulations! An offer has been issued."
                description="Please contact the school to accept your offer and complete the enrolment process."
              />
            )}
            {appStatus.status === 'waitlisted' && (
              <Alert
                type="info"
                showIcon
                message="Your application is on the waitlist."
                description="You will be notified if a place becomes available. Please contact the school for more information."
              />
            )}

            {/* Documents */}
            {appStatus.documents.length > 0 && (
              <Card title={<Space><FileText size={16} /> Submitted Documents</Space>}>
                <List
                  dataSource={appStatus.documents}
                  renderItem={doc => {
                    const dCfg = DOC_STATUS_CONFIG[doc.docStatus] ?? { color: 'default', label: doc.docStatus }
                    return (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Space>
                              <Text>{DOC_TYPE_LABELS[doc.type] ?? doc.type}</Text>
                              <Badge status={dCfg.color as any} text={dCfg.label} />
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size={0}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{doc.filename}</Text>
                              {doc.docStatus === 'rejected' && doc.rejectionReason && (
                                <Text type="danger" style={{ fontSize: 12 }}>Reason: {doc.rejectionReason}</Text>
                              )}
                            </Space>
                          }
                        />
                      </List.Item>
                    )
                  }}
                />
              </Card>
            )}
          </Space>
        )}

        <Divider />
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            Want to register a new student? <a href="/register">Start a new application</a>
          </Text>
        </div>
      </div>
    </div>
  )
}
