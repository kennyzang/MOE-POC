import { useState } from 'react'
import { Tooltip, Popconfirm, message, Spin, Modal, Image } from 'antd'
import { FileText, FileImage, FileSpreadsheet, Download, Trash2, File, Eye } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import api from '../lib/api'
import { downloadFile } from '../lib/download'
import type { FileAttachment } from '../types'
import { useAuthStore } from '../stores/authStore'

interface FileListProps {
  entityType: string
  entityId: string
  canDelete?: boolean
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <FileImage size={14} />
  if (mimeType.includes('spreadsheet') || mimeType === 'text/csv') return <FileSpreadsheet size={14} />
  if (mimeType === 'application/pdf' || mimeType.includes('word')) return <FileText size={14} />
  return <File size={14} />
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf'
}

interface PreviewState {
  url: string
  mimeType: string
  name: string
}

export default function FileList({ entityType, entityId, canDelete }: FileListProps) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['files', entityType, entityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: FileAttachment[] }>(`/files?entityType=${entityType}&entityId=${entityId}`)
      return data.data
    },
    enabled: !!entityId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', entityType, entityId] })
      message.success('File deleted')
    },
    onError: () => message.error('Delete failed'),
  })

  const handleDownload = async (file: FileAttachment) => {
    try {
      await downloadFile(file.downloadUrl, file.originalName)
    } catch {
      message.error('Download failed')
    }
  }

  const handlePreview = async (file: FileAttachment) => {
    setPreviewLoading(file.id)
    try {
      const viewUrl = file.downloadUrl.replace('/download', '/view').replace(/^\/api\/v1/, '')
      const response = await api.get(viewUrl, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: file.mimeType })
      const objectUrl = URL.createObjectURL(blob)

      if (file.mimeType === 'application/pdf') {
        window.open(objectUrl, '_blank')
        // Delay revoke so the tab has time to load the blob
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30000)
      } else {
        setPreview({ url: objectUrl, mimeType: file.mimeType, name: file.originalName })
      }
    } catch {
      message.error('Preview failed')
    } finally {
      setPreviewLoading(null)
    }
  }

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  if (isLoading) return <Spin size="small" />
  if (!files.length) return <span style={{ color: '#bfbfbf', fontSize: 12 }}>No files attached</span>

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {files.map(f => (
          <div
            key={f.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 8px', borderRadius: 4, background: '#fafafa',
              border: '1px solid #f0f0f0', fontSize: 13,
            }}
          >
            <span style={{ color: '#1677ff' }}>{fileIcon(f.mimeType)}</span>
            <Tooltip title={f.description || f.originalName}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                {f.originalName}
              </span>
            </Tooltip>
            <span style={{ color: '#8c8c8c', fontSize: 11, flexShrink: 0 }}>{formatSize(f.size)}</span>
            <span style={{ color: '#8c8c8c', fontSize: 11, flexShrink: 0 }}>{dayjs(f.createdAt).format('DD/MM/YY')}</span>
            {isPreviewable(f.mimeType) && (
              <Tooltip title={f.mimeType === 'application/pdf' ? 'Open PDF in new tab' : 'Preview image'}>
                <Eye
                  size={13}
                  style={{
                    cursor: previewLoading === f.id ? 'wait' : 'pointer',
                    color: previewLoading === f.id ? '#8c8c8c' : '#52c41a',
                    flexShrink: 0,
                  }}
                  onClick={() => previewLoading !== f.id && handlePreview(f)}
                />
              </Tooltip>
            )}
            <Tooltip title="Download">
              <Download
                size={13}
                style={{ cursor: 'pointer', color: '#1677ff', flexShrink: 0 }}
                onClick={() => handleDownload(f)}
              />
            </Tooltip>
            {(canDelete || user?.role === 'admin' || user?.role === 'manager') && (
              <Popconfirm title="Delete this file?" onConfirm={() => deleteMutation.mutate(f.id)} okText="Yes" cancelText="No">
                <Trash2 size={13} style={{ cursor: 'pointer', color: '#ff4d4f', flexShrink: 0 }} />
              </Popconfirm>
            )}
          </div>
        ))}
      </div>

      {/* Image preview modal */}
      <Modal
        open={!!preview}
        onCancel={closePreview}
        footer={null}
        title={preview?.name}
        width="auto"
        style={{ maxWidth: '90vw' }}
        styles={{ body: { padding: 8, textAlign: 'center' } }}
      >
        {preview && (
          <Image
            src={preview.url}
            alt={preview.name}
            style={{ maxWidth: '80vw', maxHeight: '75vh', objectFit: 'contain' }}
            preview={false}
          />
        )}
      </Modal>
    </>
  )
}
