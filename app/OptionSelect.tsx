import { Box, MenuItem, Select, Typography } from '@mui/material'
import { t, type MessageKey } from './i18n'

/** 操作の帯に置く選択欄（ラベル付き） */
export function OptionSelect<T extends string>(p: { label: string; value: T; disabled: boolean; options: [T, MessageKey | { text: string }][]; onChange: (v: T) => void; note?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {p.label && <Typography sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>{p.label}</Typography>}
      <Select size="small" value={p.value} disabled={p.disabled} onChange={(e) => p.onChange(e.target.value as T)} sx={{ fontSize: 13, '& .MuiSelect-select': { py: 0.5 } }}>
        {p.options.map(([v, k]) => (
          <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>
            {typeof k === 'string' ? t(k) : k.text}
          </MenuItem>
        ))}
      </Select>
      {p.note && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{p.note}</Typography>}
    </Box>
  )
}
