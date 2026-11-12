import type { FormValues } from './schema';
import type { FileKind } from './types';

/**
 * The tools on the Image, Video and Audio pages and the categories of the
 * Playground. Each tool lists the models of its Wiro categories and starts on a
 * default model; any model of those categories can be picked instead.
 */

export type ToolPage = 'image' | 'video' | 'audio';

export type Tool = {
  id: string;
  page: ToolPage;
  /** Tab id in the URL: /image?tab=edit */
  tab: string;
  label: string;
  description: string;
  /** Wiro categories whose models the tool lists. */
  categories: string[];
  /** Models that also carry one of these categories are left out. */
  exclude?: string[];
  defaultModel: string;
  /** Starting values for the default model, to keep a first run quick and cheap. */
  defaults?: FormValues;
  /** The file the tool works on, filled from `?image=`, `?audio=` or `?video=`. */
  input?: FileKind;
  /** What the run button says. */
  action: string;
};

export const TOOLS: Tool[] = [
  {
    id: 'image-generate',
    page: 'image',
    tab: 'generate',
    label: 'Generate',
    description: 'Write a prompt and pick a model.',
    categories: ['text-to-image'],
    defaultModel: 'pruna/p-image',
    defaults: { aspectRatio: '1:1' },
    action: 'Generate image',
  },
  {
    id: 'image-edit',
    page: 'image',
    tab: 'edit',
    label: 'Edit',
    description: 'Change an image by describing what should be different.',
    categories: ['image-editing'],
    defaultModel: 'google/nano-banana-2',
    defaults: { resolution: '1K' },
    input: 'image',
    action: 'Edit image',
  },
  {
    id: 'image-upscale',
    page: 'image',
    tab: 'upscale',
    label: 'Upscale',
    description: 'Make an image larger and sharper.',
    categories: ['upscale', 'restoration'],
    exclude: ['video-to-video', 'image-to-video', 'text-to-video'],
    defaultModel: 'xinntao/real-esrgan',
    input: 'image',
    action: 'Upscale image',
  },
  {
    id: 'image-remove-background',
    page: 'image',
    tab: 'remove-background',
    label: 'Remove background',
    description: 'Cut out the subject and get a transparent PNG.',
    categories: ['background-removal'],
    defaultModel: 'briaai/rmbg-2-0',
    input: 'image',
    action: 'Remove background',
  },
  {
    id: 'video-text',
    page: 'video',
    tab: 'text',
    label: 'Text to video',
    description: 'Describe a scene and get a clip.',
    categories: ['text-to-video'],
    defaultModel: 'bytedance/seedance-v1-pro-fast',
    defaults: { resolution: '480p', duration: '5', ratio: '16:9' },
    action: 'Generate video',
  },
  {
    id: 'video-image',
    page: 'video',
    tab: 'image',
    label: 'Image to video',
    description: 'Bring an image to life. Describe the motion, or leave the prompt empty.',
    categories: ['image-to-video'],
    defaultModel: 'bytedance/seedance-v1-pro-fast',
    defaults: { resolution: '480p', duration: '5', ratio: 'adaptive' },
    input: 'image',
    action: 'Generate video',
  },
  {
    id: 'audio-speech',
    page: 'audio',
    tab: 'speech',
    label: 'Speech',
    description: 'Turn text into speech. Pick a voice and a language.',
    categories: ['text-to-speech'],
    exclude: ['sound-effects'],
    defaultModel: 'elevenlabs/eleven-v4',
    action: 'Generate speech',
  },
  {
    id: 'audio-music',
    page: 'audio',
    tab: 'music',
    label: 'Music',
    description: 'Describe a style or a mood and get a track.',
    categories: ['text-to-music', 'music-generation'],
    defaultModel: 'elevenlabs/text-to-music-v2-5',
    defaults: { duration: '10' },
    action: 'Generate music',
  },
  {
    id: 'audio-transcribe',
    page: 'audio',
    tab: 'transcribe',
    label: 'Transcribe',
    description: 'Turn speech in an audio file into text.',
    categories: ['speech-to-text'],
    defaultModel: 'elevenlabs/speech-to-text',
    input: 'audio',
    action: 'Transcribe',
  },
];

export function toolsFor(page: ToolPage): Tool[] {
  return TOOLS.filter((tool) => tool.page === page);
}

export function findTool(id: string): Tool | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

export type CategoryGroup = { label: string; categories: { id: string; label: string }[] };

/** The categories the Playground offers, grouped as on wiro.ai. */
export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: 'Image',
    categories: [
      { id: 'text-to-image', label: 'Text to image' },
      { id: 'image-editing', label: 'Edit with a prompt' },
      { id: 'image-to-image', label: 'Image to image' },
      { id: 'upscale', label: 'Upscale' },
      { id: 'restoration', label: 'Restore photos' },
      { id: 'background-removal', label: 'Remove background' },
      { id: 'virtual-try-on', label: 'Virtual try-on' },
      { id: '3d-generation', label: '3D models' },
    ],
  },
  {
    label: 'Video',
    categories: [
      { id: 'text-to-video', label: 'Text to video' },
      { id: 'image-to-video', label: 'Image to video' },
      { id: 'video-to-video', label: 'Video to video' },
      { id: 'talking-head', label: 'Talking avatar' },
    ],
  },
  {
    label: 'Audio',
    categories: [
      { id: 'text-to-speech', label: 'Text to speech' },
      { id: 'text-to-music', label: 'Text to music' },
      { id: 'music-generation', label: 'Music' },
      { id: 'text-to-song', label: 'Songs with lyrics' },
      { id: 'speech-to-text', label: 'Speech to text' },
      { id: 'speech-to-speech', label: 'Speech to speech' },
    ],
  },
  {
    label: 'Text',
    categories: [
      { id: 'image-to-text', label: 'Image to text' },
      { id: 'ocr', label: 'Text in images' },
      { id: 'translate', label: 'Translate' },
    ],
  },
  {
    label: 'Tools',
    categories: [{ id: 'utils', label: 'Convert and edit' }],
  },
];

export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((group) => group.categories);

export function categoryLabel(id: string): string {
  return ALL_CATEGORIES.find((category) => category.id === id)?.label ?? id.replace(/-/g, ' ');
}

/** Category ids are short lowercase slugs. */
export const CATEGORY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/i;
