import { useEffect, useState } from 'react'
import {
  Modal, Form, Select, DatePicker, Input, Button, Alert, Space,
  Typography, Divider, Tag, Upload, message as antMessage,
} from 'antd'
import type { UploadFile } from 'antd'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarDays, Upload as UploadIcon, AlertCircle } from 'lucide-react'
import api from '../../lib/api'
import dayjs, { type Dayjs } from 'dayjs'

const { Text } = Typography
const { TextArea } = Input
const { RangePicker } = DatePicker

interface BalanceEntry {
  available: number
  total: number
}

interface Props {
  open: boolean
  defaultLeaveType?: string
  balances?: Record<string, BalanceEntry>
  onClose: () => void
  onSuccess: () => void
}

const LEAVE_TYPES = [
  { value: 'ANNUAL',        label: 'Annual Leave' },
  { value: 'MEDICAL',       label: 'Medical Leave' },
  { value: 'MATERNITY',     label: 'Maternity Leave' },
  { value: 'PATERNITY',     label: 'Paternity Leave' },
  { value: 'UNPAID',        label: 'Unpaid Leave' },
  { value: 'HAJJ',          label: 'Hajj Leave' },
  { value: 'COMPASSIONATE', label: 'Compassionate Leave' },
  { value: 'EMERGENCY',     label: 'Emergency Leave' },
]

