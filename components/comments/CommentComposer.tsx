'use client'

import { useState } from 'react'
import { MentionsInput, Mention, type SuggestionDataItem } from 'react-mentions'
import { Send, User, Users2 } from 'lucide-react'

export type MentionOption = { id: string; display: string }

const mentionsInputStyle = {
  control: { fontSize: 13, fontWeight: 'normal' },
  '&multiLine': {
    highlighter: { padding: 9, border: '1px solid transparent' },
    input: { padding: 9, minHeight: 40, outline: 'none' },
  },
  suggestions: {
    list: { backgroundColor: 'var(--hp-elevated)', border: '1px solid var(--hp-border)', fontSize: 13, borderRadius: 8, overflow: 'hidden' },
    item: {
      padding: '6px 10px',
      borderBottom: '1px solid var(--hp-border)',
      '&focused': { backgroundColor: 'var(--hp-primary-bg)' },
    },
  },
}

// Ô nhập bình luận dùng react-mentions — gộp gợi ý người + nhóm/phòng ban
// (2 <Mention> cùng trigger "@", phân biệt bằng icon renderSuggestion khác nhau).
export default function CommentComposer({
  people,
  groups,
  placeholder,
  autoFocus,
  onSubmit,
}: {
  people: MentionOption[]
  groups: MentionOption[]
  placeholder?: string
  autoFocus?: boolean
  onSubmit: (text: string, mentionIds: string[]) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [plainValue, setPlainValue] = useState('')
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    const text = plainValue.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      await onSubmit(text, mentionIds)
      setValue(''); setPlainValue(''); setMentionIds([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 rounded-lg" style={{ border: '1px solid var(--hp-border)', background: 'var(--hp-card)' }}>
        <MentionsInput
          value={value}
          onChange={(_e, newValue, newPlainTextValue, mentions) => {
            setValue(newValue)
            setPlainValue(newPlainTextValue)
            setMentionIds(mentions.map((m) => m.id))
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          placeholder={placeholder ?? 'Viết bình luận... gõ @ để nhắc ai đó'}
          autoFocus={autoFocus}
          allowSuggestionsAboveCursor
          style={mentionsInputStyle}
          className="comment-mentions"
        >
          <Mention
            trigger="@"
            data={people}
            markup="@[__display__](__id__)"
            displayTransform={(_id: string, display: string) => `@${display}`}
            appendSpaceOnAdd
            renderSuggestion={(s: SuggestionDataItem) => (
              <div className="flex items-center gap-1.5 px-1 py-0.5 text-xs"><User size={12} /> {s.display}</div>
            )}
          />
          <Mention
            trigger="@"
            data={groups}
            markup="@[__display__](__id__)"
            displayTransform={(_id: string, display: string) => `@${display}`}
            appendSpaceOnAdd
            renderSuggestion={(s: SuggestionDataItem) => (
              <div className="flex items-center gap-1.5 px-1 py-0.5 text-xs"><Users2 size={12} /> {s.display}</div>
            )}
          />
        </MentionsInput>
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy || !plainValue.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-50"
        style={{ background: 'var(--hp-primary)' }}
      >
        <Send size={15} />
      </button>
    </div>
  )
}
