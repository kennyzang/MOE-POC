import api from './api'

/**
 * Download a file from an authenticated API endpoint.
 * Uses fetch with the Authorization header, then triggers a browser download via a blob URL.
 */
export async function downloadFile(apiPath: string, filename?: string): Promise<void> {
  const response = await api.get(apiPath, { responseType: 'blob' })
  const blob = new Blob([response.data], { type: response.headers['content-type'] ?? 'application/octet-stream' })

  // Derive filename from Content-Disposition if not provided
  const disposition = response.headers['content-disposition'] ?? ''
  const match = disposition.match(/filename="?([^";\n]+)"?/)
  const name = filename ?? (match ? decodeURIComponent(match[1]) : 'download')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
