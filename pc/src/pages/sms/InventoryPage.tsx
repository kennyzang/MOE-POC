import { useState, useRef } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, Select, DatePicker, InputNumber,
  Drawer, Space, Popconfirm, message, Typography, Row, Col, Divider,
  Statistic, List,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, Edit2, Trash2, Wrench, Settings2 } from 'lucide-react'
import dayjs from 'dayjs'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetCategory {
  id: string
  name: string
  description: string | null
  schoolId: string | null
  assetCount: number
}

interface Asset {
  id: string
  assetTag: string
  name: string
  categoryId: string
  categoryName: string
  schoolId: string | null
  location: string | null
  condition: string
  purchaseDate: string | null
  value: number | null
  notes: string | null
  createdAt: string
}

interface MaintenanceLog {
  id: string
  assetId: string
  date: string
  type: string
  cost: number | null
  conductedBy: string | null
  notes: string | null
  createdAt: string
}

interface AssetDetail extends Asset {
  maintenanceLogs: MaintenanceLog[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS = ['Good', 'Fair', 'Poor', 'Condemned']
const MAINTENANCE_TYPES = ['Repair', 'Service', 'Inspection', 'Disposal']

const CONDITION_COLORS: Record<string, string> = {
  Good: 'green',
  Fair: 'orange',
  Poor: 'red',
  Condemned: 'default',
}

const MAINTENANCE_COLORS: Record<string, string> = {
  Repair: 'blue',
  Service: 'cyan',
  Inspection: 'purple',
  Disposal: 'red',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'manager'].includes(user?.role ?? '')

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [conditionFilter, setConditionFilter] = useState<string | undefined>()
  const [locationFilter, setLocationFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(v), 400)
  }

  // Asset modal
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [assetForm] = Form.useForm()

  // Asset drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)

  // Maintenance inline form state
  const [showAddMaint, setShowAddMaint] = useState(false)
  const [maintForm] = Form.useForm()
  const [pendingDisposal, setPendingDisposal] = useState(false)

