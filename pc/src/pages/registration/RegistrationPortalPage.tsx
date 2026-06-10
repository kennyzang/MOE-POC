import { useState } from 'react'
import {
  Steps,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Card,
  Row,
  Col,
  Alert,
  Divider,
  Result,
  Space,
  Typography,
  Tag,
  Upload,
  message,
} from 'antd'
import type { UploadFile, UploadProps } from 'antd'

const COUNTRY_CODES = [
  { value: '+673', label: '🇧🇳 +673' },
  { value: '+60', label: '🇲🇾 +60' },
  { value: '+65', label: '🇸🇬 +65' },
  { value: '+62', label: '🇮🇩 +62' },
  { value: '+63', label: '🇵🇭 +63' },
  { value: '+66', label: '🇹🇭 +66' },
  { value: '+84', label: '🇻🇳 +84' },
  { value: '+44', label: '🇬🇧 +44' },
  { value: '+1', label: '🇺🇸 +1' },
  { value: '+61', label: '🇦🇺 +61' },
  { value: '+86', label: '🇨🇳 +86' },
  { value: '+91', label: '🇮🇳 +91' },
]
import {
  User,
  Users,
  School,
  FileText,
  CheckCircle,
  ClipboardList,
  ArrowLeft,
  ArrowRight,
  Copy,
} from 'lucide-react'
import api from '@/lib/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

const GRADE_OPTIONS = [
  'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6',
  'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12',
]

const DOC_TYPES = [
  { value: 'BIRTH_CERTIFICATE', label: 'Birth Certificate (required)', required: true },
  { value: 'STUDENT_IC', label: 'Child\'s IC / Passport (required)', required: true },
  { value: 'PARENT_IC', label: 'Parent/Guardian IC / Passport (required)', required: true },
  { value: 'PHOTO', label: 'Recent Passport Photo (required)', required: true },
  { value: 'REPORT_CARD', label: 'Previous School Report Card (optional)', required: false },
  { value: 'MEDICAL', label: 'Medical Report (optional)', required: false },
]

interface School { id: string; name: string; code: string; schoolType: string }

interface FormData {
  applicantName: string
  icNumber: string
  dateOfBirth: string
  gender: string
  nationality: string
  parentName: string
  parentIcNumber: string
  parentRelationship: string
  parentPhone: string
  parentEmail: string
  homeAddress: string
  schoolId: string
  gradeApplied: string
  programmeStream: string
  previousSchool: string
  specialNeeds: string
  medicalConditions: string
  previousAcademicAvg: string
}

