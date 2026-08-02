import { useEffect, useRef, useState } from 'react'

import type { ConversationState } from '../../app/app-state'
import './ChatComposer.css'

export type ChatComposerProps = {
  conversation: ConversationState
  /** False while a proposal is pending: one thing at a time. */
  canSend: boolean
  /** Why sending is unavailable, said plainly. */
  disabledReason: string | null
  onSend(message: string): void
  /** Optional owner-controlled draft for shells that move this composer between layouts. */
  draft?: string
  onDraftChange?(draft: string): void
}

const STATUS_ID = 'chat-status'

/**
 * The one place the user talks to the assistant.
 *
 * Every state below is one a person can be left sitting in, so each says what
 * happened and what to do next. Nothing here names a model, a provider, or a
 * protocol: the user is editing a video, not operating an AI.
 */
export function ChatComposer({ conversation, canSend, disabledReason, onSend, draft, onDraftChange }: ChatComposerProps) {
  const [internalMessage, setInternalMessage] = useState('')
  const message = draft ?? internalMessage
  const setMessage = (next: string) => {
    if (onDraftChange) onDraftChange(next)
    else setInternalMessage(next)
  }
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isSending = conversation.status === 'sending'

  useEffect(() => {
    // After a question, put the cursor back where the answer goes.
    if (conversation.status === 'clarification') inputRef.current?.focus()
  }, [conversation.status, conversation.question])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || isSending || !canSend) return
    onSend(trimmed)
    setMessage('')
  }

  return (
    <form className="chat-composer" onSubmit={submit} aria-label="Ask for an edit">
      <label htmlFor="editor-chat">Ask Sanverse</label>

      {conversation.status === 'clarification' && conversation.question ? (
        <p className="chat-composer__question" role="status" aria-label="Question">
          {conversation.question}
        </p>
      ) : null}

      {conversation.status === 'unsupported' && conversation.notice ? (
        <p className="chat-composer__notice" role="status" aria-label="Assistant notice">
          {conversation.notice}
        </p>
      ) : null}

      {conversation.status === 'error' && conversation.notice ? (
        <p className="chat-composer__error" role="alert">
          {conversation.notice}
        </p>
      ) : null}

      <textarea
        ref={inputRef}
        id="editor-chat"
        aria-label="Ask for an edit"
        rows={3}
        value={message}
        disabled={isSending || !canSend}
        aria-describedby={STATUS_ID}
        placeholder={
          canSend
            ? 'Describe what you want to change…'
            : 'Finish the pending proposal first'
        }
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends, because this is a chat box, not a document.
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />

      <button type="submit" disabled={isSending || !canSend || message.trim().length === 0}>
        {isSending ? 'Working…' : 'Send'}
      </button>

      <p id={STATUS_ID} className="chat-composer__status" role="status">
        {isSending
          ? 'Working on it. Nothing has changed yet.'
          : disabledReason ?? 'Pause and point first when placement matters.'}
      </p>
    </form>
  )
}