  // Categories modal
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: async () => {
      const { data } = await api.get<{ data: AssetCategory[] }>('/inventory/categories')
      return data.data
    },
  })

  const assetParams = new URLSearchParams()
  if (categoryFilter) assetParams.append('categoryId', categoryFilter)
  if (conditionFilter) assetParams.append('condition', conditionFilter)
  if (locationFilter) assetParams.append('location', locationFilter)
  if (debouncedSearch) assetParams.append('search', debouncedSearch)

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', categoryFilter, conditionFilter, locationFilter, debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get<{ data: Asset[] }>(`/inventory/assets?${assetParams}`)
      return data.data
    },
  })

  const { data: assetDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['asset-detail', selectedAssetId],
    queryFn: async () => {
      const { data } = await api.get<{ data: AssetDetail }>(`/inventory/assets/${selectedAssetId}`)
      return data.data
    },
    enabled: !!selectedAssetId && drawerOpen,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addCatMutation = useMutation({
    mutationFn: (name: string) => api.post('/inventory/categories', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] })
      message.success(t('inventory.categoryAdded'))
      setNewCatName('')
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const updateCatMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.put(`/inventory/categories/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] })
      message.success(t('common.success'))
      setEditingCatId(null)
    },
    onError: () => message.error(t('common.error')),
  })

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] })
      message.success(t('inventory.categoryDeleted'))
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const addAssetMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post('/inventory/assets', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      message.success(t('inventory.assetRegistered'))
      setAssetModalOpen(false)
      assetForm.resetFields()
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const updateAssetMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      api.put(`/inventory/assets/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset-detail', selectedAssetId] })
      message.success(t('common.success'))
      setAssetModalOpen(false)
      setEditingAsset(null)
      assetForm.resetFields()
    },
    onError: () => message.error(t('common.error')),
  })

  const deleteAssetMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      message.success(t('inventory.assetDeleted'))
      if (drawerOpen) { setDrawerOpen(false); setSelectedAssetId(null) }
    },
    onError: () => message.error(t('common.error')),
  })

  const addMaintMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      api.post(`/inventory/assets/${selectedAssetId}/maintenance`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-detail', selectedAssetId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      message.success(t('inventory.maintAdded'))
      setShowAddMaint(false)
      maintForm.resetFields()
      setPendingDisposal(false)
    },
    onError: () => message.error(t('common.error')),
  })

  const deleteMaintMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/maintenance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-detail', selectedAssetId] })
      message.success(t('inventory.maintDeleted'))
    },
    onError: () => message.error(t('common.error')),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openAddAsset = () => {
    setEditingAsset(null)
    assetForm.resetFields()
    setAssetModalOpen(true)
  }

  const openEditAsset = (asset: Asset) => {
    setEditingAsset(asset)
    assetForm.setFieldsValue({
      assetTag: asset.assetTag,
      name: asset.name,
      categoryId: asset.categoryId,
      location: asset.location ?? '',
      condition: asset.condition,
      purchaseDate: asset.purchaseDate ? dayjs(asset.purchaseDate) : undefined,
      value: asset.value ?? undefined,
      notes: asset.notes ?? '',
    })
    setAssetModalOpen(true)
  }

  const handleAssetSubmit = async () => {
    const values = await assetForm.validateFields()
    const payload = {
      ...values,
      purchaseDate: values.purchaseDate ? values.purchaseDate.toISOString() : undefined,
    }
    if (editingAsset) {
      updateAssetMutation.mutate({ id: editingAsset.id, values: payload })
    } else {
      addAssetMutation.mutate(payload)
    }
  }

  const openDrawer = (asset: Asset) => {
    setSelectedAssetId(asset.id)
    setShowAddMaint(false)
    maintForm.resetFields()
    setPendingDisposal(false)
    setDrawerOpen(true)
  }

  const handleAddMaint = async () => {
    const values = await maintForm.validateFields()
    const payload = { ...values, date: values.date.toISOString() }

    if (values.type === 'Disposal') {
      // Show confirm already handled via pendingDisposal state — just submit
      addMaintMutation.mutate(payload)
      setPendingDisposal(false)
    } else {
      addMaintMutation.mutate(payload)
    }
  }

  const handleMaintTypeChange = (type: string) => {
    setPendingDisposal(type === 'Disposal')
  }

  // ── Asset list columns ─────────────────────────────────────────────────────

  const columns: ColumnsType<Asset> = [
    {
      title: t('inventory.assetTag'),
      dataIndex: 'assetTag',
      width: 130,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: t('inventory.name'), dataIndex: 'name', ellipsis: true },
    { title: t('inventory.category'), dataIndex: 'categoryName', width: 130, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: t('inventory.location'),
      dataIndex: 'location',
      width: 120,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: t('inventory.condition'),
      dataIndex: 'condition',
      width: 110,
      render: (v: string) => <Tag color={CONDITION_COLORS[v] ?? 'default'}>{t(`inventory.cond_${v.toLowerCase()}`, { defaultValue: v })}</Tag>,
    },
    {
      title: t('inventory.purchaseDate'),
      dataIndex: 'purchaseDate',
      width: 120,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: t('inventory.value'),
      dataIndex: 'value',
      width: 110,
      render: (v: number | null) => v != null ? `BND ${v.toFixed(2)}` : '—',
    },
    {
      title: t('common.actions'),
      width: 130,
      render: (_: unknown, record: Asset) => (
        <Space size={4}>
          <Button size="small" icon={<Wrench size={12} />} onClick={() => openDrawer(record)}>
            {t('inventory.view')}
          </Button>
          {isAdmin && (
            <>
              <Button size="small" icon={<Edit2 size={12} />} onClick={e => { e.stopPropagation(); openEditAsset(record) }} />
              <Popconfirm
                title={t('inventory.deleteAssetConfirm')}
                onConfirm={() => deleteAssetMutation.mutate(record.id)}
                okText={t('common.delete')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<Trash2 size={12} />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  // ── Maintenance log columns ────────────────────────────────────────────────

  const maintColumns: ColumnsType<MaintenanceLog> = [
    { title: t('common.date'), dataIndex: 'date', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: t('inventory.maintType'),
      dataIndex: 'type',
      width: 110,
      render: (v: string) => <Tag color={MAINTENANCE_COLORS[v] ?? 'default'}>{t(`inventory.maint_${v.toLowerCase()}`, { defaultValue: v })}</Tag>,
    },
    {
      title: t('inventory.cost'),
      dataIndex: 'cost',
      width: 100,
      render: (v: number | null) => v != null ? `BND ${v.toFixed(2)}` : '—',
    },
    { title: t('inventory.conductedBy'), dataIndex: 'conductedBy', render: (v: string | null) => v ?? '—' },
    { title: t('common.description'), dataIndex: 'notes', ellipsis: true, render: (v: string | null) => v ?? '—' },
    ...(isAdmin ? [{
      title: '',
      width: 48,
      render: (_: unknown, record: MaintenanceLog) => (
        <Popconfirm
          title={t('inventory.deleteMaintConfirm')}
          onConfirm={() => deleteMaintMutation.mutate(record.id)}
          okText={t('common.delete')}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true }}
        >
          <Button size="small" danger icon={<Trash2 size={12} />} />
        </Popconfirm>
      ),
    }] as ColumnsType<MaintenanceLog> : []),
  ]

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Package size={22} color="#1677ff" />
          <Title level={4} style={{ margin: 0 }}>{t('inventory.title')}</Title>
        </div>
        {isAdmin && (
          <Space>
            <Button icon={<Settings2 size={14} />} onClick={() => setCatModalOpen(true)}>
              {t('inventory.manageCategories')}
            </Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={openAddAsset}>
              {t('inventory.registerAsset')}
            </Button>
          </Space>
        )}
      </div>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder={t('inventory.searchPlaceholder')}
          value={search}
          onChange={e => handleSearch(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Select allowClear placeholder={t('inventory.category')} value={categoryFilter} onChange={setCategoryFilter} style={{ width: 160 }}>
          {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
        </Select>
        <Select allowClear placeholder={t('inventory.condition')} value={conditionFilter} onChange={setConditionFilter} style={{ width: 130 }}>
          {CONDITIONS.map(c => (
            <Option key={c} value={c}>
              <Tag color={CONDITION_COLORS[c]} style={{ margin: 0 }}>{t(`inventory.cond_${c.toLowerCase()}`, { defaultValue: c })}</Tag>
            </Option>
          ))}
        </Select>
        <Input
          placeholder={t('inventory.locationSearch')}
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          style={{ width: 160 }}
          allowClear
        />
      </Space>

      <Table<Asset>
        dataSource={assets}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={{ pageSize: 15 }}
        onRow={record => ({ onClick: () => openDrawer(record), style: { cursor: 'pointer' } })}
      />

      {/* ── Register / Edit Asset Modal ── */}
      <Modal
        title={editingAsset ? t('inventory.editAsset') : t('inventory.registerAsset')}
        open={assetModalOpen}
        onOk={handleAssetSubmit}
        onCancel={() => { setAssetModalOpen(false); setEditingAsset(null); assetForm.resetFields() }}
        confirmLoading={addAssetMutation.isPending || updateAssetMutation.isPending}
        okText={editingAsset ? t('common.save') : t('common.submit')}
        width={600}
        destroyOnHidden
      >
        <Form form={assetForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assetTag" label={t('inventory.assetTag')}>
                <Input placeholder={t('inventory.assetTagPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label={t('inventory.name')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="categoryId" label={t('inventory.category')} rules={[{ required: true }]}>
                <Select>
                  {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="condition" label={t('inventory.condition')} rules={[{ required: true }]} initialValue="Good">
                <Select>
                  {CONDITIONS.map(c => (
                    <Option key={c} value={c}>
                      {t(`inventory.cond_${c.toLowerCase()}`, { defaultValue: c })}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="location" label={t('inventory.location')}>
                <Input placeholder="e.g. Block A, Room 12" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchaseDate" label={t('inventory.purchaseDate')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="value" label={t('inventory.value')}>
                <InputNumber min={0} precision={2} addonBefore="BND" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label={t('common.description')}>
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Asset Detail Drawer ── */}
      <Drawer
        title={
          assetDetail ? (
            <Space>
              <Package size={16} color="#1677ff" />
              <span>{assetDetail.name}</span>
              <Tag>{assetDetail.assetTag}</Tag>
              <Tag color={CONDITION_COLORS[assetDetail.condition] ?? 'default'}>
                {t(`inventory.cond_${assetDetail.condition.toLowerCase()}`, { defaultValue: assetDetail.condition })}
              </Tag>
            </Space>
          ) : t('inventory.assetDetail')
        }
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedAssetId(null); setShowAddMaint(false) }}
        width={780}
        destroyOnHidden
      >
        {!assetDetail || detailLoading ? null : (
          <div>
            {/* Asset info summary */}
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={6}><Statistic title={t('inventory.category')} value={assetDetail.categoryName} /></Col>
              <Col span={6}><Statistic title={t('inventory.location')} value={assetDetail.location ?? '—'} /></Col>
              <Col span={6}>
                <Statistic
                  title={t('inventory.value')}
                  value={assetDetail.value != null ? `BND ${assetDetail.value.toFixed(2)}` : '—'}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t('inventory.purchaseDate')}
                  value={assetDetail.purchaseDate ? dayjs(assetDetail.purchaseDate).format('DD/MM/YYYY') : '—'}
                />
              </Col>
            </Row>

            {/* Condition + quick edit */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Text strong>{t('inventory.condition')}:</Text>
              <Tag color={CONDITION_COLORS[assetDetail.condition] ?? 'default'} style={{ fontSize: 14, padding: '2px 10px' }}>
                {t(`inventory.cond_${assetDetail.condition.toLowerCase()}`, { defaultValue: assetDetail.condition })}
              </Tag>
              {isAdmin && (
                <Select
                  size="small"
                  value={assetDetail.condition}
                  style={{ width: 130 }}
                  onChange={condition => updateAssetMutation.mutate({ id: assetDetail.id, values: { condition } })}
                  loading={updateAssetMutation.isPending}
                >
                  {CONDITIONS.map(c => (
                    <Option key={c} value={c}>
                      {t(`inventory.cond_${c.toLowerCase()}`, { defaultValue: c })}
                    </Option>
                  ))}
                </Select>
              )}
              {isAdmin && (
                <Button size="small" icon={<Edit2 size={12} />} onClick={() => { setDrawerOpen(false); openEditAsset(assetDetail) }} style={{ marginLeft: 'auto' }}>
                  {t('common.edit')}
                </Button>
              )}
            </div>

            {assetDetail.notes && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>{assetDetail.notes}</Text>
            )}

            <Divider />

            {/* Maintenance Log section */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Space>
                <Wrench size={16} color="#1677ff" />
                <Text strong style={{ fontSize: 14 }}>{t('inventory.maintenanceLog')}</Text>
                <Tag>{assetDetail.maintenanceLogs.length}</Tag>
              </Space>
              {isAdmin && !showAddMaint && (
                <Button size="small" icon={<Plus size={12} />} onClick={() => {
                  setShowAddMaint(true)
                  maintForm.setFieldsValue({ date: dayjs(), conductedBy: user?.displayName ?? '' })
                }}>
                  {t('inventory.addMaintenance')}
                </Button>
              )}
            </div>

            {/* Inline add maintenance form */}
            {showAddMaint && (
              <div style={{ background: '#f8f9fa', border: '1px solid #e8e8e8', borderRadius: 6, padding: 12, marginBottom: 12 }}>
                <Form form={maintForm} layout="vertical" size="small">
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="date" label={t('common.date')} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                        <DatePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="type" label={t('inventory.maintType')} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                        <Select onChange={handleMaintTypeChange}>
                          {MAINTENANCE_TYPES.map(mt => (
                            <Option key={mt} value={mt}>{t(`inventory.maint_${mt.toLowerCase()}`, { defaultValue: mt })}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="cost" label={t('inventory.cost')} style={{ marginBottom: 8 }}>
                        <InputNumber min={0} precision={2} addonBefore="BND" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="conductedBy" label={t('inventory.conductedBy')} style={{ marginBottom: 8 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="notes" label={t('common.description')} style={{ marginBottom: 8 }}>
                    <TextArea rows={2} />
                  </Form.Item>
                  {pendingDisposal && (
                    <div style={{ background: '#fff2e8', border: '1px solid #ffbb96', borderRadius: 4, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#d4380d' }}>
                      {t('inventory.disposalWarning')}
                    </div>
                  )}
                  <Space>
                    {pendingDisposal ? (
                      <Popconfirm
                        title={t('inventory.disposalConfirm')}
                        onConfirm={handleAddMaint}
                        okText={t('inventory.confirmDisposal')}
                        cancelText={t('common.cancel')}
                        okButtonProps={{ danger: true }}
                      >
                        <Button type="primary" size="small" danger loading={addMaintMutation.isPending}>
                          {t('inventory.addMaintenance')}
                        </Button>
                      </Popconfirm>
                    ) : (
                      <Button type="primary" size="small" onClick={handleAddMaint} loading={addMaintMutation.isPending}>
                        {t('inventory.addMaintenance')}
                      </Button>
                    )}
                    <Button size="small" onClick={() => { setShowAddMaint(false); maintForm.resetFields(); setPendingDisposal(false) }}>
                      {t('common.cancel')}
                    </Button>
                  </Space>
                </Form>
              </div>
            )}

            <Table<MaintenanceLog>
              dataSource={assetDetail.maintenanceLogs}
              columns={maintColumns}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: t('inventory.noMaintenance') }}
            />
          </div>
        )}
      </Drawer>

      {/* ── Manage Categories Modal ── */}
      <Modal
        title={t('inventory.manageCategories')}
        open={catModalOpen}
        onCancel={() => { setCatModalOpen(false); setEditingCatId(null) }}
        footer={null}
        width={480}
      >
        <List
          dataSource={categories}
          locale={{ emptyText: t('inventory.noCategories') }}
          renderItem={cat => (
            <List.Item
              actions={[
                <Popconfirm
                  key="del"
                  title={t('inventory.deleteCategoryConfirm')}
                  onConfirm={() => deleteCatMutation.mutate(cat.id)}
                  okText={t('common.delete')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true }}
                  disabled={cat.assetCount > 0}
                >
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={12} />}
                    disabled={cat.assetCount > 0}
                    title={cat.assetCount > 0 ? t('inventory.categoryHasAssets', { count: cat.assetCount }) : undefined}
                  />
                </Popconfirm>,
              ]}
            >
              {editingCatId === cat.id ? (
                <Space>
                  <Input
                    size="small"
                    value={editingCatName}
                    onChange={e => setEditingCatName(e.target.value)}
                    onPressEnter={() => updateCatMutation.mutate({ id: cat.id, name: editingCatName })}
                    style={{ width: 180 }}
                  />
                  <Button size="small" type="primary" onClick={() => updateCatMutation.mutate({ id: cat.id, name: editingCatName })}>
                    {t('common.save')}
                  </Button>
                  <Button size="small" onClick={() => setEditingCatId(null)}>{t('common.cancel')}</Button>
                </Space>
              ) : (
                <Space>
                  <Text>{cat.name}</Text>
                  <Tag>{cat.assetCount}</Tag>
                  <Button
                    size="small"
                    icon={<Edit2 size={12} />}
                    type="text"
                    onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name) }}
                  />
                </Space>
              )}
            </List.Item>
          )}
        />
        <Divider style={{ margin: '12px 0' }} />
        <Space>
          <Input
            placeholder={t('inventory.newCategoryName')}
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onPressEnter={() => newCatName.trim() && addCatMutation.mutate(newCatName.trim())}
            style={{ width: 200 }}
          />
          <Button
            type="primary"
            size="small"
            icon={<Plus size={12} />}
            onClick={() => newCatName.trim() && addCatMutation.mutate(newCatName.trim())}
            loading={addCatMutation.isPending}
          >
            {t('inventory.addCategory')}
          </Button>
        </Space>
      </Modal>
    </div>
  )
}
