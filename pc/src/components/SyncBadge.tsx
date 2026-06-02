import { Tag, Tooltip } from 'antd'
import { RefreshCw } from 'lucide-react'

interface SyncBadgeProps {
  source: string
  relativeTime?: string
  absoluteTime?: string
  style?: React.CSSProperties
}

/**
 * Provenance badge showing which external system last synced this data.
 * e.g. <SyncBadge source="SSM" relativeTime="2 min ago" />
 */
const SyncBadge = ({ source, relativeTime, absoluteTime, style }: SyncBadgeProps) => {
  const label = relativeTime ? `${source} · ${relativeTime}` : source

  const badge = (
    <Tag
      icon={<RefreshCw size={10} />}
      color="cyan"
      style={{ fontSize: 11, cursor: absoluteTime ? 'help' : 'default', ...style }}
    >
      {label}
    </Tag>
  )

  if (absoluteTime) {
    return <Tooltip title={`Last synced: ${absoluteTime}`}>{badge}</Tooltip>
  }
  return badge
}

export default SyncBadge
