'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_MESSAGE_LENGTH, type ChatMessage } from '@/lib/chat';
import { chatModels } from '@/lib/models';
import { formatCost } from '@/lib/tasks';
import { Markdown } from './markdown';
import { Button, cx, Select } from './ui';

const transport = new DefaultChatTransport<ChatMessage>({ api: '/api/chat' });

const SUGGESTIONS = [
  'Explain what an API gateway does in two sentences.',
  'Write a haiku about shipping on a Friday.',
  'Compare REST and WebSockets in a small table.',
  'Give me three names for a coffee shop run by robots.',
];

function textOf(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function reasoningOf(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => part.text)
    .join('\n\n')
    .trim();
}

function modelName(id: string | undefined): string | undefined {
  return chatModels.find((model) => model.id === id)?.name ?? id;
}

export function Chat() {
  const [modelId, setModelId] = useState(chatModels[0].id);
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, stop, error, regenerate, setMessages, clearError } = useChat<ChatMessage>({
    transport,
  });
  const busy = status === 'submitted' || status === 'streaming';
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, status]);

  function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    void sendMessage({ text: value }, { body: { model: modelId } });
    setInput('');
    inputRef.current?.focus();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(input);
    }
  }

  function newChat() {
    if (busy) void stop();
    clearError();
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  }

  const last = messages[messages.length - 1];
  const waiting = status === 'submitted' || (status === 'streaming' && last?.role === 'assistant' && !textOf(last));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <label htmlFor="chat-model" className="sr-only">
            Model
          </label>
          <Select
            id="chat-model"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            choices={chatModels.map((model) => ({ value: model.id, label: model.name }))}
            className="w-56"
          />
          <p className="hidden min-w-0 truncate text-sm text-muted sm:block">
            {chatModels.find((model) => model.id === modelId)?.description}
          </p>
          <Button variant="ghost" onClick={newChat} className="ml-auto h-9 px-3" disabled={messages.length === 0}>
            New chat
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite" aria-busy={busy}>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-start gap-5 py-10 sm:py-16">
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-balance">Chat with models on Wiro AI</h1>
                <p className="max-w-xl text-pretty text-muted">
                  Replies come from the Wiro LLM gateway through the AI SDK and{' '}
                  <code className="font-mono text-[0.9em]">@wiro-ai/wiro-llm</code>. Pick a model above and ask
                  anything.
                </p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) =>
            message.role === 'user' ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl bg-foreground/[0.06] px-4 py-2.5 whitespace-pre-wrap">
                  {textOf(message)}
                </p>
              </div>
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                streaming={status === 'streaming' && message.id === last?.id}
              />
            ),
          )}

          {waiting ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <span className="flex gap-1" aria-hidden="true">
                <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />
                <span className="size-1.5 rounded-full bg-current [animation-delay:150ms] motion-safe:animate-pulse" />
                <span className="size-1.5 rounded-full bg-current [animation-delay:300ms] motion-safe:animate-pulse" />
              </span>
              Thinking
            </p>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3"
            >
              <p className="text-sm text-danger">{error.message || 'The model could not answer.'}</p>
              <Button
                variant="secondary"
                className="h-8 px-3"
                onClick={() => void regenerate({ body: { model: modelId } })}
              >
                Retry
              </Button>
            </div>
          ) : null}

          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border bg-background">
        <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-4 sm:px-6">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Send a message"
            className="field-sizing-content max-h-48 min-h-11 flex-1 resize-none rounded-xl border border-border bg-field px-4 py-2.5 text-base leading-6 shadow-xs outline-none placeholder:text-subtle focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/15 sm:text-sm sm:leading-6"
          />
          {busy ? (
            <Button variant="secondary" onClick={() => void stop()} className="h-11">
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} className="h-11">
              Send
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

function AssistantMessage({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  const text = textOf(message);
  const reasoning = reasoningOf(message);
  const [copied, setCopied] = useState(false);
  const cost = formatCost(message.metadata?.cost);

  if (!text && !reasoning) return null;

  return (
    <div className="flex flex-col gap-2">
      {reasoning ? (
        <details className="group text-sm text-muted">
          <summary className="cursor-pointer select-none hover:text-foreground">Reasoning</summary>
          <p className="mt-2 border-l-2 border-border pl-3 whitespace-pre-wrap">{reasoning}</p>
        </details>
      ) : null}
      {text ? <Markdown>{text}</Markdown> : null}
      {!streaming && text ? (
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>
            {modelName(message.metadata?.model)}
            {cost ? ` · ${cost}` : ''}
          </span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className={cx(
              'rounded px-1 py-0.5 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            )}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