const LeaveApplicationModal = ({ open, defaultLeaveType, balances, onClose, onSuccess }: Props) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [leaveType, setLeaveType] = useState<string>(defaultLeaveType ?? 'ANNUAL')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      form.resetFields()
      setLeaveType(defaultLeaveType ?? 'ANNUAL')
      setDateRange(null)
      setUploadedDocUrl(null)
      setFileList([])
      if (defaultLeaveType) {
        form.setFieldValue('leaveType', defaultLeaveType)
      }
    }
  }, [open, defaultLeaveType, form])

  // Fetch working-days from backend whenever date range changes
  const { data: workingDaysData, isFetching: calculatingDays } = useQuery({
    queryKey: ['working-days', dateRange?.[0]?.format('YYYY-MM-DD'), dateRange?.[1]?.format('YYYY-MM-DD')],
    queryFn: async () => {
      if (!dateRange) return null
      const { data } = await api.get('/leave/working-days', {
        params: {
          start: dateRange[0].format('YYYY-MM-DD'),
          end:   dateRange[1].format('YYYY-MM-DD'),
        },
      })
      return data.data as { workingDays: number; start: string; end: string }
    },
    enabled: !!dateRange,
  })

  const workingDays = workingDaysData?.workingDays ?? 0

  // Balance check
  const balance = balances?.[leaveType]
  const hasInsufficientBalance =
    balance !== undefined &&
    !['HAJJ', 'COMPASSIONATE', 'EMERGENCY'].includes(leaveType) &&
    workingDays > 0 &&
    workingDays > balance.available

  const requiresDocument = leaveType === 'MEDICAL'
  const documentMissing  = requiresDocument && !uploadedDocUrl

  const submitMutation = useMutation({
    mutationFn: async (values: {
      leaveType: string
      dateRange: [Dayjs, Dayjs]
      reason?: string
    }) => {
      const { data } = await api.post('/leave/apply', {
        leaveType: values.leaveType,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate:   values.dateRange[1].format('YYYY-MM-DD'),
        reason:    values.reason,
        documentUrl: uploadedDocUrl ?? undefined,
      })
      return data
    },
    onSuccess: () => {
      antMessage.success(t('leave.applicationSubmitted', 'Leave application submitted successfully'))
      onSuccess()
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      antMessage.error(err?.response?.data?.message ?? t('leave.applicationError', 'Failed to submit leave application'))
    },
  })

  const handleUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('entityType', 'leave_application')
    formData.append('entityId', 'new')
    formData.append('description', 'Medical Certificate')
    try {
      const { data } = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUploadedDocUrl(data.data?.filename ?? data.data?.fileUrl ?? null)
      antMessage.success(t('leave.docUploaded', 'Document uploaded successfully'))
    } catch {
      antMessage.error(t('leave.docUploadError', 'Document upload failed'))
    }
    return false // prevent antd auto-upload
  }

  const handleFinish = (values: Record<string, unknown>) => {
    if (documentMissing) {
      antMessage.error(t('leave.mcRequired', 'Please upload a medical certificate for medical leave'))
      return
    }
    if (hasInsufficientBalance) {
      antMessage.error(t('leave.insufficientBalance', 'Insufficient leave balance'))
      return
    }
    submitMutation.mutate({
      leaveType: values.leaveType as string,
      dateRange: values.dateRange as [Dayjs, Dayjs],
      reason: values.reason as string | undefined,
    })
  }

  // Disable Fri (5) and Sat (6) in date picker (Brunei weekend)
  const disabledDate = (current: Dayjs) => {
    const dow = current.day()
    return dow === 5 || dow === 6
  }

  return (
    <Modal
      open={open}
      title={
        <Space>
          <CalendarDays size={18} />
          <span>{t('leave.applyForLeave', 'Apply for Leave')}</span>
        </Space>
      }
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ leaveType: defaultLeaveType ?? 'ANNUAL' }}
      >
        {/* Leave Type */}
        <Form.Item
          name="leaveType"
          label={t('leave.leaveType', 'Leave Type')}
          rules={[{ required: true }]}
        >
          <Select
            options={LEAVE_TYPES.map(lt => ({
              value: lt.value,
              label: (
                <Space>
                  <span>{t(`leaveType.${lt.value}`, lt.label)}</span>
                  {balances?.[lt.value] && !['HAJJ', 'COMPASSIONATE', 'EMERGENCY'].includes(lt.value) && (
                    <Tag color={balances[lt.value].available <= 3 ? 'error' : 'blue'} style={{ fontSize: 11 }}>
                      {balances[lt.value].available}d left
                    </Tag>
                  )}
                </Space>
              ),
            }))}
            onChange={(val: string) => setLeaveType(val)}
          />
        </Form.Item>

        {/* Date Range */}
        <Form.Item
          name="dateRange"
          label={
            <Space>
              <span>{t('leave.leavePeriod', 'Leave Period')}</span>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('leave.bruneWeekendNote', 'Fri & Sat are non-working days')}
              </Text>
            </Space>
          }
          rules={[{ required: true, message: t('leave.dateRequired', 'Please select leave dates') }]}
        >
          <RangePicker
            style={{ width: '100%' }}
            disabledDate={disabledDate}
            onChange={(vals) => {
              if (vals && vals[0] && vals[1]) {
                setDateRange([vals[0] as Dayjs, vals[1] as Dayjs])
              } else {
                setDateRange(null)
              }
            }}
            format="DD MMM YYYY"
          />
        </Form.Item>

        {/* Working Days Calculation */}
        {dateRange && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f0f7ff', borderRadius: 6, border: '1px solid #bae0ff' }}>
            <Space>
              <CalendarDays size={14} color="#1677ff" />
              {calculatingDays ? (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('leave.calculating', 'Calculating working days...')}
                </Text>
              ) : (
                <Text style={{ fontSize: 13 }}>
                  <Text strong style={{ color: '#1677ff' }}>{workingDays}</Text>
                  {' '}{t('leave.workingDays', 'working days')}
                  {' '}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('leave.weekendsExcluded', '(weekends & public holidays excluded)')}
                  </Text>
                </Text>
              )}
            </Space>
          </div>
        )}

        {/* Insufficient Balance Warning */}
        {hasInsufficientBalance && balance && (
          <Alert
            type="error"
            icon={<AlertCircle size={14} />}
            showIcon
            message={t(
              'leave.insufficientBalanceMsg',
              'Insufficient {{type}} balance. Available: {{available}} days, Requested: {{requested}} days.',
              { type: leaveType, available: balance.available, requested: workingDays },
            )}
            style={{ marginBottom: 12 }}
          />
        )}

        {/* Reason */}
        <Form.Item
          name="reason"
          label={t('leave.reason', 'Reason')}
          rules={leaveType === 'MEDICAL' ? [] : [{ required: false }]}
        >
          <TextArea
            rows={3}
            placeholder={t('leave.reasonPlaceholder', 'Brief reason for leave (optional)')}
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* Medical Certificate Upload */}
        {requiresDocument && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Form.Item
              label={
                <Space>
                  <span>{t('leave.medicalCertificate', 'Medical Certificate')}</span>
                  <Tag color="red">{t('leave.required', 'Required')}</Tag>
                </Space>
              }
              validateStatus={documentMissing ? 'error' : 'success'}
              help={documentMissing ? t('leave.mcRequiredHelp', 'A medical certificate is required for sick leave') : undefined}
            >
              <Upload
                fileList={fileList}
                beforeUpload={(file) => {
                  const isValidType = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)
                  const isValidSize = file.size / 1024 / 1024 < 5
                  if (!isValidType) { antMessage.error(t('leave.invalidFileType', 'Only PDF, JPG, PNG allowed')); return Upload.LIST_IGNORE }
                  if (!isValidSize) { antMessage.error(t('leave.fileTooLarge', 'File must be under 5 MB')); return Upload.LIST_IGNORE }
                  setFileList([{ uid: file.name, name: file.name, status: 'uploading' } as UploadFile])
                  handleUpload(file).then(() => {
                    setFileList([{ uid: file.name, name: file.name, status: 'done' } as UploadFile])
                  })
                  return false
                }}
                onRemove={() => { setUploadedDocUrl(null); setFileList([]) }}
                maxCount={1}
                accept=".pdf,.jpg,.jpeg,.png"
              >
                <Button icon={<UploadIcon size={14} />}>
                  {t('leave.uploadMC', 'Upload Medical Certificate')}
                </Button>
              </Upload>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                {t('leave.uploadNote', 'PDF, JPG, PNG · Max 5 MB')}
              </Text>
              {uploadedDocUrl && (
                <Text type="success" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {t('leave.docReady', 'Document uploaded and ready')}
                </Text>
              )}
            </Form.Item>
          </>
        )}

        {/* Non-MEDICAL optional upload note */}
        {!requiresDocument && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
            {t('leave.optionalDocNote', 'Supporting documents (optional) can be attached after submission from the Leave Management page.')}
          </Text>
        )}

        {/* Actions */}
        <Row style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitMutation.isPending}
            disabled={hasInsufficientBalance || (requiresDocument && !uploadedDocUrl)}
          >
            {t('leave.submitApplication', 'Submit Application')}
          </Button>
        </Row>
      </Form>
    </Modal>
  )
}

// Workaround for Row not having built-in gap support in some AD versions
const Row = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ display: 'flex', ...style }}>{children}</div>
)

export default LeaveApplicationModal
