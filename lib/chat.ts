import type { UIMessage } from 'ai';

/** Sent with each assistant message: the model that wrote it and what it cost. */
export type ChatMetadata = { model?: string; cost?: number };

export type ChatMessage = UIMessage<ChatMetadata>;

/** Older messages are dropped from the request once a chat gets longer than this. */
export const MAX_CHAT_MESSAGES = 40;

export const MAX_MESSAGE_LENGTH = 8000;

/** The model the chat starts on. */
export const DEFAULT_CHAT_MODEL = 'openai/gpt-5-4-nano';
