import { useState, useRef } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, Select, Switch, Tabs,
  Space, Popconfirm, message, Typography, Row, Col, InputNumber,
  DatePicker, Tooltip, Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Edit2, Trash2, RotateCcw, BookMarked } from 'lucide-react'
import dayjs from 'dayjs'
import api from '../../lib/api'
import SyncBadge from '../../components/SyncBadge'
import { useAuthStore } from '../../stores/authStore'
import type { StudentSearchResult } from '../../types'
import { useStudentSearch } from '../../hooks/useStudentSearch'

const { Title, Text } = Typography
const { Option } = Select

// ─── Types ────────────────────────────────────────────────────────────────────

interface LibraryBook {
  id: string
  schoolId: string
  isbn: string | null
  title: string
  author: string
  category: string
  totalCopies: number
  availableCopies: number
  kohaId: string | null
}

interface ActiveLoan {
  id: string
  bookId: string
  studentId: string
  bookTitle: string
  studentName: string
  className: string | null
  borrowedAt: string
  dueDate: string
  isOverdue: boolean
  overdueDays: number
  fineAmount: number
}

interface Hold {
  id: string
  bookId: string
  studentId: string
  bookTitle: string
  studentName: string
  requestedAt: string
  status: string
}

interface FineEntry {
  id: string
  bookTitle: string
  studentName: string
  dueDate: string
  returnedAt: string | null
  overdueDays: number
  fineAmount: number
  paid: boolean
}

type StudentOption = StudentSearchResult

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOK_CATEGORIES = ['Fiction', 'Non-Fiction', 'Reference', 'Textbook', 'Science', 'History', 'Mathematics', 'Language', 'Arts', 'General']

