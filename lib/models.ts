/**
 * The models this app offers. The server only runs models listed here, with the
 * choices listed here, so a visitor can't use your key for anything else.
 *
 * To add a model, copy an entry and fill it in from the model's page on
 * https://wiro.ai/models: `id` is the `owner/model` slug from the page URL, and
 * each setting `id` is a parameter name from the page's API tab.
 */

export type Choice = { value: string; label: string };

export type ModelSetting = {
  /** The Wiro parameter name, for example `aspectRatio`. */
  id: string;
  label: string;
  choices: Choice[];
  default: string;
};

export type MediaModel = {
  /** The `owner/model` slug on Wiro AI. */
  id: string;
  name: string;
  description: string;
  settings: ModelSetting[];
  /** Parameters sent with every run of this model. */
  fixed?: Record<string, string>;
  /** Video models: the parameter that takes a start frame URL. */
  imageInput?: string;
};

export type ChatModel = {
  /** The model ID on the Wiro LLM gateway. */
  id: string;
  name: string;
  description: string;
  /** Sent as `reasoning_effort`, to keep answers quick. */
  reasoningEffort?: 'low' | 'medium' | 'high';
};

export type MediaKind = 'image' | 'video';

const RATIO_LABELS: Record<string, string> = {
  '1:1': '1:1 Square',
  '16:9': '16:9 Landscape',
  '9:16': '9:16 Portrait',
  '4:3': '4:3',
  '3:4': '3:4',
  '3:2': '3:2',
  '2:3': '2:3',
  '21:9': '21:9 Wide',
};

function ratios(id: string, values: string[], fallback: string): ModelSetting {
  return {
    id,
    label: 'Aspect ratio',
    choices: values.map((value) => ({ value, label: RATIO_LABELS[value] ?? value })),
    default: fallback,
  };
}

function seconds(id: string, values: string[], fallback: string): ModelSetting {
  return {
    id,
    label: 'Duration',
    choices: values.map((value) => ({ value, label: `${value} seconds` })),
    default: fallback,
  };
}

function options(id: string, label: string, values: string[], fallback: string): ModelSetting {
  return { id, label, choices: values.map((value) => ({ value, label: value })), default: fallback };
}

export const imageModels: MediaModel[] = [
  {
    id: 'pruna/p-image',
    name: 'P-Image',
    description: "Pruna's fast text-to-image model.",
    settings: [ratios('aspectRatio', ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], '1:1')],
  },
  {
    id: 'openai/gpt-image-2',
    name: 'GPT Image 2',
    description: "OpenAI's image model.",
    settings: [
      ratios('ratio', ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], '1:1'),
      {
        id: 'quality',
        label: 'Quality',
        choices: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ],
        default: 'low',
      },
    ],
    fixed: { resolution: '1k', samples: '1' },
  },
  {
    id: 'google/nano-banana-2',
    name: 'Nano Banana 2',
    description: "Google's image model.",
    settings: [
      ratios('aspectRatio', ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], '1:1'),
      options('resolution', 'Resolution', ['512', '1K', '2K'], '1K'),
    ],
  },
  {
    id: 'bytedance/seedream-v4-5',
    name: 'Seedream 4.5',
    description: "ByteDance's image model.",
    settings: [ratios('aspectRatio', ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], '1:1')],
    fixed: { maxImages: '1', watermark: 'false' },
  },
];

