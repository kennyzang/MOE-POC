import { useState } from 'react'
import { Upload, Button, message, Modal, Image } from 'antd'
import type { UploadProps, UploadFile } from 'antd'
import { UploadCloud, Eye } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { FileAttachment } from '../types'

interface FileUploaderProps {
  entityType: string
  entityId: string
  description?: string
  accept?: string
  maxSizeMB?: number
  onUploaded?: (file: FileAttachment) => void
  label?: string
  disabled?: boolean
}

function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export default function FileUploader({
  entityType,
  entityId,
  description,
  accept,
  maxSizeMB = 10,
  onUploaded,
  label,
  disabled,
}: FileUploaderProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [lastUploaded, setLastUploaded] = useState<FileAttachment | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const props: UploadProps = {
    fileList,
    accept: accept ?? '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt',
    maxCount: 1,
    beforeUpload: (file) => {
      const ok = file.size / 1024 / 1024 <= maxSizeMB
      if (!ok) {
        message.error(`File must be smaller than ${maxSizeMB}MB`)
        return Upload.LIST_IGNORE
      }
      return false // prevent auto upload; onChange will handle fileList
    },
    onChange: ({ fileList: newList }) => {
      // keep only files that passed beforeUpload (not LIST_IGNORE'd)
      setFileList(newList.filter(f => f.status !== 'error').slice(-1))
    },
    onRemove: () => setFileList([]),
  }

  const handleUpload = async () => {
    if (!fileList.length) { message.warning('Select a file first'); return }

    const formData = new FormData()
    formData.append('file', fileList[0] as unknown as File)
    formData.append('entityType', entityType)
    formData.append('entityId', entityId)
    if (description) formData.append('description', description)

    setUploading(true)
    try {
      const { data } = await api.post<{ success: boolean; data: FileAttachment }>('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      message.success(`${fileList[0].name} uploaded successfully`)
      setFileList([])
      setLastUploaded(data.data)
      queryClient.invalidateQueries({ queryKey: ['files', entityType, entityId] })
      onUploaded?.(data.data)
    } catch {
      message.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handlePreviewLastUploaded = async () => {
    if (!lastUploaded) return
    try {
      const viewUrl = lastUploaded.downloadUrl.replace('/download', '/view').replace(/^\/api\/v1/, '')
      const response = await api.get(viewUrl, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: lastUploaded.mimeType })
      const url = URL.createObjectURL(blob)
      if (lastUploaded.mimeType === 'application/pdf') {
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 30000)
      } else {
        setPreviewUrl(url)
        setPreviewOpen(true)
      }
    } catch {
      message.error('Preview failed')
    }
  }

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewOpen(false)
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Upload {...props} style={{ flex: 1 }}>
          <Button icon={<UploadCloud size={14} />} disabled={disabled}>
            {label ?? 'Choose File'}
          </Button>
        </Upload>
        {fileList.length > 0 && (
          <Button type="primary" onClick={handleUpload} loading={uploading} size="small">
            Upload
          </Button>
        )}
        {lastUploaded && (lastUploaded.mimeType.startsWith('image/') || lastUploaded.mimeType === 'application/pdf') && (
          <Button
            size="small"
            icon={<Eye size={12} />}
            onClick={handlePreviewLastUploaded}
            style={{ color: '#52c41a', borderColor: '#52c41a' }}
          >
            Preview
          </Button>
        )}
      </div>

      <Modal
        open={previewOpen && !!previewUrl && isImageType(lastUploaded?.mimeType ?? '')}
        onCancel={closePreview}
        footer={null}
        title={lastUploaded?.originalName}
        width="auto"
        style={{ maxWidth: '90vw' }}
        styles={{ body: { padding: 8, textAlign: 'center' } }}
      >
        {previewUrl && (
          <Image
            src={previewUrl}
            alt={lastUploaded?.originalName ?? ''}
            style={{ maxWidth: '80vw', maxHeight: '75vh', objectFit: 'contain' }}
            preview={false}
          />
        )}
      </Modal>
    </>
  )
}