const HOLD_STATUS_COLORS: Record<string, string> = {
  waiting: 'orange',
  ready: 'green',
  cancelled: 'default',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'manager'].includes(user?.role ?? '')
  const canPayFine = ['admin', 'manager', 'finance'].includes(user?.role ?? '')

  // Tab
  const [activeTab, setActiveTab] = useState('catalogue')

  // Catalogue filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [availableOnly, setAvailableOnly] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handleSearchChange = (v: string) => {
    setSearch(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(v), 400)
  }

  // Loans filter
  const [overdueOnly, setOverdueOnly] = useState(false)

  // Book modal
  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [editingBook, setEditingBook] = useState<LibraryBook | null>(null)
  const [bookForm] = Form.useForm()

  // Borrow modal
  const [borrowModalOpen, setBorrowModalOpen] = useState(false)
  const [borrowBook, setBorrowBook] = useState<LibraryBook | null>(null)
  const [borrowForm] = Form.useForm()
  const [borrowSearch, setBorrowSearch] = useState('')

  // Hold modal
  const [holdModalOpen, setHoldModalOpen] = useState(false)
  const [holdBook, setHoldBook] = useState<LibraryBook | null>(null)
  const [holdForm] = Form.useForm()
  const [holdSearch, setHoldSearch] = useState('')

  // ── Queries ────────────────────────────────────────────────────────────────

  const catalogueParams = new URLSearchParams()
  if (debouncedSearch) catalogueParams.append('search', debouncedSearch)
  if (categoryFilter) catalogueParams.append('category', categoryFilter)
  if (availableOnly) catalogueParams.append('available', 'true')

  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ['library-books', debouncedSearch, categoryFilter, availableOnly],
    queryFn: async () => {
      const { data } = await api.get<{ data: LibraryBook[] }>(`/library/books?${catalogueParams}`)
      return data.data
    },
    enabled: activeTab === 'catalogue',
  })

  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ['library-loans', overdueOnly],
    queryFn: async () => {
      const { data } = await api.get<{ data: ActiveLoan[] }>(`/library/loans${overdueOnly ? '?overdue=true' : ''}`)
      return data.data
    },
    enabled: activeTab === 'loans',
  })

  const { data: holds = [], isLoading: holdsLoading } = useQuery({
    queryKey: ['library-holds'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Hold[] }>('/library/holds')
      return data.data
    },
    enabled: activeTab === 'holds',
  })

  const { data: fines = [], isLoading: finesLoading } = useQuery({
    queryKey: ['library-fines'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FineEntry[] }>('/library/fines')
      return data.data
    },
    enabled: activeTab === 'fines',
  })

  const { data: borrowStudents = [] } = useStudentSearch(borrowSearch)
  const { data: holdStudents = [] } = useStudentSearch(holdSearch)

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addBookMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post('/library/books', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-books'] })
      message.success(t('library.bookAdded'))
      setBookModalOpen(false)
      bookForm.resetFields()
    },
    onError: () => message.error(t('common.error')),
  })

  const updateBookMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      api.put(`/library/books/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-books'] })
      message.success(t('common.success'))
      setBookModalOpen(false)
      setEditingBook(null)
      bookForm.resetFields()
    },
    onError: () => message.error(t('common.error')),
  })

  const deleteBookMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/library/books/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-books'] })
      message.success(t('library.bookDeleted'))
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const borrowMutation = useMutation({
    mutationFn: ({ bookId, values }: { bookId: string; values: Record<string, unknown> }) =>
      api.post(`/library/books/${bookId}/borrow`, values),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['library-books'] })
      queryClient.invalidateQueries({ queryKey: ['library-loans'] })
      const dueDate = dayjs((res.data as { data: { dueDate: string } }).data.dueDate).format('DD MMM YYYY')
      message.success(t('library.borrowedSuccess', { date: dueDate }))
      setBorrowModalOpen(false)
      borrowForm.resetFields()
      setBorrowSearch('')
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const returnMutation = useMutation({
    mutationFn: (loanId: string) => api.post(`/library/loans/${loanId}/return`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-loans'] })
      queryClient.invalidateQueries({ queryKey: ['library-books'] })
      queryClient.invalidateQueries({ queryKey: ['library-holds'] })
      queryClient.invalidateQueries({ queryKey: ['library-fines'] })
      message.success(t('library.returned'))
    },
    onError: () => message.error(t('common.error')),
  })

  const holdMutation = useMutation({
    mutationFn: ({ bookId, values }: { bookId: string; values: Record<string, unknown> }) =>
      api.post(`/library/books/${bookId}/hold`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-holds'] })
      message.success(t('library.holdPlaced'))
      setHoldModalOpen(false)
      holdForm.resetFields()
      setHoldSearch('')
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const updateHoldMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/library/holds/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-holds'] })
      message.success(t('common.success'))
    },
    onError: () => message.error(t('common.error')),
  })

  const payFineMutation = useMutation({
    mutationFn: (loanId: string) => api.post(`/library/fines/${loanId}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-fines'] })
      message.success(t('library.finePaid'))
    },
    onError: () => message.error(t('common.error')),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openAddBook = () => {
    setEditingBook(null)
    bookForm.resetFields()
    setBookModalOpen(true)
  }

  const openEditBook = (book: LibraryBook) => {
    setEditingBook(book)
    bookForm.setFieldsValue({
      isbn: book.isbn ?? '',
      title: book.title,
      author: book.author,
      category: book.category,
      totalCopies: book.totalCopies,
      kohaId: book.kohaId ?? '',
    })
    setBookModalOpen(true)
  }

  const handleBookSubmit = async () => {
    const values = await bookForm.validateFields()
    if (editingBook) {
      updateBookMutation.mutate({ id: editingBook.id, values })
    } else {
      addBookMutation.mutate(values)
    }
  }

  const openBorrowModal = (book: LibraryBook) => {
    setBorrowBook(book)
    borrowForm.setFieldsValue({ dueDate: dayjs().add(14, 'day') })
    setBorrowSearch('')
    setBorrowModalOpen(true)
  }

  const openHoldModal = (book: LibraryBook) => {
    setHoldBook(book)
    setHoldSearch('')
    setHoldModalOpen(true)
  }

  const handleBorrow = async () => {
    const values = await borrowForm.validateFields()
    borrowMutation.mutate({
      bookId: borrowBook!.id,
      values: { ...values, dueDate: values.dueDate.toISOString() },
    })
  }

  const handleHold = async () => {
    const values = await holdForm.validateFields()
    holdMutation.mutate({ bookId: holdBook!.id, values })
  }

  // ── Catalogue columns ─────────────────────────────────────────────────────

  const catalogueColumns: ColumnsType<LibraryBook> = [
    { title: t('library.bookTitle'), dataIndex: 'title', ellipsis: true },
    { title: t('library.author'), dataIndex: 'author', ellipsis: true },
    { title: t('library.category'), dataIndex: 'category', width: 120, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('library.totalCopies'), dataIndex: 'totalCopies', width: 80, align: 'center' },
    {
      title: t('library.availableCopies'),
      dataIndex: 'availableCopies',
      width: 90,
      align: 'center',
      render: (v: number) => (
        <Badge
          count={v}
          showZero
          style={{ backgroundColor: v > 0 ? '#52c41a' : '#ff4d4f' }}
        />
      ),
    },
    {
      title: t('common.actions'),
      width: 200,
      render: (_: unknown, record: LibraryBook) => (
        <Space size={4} wrap>
          {record.availableCopies > 0 ? (
            <Button size="small" type="primary" icon={<BookOpen size={12} />} onClick={() => openBorrowModal(record)}>
              {t('library.borrow')}
            </Button>
          ) : (
            <Button size="small" icon={<BookMarked size={12} />} onClick={() => openHoldModal(record)}>
              {t('library.hold')}
            </Button>
          )}
          {isAdmin && (
            <>
              <Button size="small" icon={<Edit2 size={12} />} onClick={() => openEditBook(record)} />
              <Tooltip title={record.availableCopies < record.totalCopies ? t('library.hasActiveLoans') : undefined}>
                <Popconfirm
                  title={t('library.deleteConfirm')}
                  onConfirm={() => deleteBookMutation.mutate(record.id)}
                  okText={t('common.delete')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true }}
                  disabled={record.availableCopies < record.totalCopies}
                >
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={12} />}
                    disabled={record.availableCopies < record.totalCopies}
                  />
                </Popconfirm>
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ]

  // ── Active loans columns ──────────────────────────────────────────────────

  const loansColumns: ColumnsType<ActiveLoan> = [
    { title: t('library.title'), dataIndex: 'bookTitle', ellipsis: true },
    { title: t('sen.studentName'), dataIndex: 'studentName', ellipsis: true },
    { title: t('exams.class'), dataIndex: 'className', width: 72, render: (v: string | null) => v ?? '—' },
    { title: t('library.borrowedAt'), dataIndex: 'borrowedAt', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: t('library.dueDate'),
      dataIndex: 'dueDate',
      width: 110,
      render: (v: string, r: ActiveLoan) => (
        <Text type={r.isOverdue ? 'danger' : undefined}>{dayjs(v).format('DD/MM/YYYY')}</Text>
      ),
    },
    {
      title: t('library.overdue'),
      dataIndex: 'isOverdue',
      width: 90,
      render: (_v: boolean, r: ActiveLoan) =>
        r.isOverdue ? <Tag color="red">{r.overdueDays}d</Tag> : <Tag color="green">—</Tag>,
    },
    {
      title: t('library.fine'),
      dataIndex: 'fineAmount',
      width: 90,
      render: (v: number) => v > 0 ? <Text type="danger">BND {v.toFixed(2)}</Text> : '—',
    },
    {
      title: '',
      width: 110,
      render: (_: unknown, record: ActiveLoan) => (
        <Popconfirm
          title={record.fineAmount > 0
            ? t('library.returnConfirmFine', { fine: `BND ${record.fineAmount.toFixed(2)}` })
            : t('library.returnConfirm')}
          onConfirm={() => returnMutation.mutate(record.id)}
          okText={t('library.returnBook')}
          cancelText={t('common.cancel')}
        >
          <Button size="small" icon={<RotateCcw size={12} />} loading={returnMutation.isPending}>
            {t('library.returnBook')}
          </Button>
        </Popconfirm>
      ),
    },
  ]

  // ── Holds columns ─────────────────────────────────────────────────────────

  const holdsColumns: ColumnsType<Hold> = [
    { title: t('library.title'), dataIndex: 'bookTitle', ellipsis: true },
    { title: t('sen.studentName'), dataIndex: 'studentName', ellipsis: true },
    { title: t('library.requestedAt'), dataIndex: 'requestedAt', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color={HOLD_STATUS_COLORS[v] ?? 'default'}>{t(`library.hold_${v}`, { defaultValue: v })}</Tag>,
    },
    {
      title: t('common.actions'),
      width: 160,
      render: (_: unknown, record: Hold) => (
        <Space size={4}>
          {isAdmin && record.status === 'waiting' && (
            <Button size="small" type="primary" onClick={() => updateHoldMutation.mutate({ id: record.id, status: 'ready' })}>
              {t('library.markReady')}
            </Button>
          )}
          {record.status !== 'cancelled' && (
            <Popconfirm
              title={t('library.cancelHoldConfirm')}
              onConfirm={() => updateHoldMutation.mutate({ id: record.id, status: 'cancelled' })}
              okText={t('library.cancelHold')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger>{t('library.cancelHold')}</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // ── Fines columns ─────────────────────────────────────────────────────────

  const finesColumns: ColumnsType<FineEntry> = [
    { title: t('sen.studentName'), dataIndex: 'studentName', ellipsis: true },
    { title: t('library.bookTitle'), dataIndex: 'bookTitle', ellipsis: true },
    { title: t('library.dueDate'), dataIndex: 'dueDate', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: t('library.returnedAt'),
      dataIndex: 'returnedAt',
      width: 110,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : <Tag color="orange">{t('library.stillOut')}</Tag>,
    },
    { title: t('library.overdueDays'), dataIndex: 'overdueDays', width: 100, align: 'center' },
    {
      title: t('library.fine'),
      dataIndex: 'fineAmount',
      width: 110,
      render: (v: number) => <Text type="danger">BND {v.toFixed(2)}</Text>,
    },
    {
      title: t('common.status'),
      dataIndex: 'paid',
      width: 110,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? t('library.paid') : t('library.outstanding')}</Tag>,
    },
    {
      title: '',
      width: 100,
      render: (_: unknown, record: FineEntry) =>
        !record.paid && canPayFine ? (
          <Popconfirm
            title={t('library.payFineConfirm', { fine: `BND ${record.fineAmount.toFixed(2)}` })}
            onConfirm={() => payFineMutation.mutate(record.id)}
            okText={t('library.payFine')}
            cancelText={t('common.cancel')}
          >
            <Button size="small" type="primary">{t('library.payFine')}</Button>
          </Popconfirm>
        ) : null,
    },
  ]

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={22} color="#1677ff" />
          <Title level={4} style={{ margin: 0 }}>{t('library.title')}</Title>
          <SyncBadge source="KOHA" relativeTime="5 min ago" />
        </div>
        {isAdmin && (
          <Button type="primary" icon={<Plus size={14} />} onClick={openAddBook}>
            {t('library.addBook')}
          </Button>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'catalogue',
            label: t('library.catalogue'),
            children: (
              <div>
                <Space style={{ marginBottom: 14 }} wrap>
                  <Input.Search
                    placeholder={t('library.searchPlaceholder')}
                    value={search}
                    onChange={e => handleSearchChange(e.target.value)}
                    style={{ width: 240 }}
                    allowClear
                  />
                  <Select
                    allowClear
                    placeholder={t('library.category')}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    style={{ width: 150 }}
                  >
                    {BOOK_CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                  </Select>
                  <Space>
                    <Switch
                      size="small"
                      checked={availableOnly}
                      onChange={setAvailableOnly}
                    />
                    <Text style={{ fontSize: 13 }}>{t('library.availableOnly')}</Text>
                  </Space>
                </Space>
                <Table<LibraryBook>
                  dataSource={books}
                  columns={catalogueColumns}
                  rowKey="id"
                  loading={booksLoading}
                  size="middle"
                  pagination={{ pageSize: 15 }}
                />
              </div>
            ),
          },
          {
            key: 'loans',
            label: (
              <span>
                {t('library.activeLoans')}
                {loans.filter(l => l.isOverdue).length > 0 && (
                  <Badge
                    count={loans.filter(l => l.isOverdue).length}
                    style={{ marginLeft: 6, backgroundColor: '#ff4d4f' }}
                    size="small"
                  />
                )}
              </span>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 14 }}>
                  <Switch size="small" checked={overdueOnly} onChange={setOverdueOnly} />
                  <Text style={{ fontSize: 13 }}>{t('library.overdueOnly')}</Text>
                </Space>
                <Table<ActiveLoan>
                  dataSource={loans}
                  columns={loansColumns}
                  rowKey="id"
                  loading={loansLoading}
                  size="middle"
                  pagination={{ pageSize: 15 }}
                />
              </div>
            ),
          },
          {
            key: 'holds',
            label: t('library.holds'),
            children: (
              <Table<Hold>
                dataSource={holds}
                columns={holdsColumns}
                rowKey="id"
                loading={holdsLoading}
                size="middle"
                pagination={{ pageSize: 15 }}
              />
            ),
          },
          {
            key: 'fines',
            label: (
              <span>
                {t('library.fines')}
                {fines.filter(f => !f.paid).length > 0 && (
                  <Badge
                    count={fines.filter(f => !f.paid).length}
                    style={{ marginLeft: 6, backgroundColor: '#ff4d4f' }}
                    size="small"
                  />
                )}
              </span>
            ),
            children: (
              <Table<FineEntry>
                dataSource={fines}
                columns={finesColumns}
                rowKey="id"
                loading={finesLoading}
                size="middle"
                pagination={{ pageSize: 15 }}
              />
            ),
          },
        ]}
      />

      {/* ── Add / Edit Book Modal ── */}
      <Modal
        title={editingBook ? t('library.editBook') : t('library.addBook')}
        open={bookModalOpen}
        onOk={handleBookSubmit}
        onCancel={() => { setBookModalOpen(false); setEditingBook(null); bookForm.resetFields() }}
        confirmLoading={addBookMutation.isPending || updateBookMutation.isPending}
        okText={editingBook ? t('common.save') : t('common.submit')}
        destroyOnClose
      >
        <Form form={bookForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="isbn" label={t('library.isbn')}>
            <Input placeholder="978-..." />
          </Form.Item>
          <Form.Item name="title" label={t('library.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="author" label={t('library.author')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label={t('library.category')} rules={[{ required: true }]}>
                <Select>
                  {BOOK_CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="totalCopies" label={t('library.totalCopies')} rules={[{ required: true }]} initialValue={1}>
                <InputNumber min={1} max={999} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="kohaId" label={t('library.kohaId')}>
            <Input placeholder="KOHA-xxxx" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Borrow Modal ── */}
      <Modal
        title={borrowBook ? `${t('library.borrowBook')}: ${borrowBook.title}` : t('library.borrowBook')}
        open={borrowModalOpen}
        onOk={handleBorrow}
        onCancel={() => { setBorrowModalOpen(false); borrowForm.resetFields(); setBorrowSearch('') }}
        confirmLoading={borrowMutation.isPending}
        okText={t('library.borrow')}
        destroyOnClose
      >
        <Form form={borrowForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="studentId" label={t('sen.selectStudent')} rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={v => setBorrowSearch(v)}
              placeholder={t('sen.searchStudent')}
              notFoundContent={borrowSearch.length < 2 ? t('exams.typeToSearch') : t('common.noData')}
            >
              {borrowStudents.map(s => (
                <Option key={s.id} value={s.id}>
                  {s.user.displayName} ({s.studentId}){s.className ? ` · ${s.className}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="dueDate" label={t('library.dueDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} disabledDate={d => d.isBefore(dayjs())} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Hold Modal ── */}
      <Modal
        title={holdBook ? `${t('library.holdBook')}: ${holdBook.title}` : t('library.holdBook')}
        open={holdModalOpen}
        onOk={handleHold}
        onCancel={() => { setHoldModalOpen(false); holdForm.resetFields(); setHoldSearch('') }}
        confirmLoading={holdMutation.isPending}
        okText={t('library.placeHold')}
        destroyOnClose
      >
        <Form form={holdForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="studentId" label={t('sen.selectStudent')} rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={v => setHoldSearch(v)}
              placeholder={t('sen.searchStudent')}
              notFoundContent={holdSearch.length < 2 ? t('exams.typeToSearch') : t('common.noData')}
            >
              {holdStudents.map(s => (
                <Option key={s.id} value={s.id}>
                  {s.user.displayName} ({s.studentId}){s.className ? ` · ${s.className}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