export const videoModels: MediaModel[] = [
  {
    id: 'bytedance/seedance-v1-pro-fast',
    name: 'Seedance 1 Pro Fast',
    description: "ByteDance's video model, from text or a start image.",
    settings: [
      ratios('ratio', ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], '16:9'),
      options('resolution', 'Resolution', ['480p', '720p', '1080p'], '480p'),
      seconds('duration', ['5', '10'], '5'),
    ],
    imageInput: 'inputImage',
  },
  {
    id: 'klingai/kling-v3',
    name: 'Kling 3',
    description: "Kling's video model, with optional sound.",
    settings: [
      ratios('ratio', ['16:9', '9:16', '1:1'], '16:9'),
      seconds('duration', ['5', '10'], '5'),
      {
        id: 'sound',
        label: 'Sound',
        choices: [
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'On' },
        ],
        default: 'off',
      },
    ],
    fixed: { mode: 'std' },
    imageInput: 'inputImage',
  },
  {
    id: 'google/veo3-1-fast',
    name: 'Veo 3.1 Fast',
    description: "Google's video model.",
    settings: [
      ratios('aspectRatio', ['16:9', '9:16'], '16:9'),
      options('resolution', 'Resolution', ['720p', '1080p'], '720p'),
      seconds('durationSeconds', ['4', '6', '8'], '4'),
    ],
    imageInput: 'inputImage',
  },
];

export const chatModels: ChatModel[] = [
  {
    id: 'openai/gpt-5-4-nano',
    name: 'GPT-5.4 Nano',
    description: 'Quick answers at a low cost.',
    reasoningEffort: 'low',
  },
  {
    id: 'openai/gpt-5-4-mini',
    name: 'GPT-5.4 Mini',
    description: 'For harder questions.',
    reasoningEffort: 'low',
  },
  {
    id: 'google/gemini-3-5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    description: "Google's light model.",
    reasoningEffort: 'low',
  },
  {
    id: 'deepseek/v4-1-flash',
    name: 'DeepSeek V4.1 Flash',
    description: "DeepSeek's fast model.",
    reasoningEffort: 'low',
  },
  {
    id: 'claude/sonnet-5',
    name: 'Claude Sonnet 5',
    description: "Anthropic's model for writing and code.",
    reasoningEffort: 'low',
  },
];

export const PROMPT_MAX_LENGTH = 3000;

export function mediaModels(kind: MediaKind): MediaModel[] {
  return kind === 'image' ? imageModels : videoModels;
}

export function findMediaModel(kind: MediaKind, id: string): MediaModel | undefined {
  return mediaModels(kind).find((model) => model.id === id);
}

export function findChatModel(id: string): ChatModel | undefined {
  return chatModels.find((model) => model.id === id);
}

export function defaultSettings(model: MediaModel): Record<string, string> {
  return Object.fromEntries(model.settings.map((setting) => [setting.id, setting.default]));
}

/** The CSS aspect ratio for the chosen settings, such as `16 / 9`. */
export function aspectRatioOf(model: MediaModel, settings: Record<string, string>): string {
  for (const setting of model.settings) {
    const value = settings[setting.id] ?? setting.default;
    const match = /^(\d+):(\d+)$/.exec(value);
    if (match) return `${match[1]} / ${match[2]}`;
  }
  return '1 / 1';
}

export class InputError extends Error {}

/**
 * The Run API parameters for one run. Settings outside the model's choices are
 * refused, and settings the model doesn't have are dropped.
 */
export function buildRunParams(
  model: MediaModel,
  input: { prompt: string; settings?: Record<string, string>; imageUrl?: string },
): Record<string, string> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new InputError('Write a prompt first.');
  if (prompt.length > PROMPT_MAX_LENGTH) {
    throw new InputError(`The prompt can be at most ${PROMPT_MAX_LENGTH} characters.`);
  }

  const params: Record<string, string> = { prompt };
  for (const setting of model.settings) {
    const value = input.settings?.[setting.id] ?? setting.default;
    if (!setting.choices.some((choice) => choice.value === value)) {
      throw new InputError(`${setting.label} can't be "${value}" for ${model.name}.`);
    }
    params[setting.id] = value;
  }
  Object.assign(params, model.fixed);

  if (input.imageUrl) {
    if (!model.imageInput) throw new InputError(`${model.name} doesn't take a start image.`);
    let url: URL;
    try {
      url = new URL(input.imageUrl);
    } catch {
      throw new InputError('The start image must be a full https:// URL.');
    }
    if (url.protocol !== 'https:') throw new InputError('The start image must be a full https:// URL.');
    params[model.imageInput] = url.toString();
  }

  return params;
}