export default function RegistrationPortalPage() {
  const [step, setStep] = useState(0)
  const [form1] = Form.useForm()
  const [form2] = Form.useForm()
  const [form3] = Form.useForm()
  const [formData, setFormData] = useState<Partial<FormData>>({})
  const [schools, setSchools] = useState<School[]>([])
  const [schoolsLoaded, setSchoolsLoaded] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<{ applicationNumber: string; applicantName: string; hasSiblingPriority: boolean }>()
  const [copied, setCopied] = useState(false)

  const loadSchools = async () => {
    if (schoolsLoaded) return
    try {
      const res = await api.get('/registration/schools')
      setSchools(res.data.data)
      setSchoolsLoaded(true)
    } catch {
      message.error('Failed to load school list')
    }
  }

  const nextStep = async (formInstance: typeof form1) => {
    try {
      const values = await formInstance.validateFields()
      // Merge country code into phone number for step 1 (parent info)
      if (values.parentPhone && values.parentPhoneCountryCode) {
        const raw = String(values.parentPhone).replace(/^\+?\d{1,4}[\s-]?/, '')
        values.parentPhone = `${values.parentPhoneCountryCode} ${raw}`
        delete values.parentPhoneCountryCode
      }
      setFormData(prev => ({ ...prev, ...values }))
      setStep(s => s + 1)
      if (step === 1) loadSchools()
    } catch {
      // validation failed — ant will show field errors
    }
  }

  const prevStep = () => setStep(s => s - 1)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const documentFilenames = await Promise.all(
        fileList.map(f => new Promise<{ type: string; filename: string; data: string; mimeType: string }>((resolve, reject) => {
          const file = (f as any).originFileObj as File
          if (!file) {
            resolve({ type: (f as any).docType || 'OTHER', filename: f.name, data: '', mimeType: '' })
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            // strip "data:...;base64," prefix
            const base64 = result.split(',')[1]
            resolve({
              type: (f as any).docType || 'OTHER',
              filename: f.name,
              data: base64,
              mimeType: file.type,
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })),
      )

      const payload = {
        ...formData,
        dateOfBirth: formData.dateOfBirth
          ? dayjs(formData.dateOfBirth).toISOString()
          : undefined,
        documentFilenames,
      }

      const res = await api.post('/registration/submit', payload)
      setResult({
        applicationNumber: res.data.data.applicationNumber,
        applicantName: formData.applicantName || '',
        hasSiblingPriority: res.data.data.hasSiblingPriority,
      })
      setSubmitted(true)
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Submission failed. Please try again.'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const copyId = () => {
    navigator.clipboard.writeText(result?.applicationNumber || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const STEPS = [
    { title: 'Student', icon: <User size={16} /> },
    { title: 'Parent', icon: <Users size={16} /> },
    { title: 'School', icon: <School size={16} /> },
    { title: 'Documents', icon: <FileText size={16} /> },
    { title: 'Review', icon: <ClipboardList size={16} /> },
  ]

  if (submitted && result) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Card style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>
          <Result
            status="success"
            title="Application Submitted Successfully!"
            subTitle={
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Text>Your application for <strong>{result.applicantName}</strong> has been received.</Text>
                <Card style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Your Application ID</Text>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                    <Title level={3} style={{ margin: 0, color: '#52c41a', fontFamily: 'monospace' }}>
                      {result.applicationNumber}
                    </Title>
                    <Button
                      size="small"
                      icon={<Copy size={14} />}
                      onClick={copyId}
                      type={copied ? 'primary' : 'default'}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Save this ID to check your application status</Text>
                </Card>
                {result.hasSiblingPriority && (
                  <Alert type="info" message="Sibling priority has been applied to your application." showIcon />
                )}
                <Paragraph type="secondary">
                  The school admissions officer will review your application and may contact you for additional documents or an interview. You can track your application status at <strong>/register/status</strong> using your Application ID and Parent IC number.
                </Paragraph>
              </Space>
            }
          />
          <Button type="primary" href="/register/status" style={{ marginTop: 8 }}>
            Check Application Status
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 4 }}>Student Enrolment Registration</Title>
          <Text type="secondary">Ministry of Education — School Registration Portal</Text>
        </div>

        <Card style={{ marginBottom: 24 }}>
          <Steps
            current={step}
            items={STEPS.map(s => ({ title: s.title, icon: s.icon }))}
            size="small"
          />
        </Card>

        {/* Step 0 — Student Biodata */}
        {step === 0 && (
          <Card title={<Space><User size={18} /> Student Information</Space>}>
            <Form form={form1} layout="vertical" initialValues={formData}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="applicantName" label="Student Full Name" rules={[{ required: true, message: 'Student name is required' }]}>
                    <Input placeholder="As per IC / Passport" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="icNumber" label="IC / Passport Number">
                    <Input placeholder="e.g. BN20100312" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="dateOfBirth" label="Date of Birth" rules={[{ required: true, message: 'Date of birth is required' }]}>
                    <DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs())} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
                    <Select placeholder="Select gender">
                      <Option value="Male">Male</Option>
                      <Option value="Female">Female</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="nationality" label="Nationality" rules={[{ required: true }]}>
                    <Select placeholder="Select nationality" showSearch>
                      <Option value="Bruneian">Bruneian</Option>
                      <Option value="Malaysian">Malaysian</Option>
                      <Option value="Indonesian">Indonesian</Option>
                      <Option value="Filipino">Filipino</Option>
                      <Option value="Other">Other</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Form>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button type="primary" icon={<ArrowRight size={14} />} iconPosition="end" onClick={() => nextStep(form1)}>
                Next: Parent Information
              </Button>
            </div>
          </Card>
        )}

        {/* Step 1 — Parent/Guardian */}
        {step === 1 && (
          <Card title={<Space><Users size={18} /> Parent / Guardian Information</Space>}>
            <Form form={form2} layout="vertical" initialValues={formData}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="parentName" label="Parent / Guardian Full Name" rules={[{ required: true }]}>
                    <Input placeholder="As per IC" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="parentIcNumber" label="Parent IC / Passport Number" rules={[{ required: true, message: 'Parent IC is required for status lookup' }]}>
                    <Input placeholder="Required to check application status" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="parentRelationship" label="Relationship" rules={[{ required: true }]}>
                    <Select placeholder="Select relationship">
                      <Option value="Father">Father</Option>
                      <Option value="Mother">Mother</Option>
                      <Option value="Guardian">Legal Guardian</Option>
                      <Option value="Other">Other</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="parentPhone" label="Contact Number" rules={[{ required: true, message: 'Contact number is required' }]}>
                    <Input
                      addonBefore={
                        <Form.Item name="parentPhoneCountryCode" noStyle initialValue="+673">
                          <Select style={{ width: 110 }} options={COUNTRY_CODES} />
                        </Form.Item>
                      }
                      placeholder="7xxxxxx"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="parentEmail" label="Email Address">
                    <Input type="email" placeholder="For notifications and correspondence" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="homeAddress" label="Home Address" rules={[{ required: true }]}>
                    <Input.TextArea rows={2} placeholder="Full home address" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <Button icon={<ArrowLeft size={14} />} onClick={prevStep}>Back</Button>
              <Button type="primary" icon={<ArrowRight size={14} />} iconPosition="end" onClick={() => nextStep(form2)}>
                Next: School & Academic
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2 — School & Academic */}
        {step === 2 && (
          <Card title={<Space><School size={18} /> School & Academic Details</Space>}>
            <Form form={form3} layout="vertical" initialValues={formData}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="schoolId" label="Preferred School" rules={[{ required: true }]}>
                    <Select
                      placeholder="Select school"
                      showSearch
                      filterOption={(v, o) => (o?.children as unknown as string)?.toLowerCase().includes(v.toLowerCase())}
                      onFocus={loadSchools}
                      loading={!schoolsLoaded}
                    >
                      {schools.map(s => (
                        <Option key={s.id} value={s.id}>{s.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="gradeApplied" label="Grade Applying For" rules={[{ required: true }]}>
                    <Select placeholder="Select grade">
                      {GRADE_OPTIONS.map(g => <Option key={g} value={g}>{g}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="programmeStream" label="Programme Stream">
                    <Select placeholder="Select stream (if applicable)">
                      <Option value="Academic">Academic</Option>
                      <Option value="Vocational">Vocational</Option>
                      <Option value="Religious">Religious</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="previousSchool" label="Previous School (if any)">
                    <Input placeholder="Name of previous school" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="previousAcademicAvg" label="Previous Academic Average (%)">
                    <Input type="number" min={0} max={100} placeholder="0–100" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="medicalConditions" label="Medical Conditions (if any)">
                    <Input.TextArea rows={2} placeholder="List any known medical conditions" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="specialNeeds" label="Special Needs / Learning Difficulties (if any)">
                    <Input.TextArea rows={2} placeholder="Describe any special educational needs or learning difficulties" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <Button icon={<ArrowLeft size={14} />} onClick={prevStep}>Back</Button>
              <Button type="primary" icon={<ArrowRight size={14} />} iconPosition="end" onClick={() => nextStep(form3)}>
                Next: Documents
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3 — Documents */}
        {step === 3 && (
          <Card title={<Space><FileText size={18} /> Document Upload</Space>}>
            <Alert
              type="info"
              message="Accepted formats: PDF, JPG, PNG (max 5MB each). Documents marked as required must be uploaded before proceeding."
              style={{ marginBottom: 16 }}
            />
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {DOC_TYPES.map(dt => {
                const docFiles = fileList.filter(f => (f as any).docType === dt.value)
                const handleChange: UploadProps['onChange'] = ({ fileList: newList }) => {
                  // keep only valid entries for this docType; preserve other types
                  const othersUnchanged = fileList.filter(f => (f as any).docType !== dt.value)
                  const tagged = newList
                    .filter(f => f.status !== 'error')
                    .map(f => Object.assign(f, { docType: dt.value }))
                  setFileList([...othersUnchanged, ...tagged])
                }
                return (
                  <Card key={dt.value} size="small" style={{ borderColor: dt.required ? '#1677ff' : '#d9d9d9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text strong>{dt.label}</Text>
                      {dt.required
                        ? docFiles.length > 0
                          ? <Tag color="success">Uploaded</Tag>
                          : <Tag color="blue">Required</Tag>
                        : <Tag>Optional</Tag>}
                    </div>
                    <Upload
                      beforeUpload={(file) => {
                        const isValidType = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)
                        const isValidSize = file.size / 1024 / 1024 < 5
                        if (!isValidType) { message.error('Only PDF, JPG, PNG allowed'); return Upload.LIST_IGNORE }
                        if (!isValidSize) { message.error('File must be under 5MB'); return Upload.LIST_IGNORE }
                        return false
                      }}
                      onChange={handleChange}
                      fileList={docFiles}
                      onRemove={(file) => setFileList(prev => prev.filter(f => f.uid !== file.uid))}
                      maxCount={1}
                      accept=".pdf,.jpg,.jpeg,.png"
                    >
                      <Button size="small">Select File</Button>
                    </Upload>
                  </Card>
                )
              })}
            </Space>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <Button icon={<ArrowLeft size={14} />} onClick={prevStep}>Back</Button>
              <Button
                type="primary"
                icon={<ArrowRight size={14} />}
                iconPosition="end"
                onClick={() => {
                  const missing = DOC_TYPES.filter(
                    d => d.required && !fileList.some(f => (f as any).docType === d.value),
                  )
                  if (missing.length > 0) {
                    message.error(`Please upload required documents: ${missing.map(d => d.label.split(' (')[0]).join(', ')}`)
                    return
                  }
                  setStep(4)
                }}
              >
                Next: Review
              </Button>
            </div>
          </Card>
        )}

        {/* Step 4 — Review & Submit */}
        {step === 4 && (
          <Card title={<Space><ClipboardList size={18} /> Review & Submit</Space>}>
            <Alert
              type="warning"
              message="Please review all information carefully before submitting. Once submitted, you cannot edit your application."
              style={{ marginBottom: 16 }}
            />

            <Title level={5}>Student Information</Title>
            <Row gutter={8} style={{ marginBottom: 12 }}>
              <Col span={12}><Text type="secondary">Name:</Text> <Text>{formData.applicantName}</Text></Col>
              <Col span={12}><Text type="secondary">IC/Passport:</Text> <Text>{formData.icNumber || '—'}</Text></Col>
              <Col span={12}><Text type="secondary">Date of Birth:</Text> <Text>{formData.dateOfBirth ? dayjs(formData.dateOfBirth).format('DD MMM YYYY') : '—'}</Text></Col>
              <Col span={12}><Text type="secondary">Gender:</Text> <Text>{formData.gender || '—'}</Text></Col>
              <Col span={12}><Text type="secondary">Nationality:</Text> <Text>{formData.nationality || '—'}</Text></Col>
            </Row>

            <Divider />
            <Title level={5}>Parent / Guardian</Title>
            <Row gutter={8} style={{ marginBottom: 12 }}>
              <Col span={12}><Text type="secondary">Name:</Text> <Text>{formData.parentName}</Text></Col>
              <Col span={12}><Text type="secondary">IC/Passport:</Text> <Text>{formData.parentIcNumber}</Text></Col>
              <Col span={12}><Text type="secondary">Relationship:</Text> <Text>{formData.parentRelationship}</Text></Col>
              <Col span={12}><Text type="secondary">Phone:</Text> <Text>{formData.parentPhone}</Text></Col>
              <Col span={24}><Text type="secondary">Address:</Text> <Text>{formData.homeAddress}</Text></Col>
            </Row>

            <Divider />
            <Title level={5}>School & Academic</Title>
            <Row gutter={8} style={{ marginBottom: 12 }}>
              <Col span={12}><Text type="secondary">School:</Text> <Text>{schools.find(s => s.id === formData.schoolId)?.name || formData.schoolId}</Text></Col>
              <Col span={12}><Text type="secondary">Grade:</Text> <Text>{formData.gradeApplied}</Text></Col>
              <Col span={12}><Text type="secondary">Stream:</Text> <Text>{formData.programmeStream || '—'}</Text></Col>
              <Col span={12}><Text type="secondary">Previous School:</Text> <Text>{formData.previousSchool || '—'}</Text></Col>
            </Row>

            <Divider />
            <Title level={5}>Documents ({fileList.length} file{fileList.length !== 1 ? 's' : ''} selected)</Title>
            {fileList.length === 0
              ? <Text type="secondary">No documents attached.</Text>
              : fileList.map(f => (
                  <Tag key={f.uid} style={{ marginBottom: 4 }}>
                    <CheckCircle size={12} style={{ marginRight: 4 }} />{f.name}
                  </Tag>
                ))
            }

            {DOC_TYPES.filter(d => d.required && !fileList.some(f => (f as any).docType === d.value)).length > 0 && (
              <Alert
                type="warning"
                style={{ marginTop: 12 }}
                message={`Missing required documents: ${DOC_TYPES.filter(d => d.required && !fileList.some(f => (f as any).docType === d.value)).map(d => d.label.split(' (')[0]).join(', ')}`}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <Button icon={<ArrowLeft size={14} />} onClick={prevStep}>Back</Button>
              <Button
                type="primary"
                loading={submitting}
                onClick={handleSubmit}
                icon={<CheckCircle size={14} />}
                size="large"
              >
                Submit Application
              </Button>
            </div>
          </Card>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary">
            Already submitted? <a href="/register/status">Check application status</a>
          </Text>
        </div>
      </div>
    </div>
  )
}
