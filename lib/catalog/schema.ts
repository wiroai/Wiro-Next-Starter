import type { Choice, FileKind, ModelParam } from './types';

/**
 * Model inputs from Tool/Detail, the form values the browser keeps, and the Run
 * API parameters built from them. The same code runs in the browser (to draw
 * the form and price the run) and on the server (to check the request).
 */

export type FormValue = string | string[] | boolean;
export type FormValues = Record<string, FormValue>;

const FILE_TYPES = new Set(['fileinput', 'multifileinput', 'multifileinputdrop', 'combinefileinput']);
const MULTI_FILE_TYPES = new Set(['multifileinput', 'multifileinputdrop', 'combinefileinput']);
const RANGE_TYPES = new Set(['number', 'float', 'range']);
const SAMPLE_IDS = new Set([
  'prompt',
  'messages',
  'tools',
  'tool_choice',
  'previousTaskToken',
  'toolOutputs',
  'response_format',
]);
/** Structured LLM fields and run options that a form doesn't offer. */
const HIDDEN_IDS = new Set([
  'messages',
  'tools',
  'tool_choice',
  'parallel_tool_calls',
  'previousTaskToken',
  'toolOutputs',
  'response_format',
  'session_id',
  'callbackUrl',
  'projectid',
]);
const CHECKBOX_OFF = new Set(['', 'false', '0', 'no', 'off', 'null', 'undefined']);

/** Longest text a single input may carry. */
export const MAX_TEXT_LENGTH = 20_000;
/** Most files one input may carry. */
export const MAX_FILES = 8;

type RawOption = { value?: unknown; label?: unknown; text?: unknown; id?: unknown; name?: unknown };
type RawItem = Record<string, unknown> & { id?: unknown; type?: unknown };
type RawGroup = { title?: unknown; items?: unknown };

function text(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const result = String(value).trim();
  return result === '' ? undefined : result;
}

function rangeNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function isOn(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  return !CHECKBOX_OFF.has(value.trim().toLowerCase());
}

/** Drops the "Required." that many inputs start their description with; the form marks required inputs itself. */
function cleanDescription(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/^(required|optional)\.\s*/i, '').trim();
  return cleaned || undefined;
}

/** `inputImageHuman` → `Input image human`. */
export function humanize(id: string): string {
  const words = id
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The kind of file an input takes, read from its id, label and placeholder. */
export function fileKindOf(id: string, label = '', placeholder = ''): FileKind {
  const words = `${id} ${label} ${placeholder}`.toLowerCase();
  if (/video|clip|mp4|footage/.test(words)) return 'video';
  if (/audio|voice|speech|song|music|sound|mp3|wav|vocal/.test(words)) return 'audio';
  if (
    /image|photo|picture|face|portrait|frame|logo|mask|garment|cloth|human|person|product|reference|selfie|avatar|style/.test(
      words,
    )
  ) {
    return 'image';
  }
  return 'file';
}

/** The catalog value of an input as text, the way Wiro-MCP reads it. */
function catalogValue(item: RawItem, type: string): string | undefined {
  if (type === 'checkbox') {
    const initial = Object.prototype.hasOwnProperty.call(item, 'value') ? item.value : item.defaultvalue;
    if (!isOn(initial)) return 'false';
    return typeof initial === 'string' && !['true', '1', 'yes', 'on'].includes(initial.trim().toLowerCase())
      ? initial.trim()
      : 'true';
  }
  const raw = item.defaultvalue ?? item.value ?? item.default;
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (Array.isArray(raw)) return raw.length > 0 ? JSON.stringify(raw) : undefined;
  return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
}

function options(value: unknown): Choice[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: Choice[] = [];
  for (const option of value as RawOption[]) {
    if (option === null || typeof option !== 'object') continue;
    const raw = option.value ?? option.id;
    if (raw === undefined || raw === null) continue;
    const optionValue = String(raw);
    if (seen.has(optionValue)) continue;
    seen.add(optionValue);
    const label = text(option.label) ?? text(option.text) ?? text(option.name) ?? optionValue;
    result.push({ value: optionValue, label: label || 'Automatic' });
  }
  return result;
}

/** Flattens Tool/Detail's parameter groups into one list of inputs, in schema order. */
export function normalizeParams(groups: unknown): ModelParam[] {
  const items: RawItem[] = [];
  for (const group of Array.isArray(groups) ? (groups as RawGroup[]) : []) {
    for (const item of Array.isArray(group?.items) ? (group.items as RawItem[]) : []) {
      if (item && typeof item === 'object' && text(item.id)) items.push(item);
    }
  }

  const ids = new Map(items.map((item) => [String(item.id).toLowerCase(), String(item.id)]));
  const twins = new Set<string>();
  const params: ModelParam[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const type = (text(item.type) ?? 'text').toLowerCase();
    const named = text(item.label);
    // Some labels are just the id, a slug such as "model-name", or start in lowercase.
    const raw =
      !named || named === id ? humanize(id) : /^[a-z0-9]+([_-][a-z0-9]+)+$/.test(named) ? humanize(named) : named;
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    const placeholder = text(item.placeholder);
    const required = item.required === true || String(item.required) === 'true';
    const isFile = FILE_TYPES.has(type);
    const value = catalogValue(item, type);
    const sample = isFile || id.includes('input') || SAMPLE_IDS.has(id);

    let urlField: string | undefined;
    if (type === 'fileinput') urlField = ids.get(`${id}url`.toLowerCase());
    if (type === 'multifileinput' || type === 'multifileinputdrop') {
      urlField = ids.get(`${id.replace(/Multiple$/, '')}UrlMultiple`.toLowerCase());
    }
    if (urlField) twins.add(urlField);

    const range = RANGE_TYPES.has(type)
      ? {
          min: rangeNumber(item.minvalue) ?? rangeNumber(item.min),
          max: rangeNumber(item.maxvalue) ?? rangeNumber(item.max),
          step: rangeNumber(item.incrementby) ?? rangeNumber(item.step),
        }
      : {};

    params.push({
      id,
      type,
      label,
      description: cleanDescription(text(item.description) ?? text(item.note)),
      placeholder,
      required,
      advanced: item.advanced === true || String(item.advanced) === 'true',
      default: value,
      sample,
      options: options(item.options),
      openOptions: item.optionsLoad !== undefined && item.optionsLoad !== null && item.optionsLoad !== '',
      ...range,
      file: isFile ? { kind: fileKindOf(id, label, placeholder), multiple: MULTI_FILE_TYPES.has(type) } : undefined,
      urlField,
      hidden: HIDDEN_IDS.has(id),
    });
  }

  for (const param of params) if (twins.has(param.id)) param.hidden = true;
  return params;
}

/** Whether a checkbox is on for this value. */
export function checkboxOn(value: FormValue | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return false;
  return isOn(value);
}

/** The prompt input: the one named like a prompt, else the first required text area. */
export function promptParam(params: ModelParam[]): ModelParam | undefined {
  const visible = params.filter((param) => !param.hidden && !param.file);
  return (
    visible.find((param) =>
      /^(prompt|text|script|lyrics|caption|instruction|instructions|query|question)$/i.test(param.id),
    ) ?? visible.find((param) => param.type === 'textarea' && param.required)
  );
}

/** File inputs, required ones first. */
export function fileParams(params: ModelParam[]): ModelParam[] {
  return params.filter((param) => param.file && !param.hidden).sort((a, b) => Number(b.required) - Number(a.required));
}

/** The file input a page's main file goes to: the first required one of that kind, else the first of that kind. */
export function primaryFileParam(params: ModelParam[], kind: FileKind): ModelParam | undefined {
  const files = fileParams(params);
  return (
    files.find((param) => param.file?.kind === kind && param.required) ??
    files.find((param) => param.file?.kind === kind) ??
    files.find((param) => param.file?.kind === 'file')
  );
}

/** The value a fresh form starts with. Samples stay out: they are examples, shown as placeholders. */
export function initialValues(params: ModelParam[], overrides: FormValues = {}): FormValues {
  const values: FormValues = {};
  for (const param of params) {
    if (param.hidden) continue;
    if (param.type === 'checkbox') {
      values[param.id] = checkboxOn(param.default);
    } else if (param.file) {
      values[param.id] = param.file.multiple ? [] : '';
    } else if (!param.sample && param.default !== undefined) {
      values[param.id] = param.default;
    } else if (param.type === 'select' && param.required && param.options.length > 0 && !param.sample) {
      values[param.id] = param.options[0].value;
    } else {
      values[param.id] = '';
    }
  }
  for (const [id, value] of Object.entries(overrides)) {
    const param = params.find((item) => item.id === id && !item.hidden);
    if (!param) continue;
    if (param.type === 'select' && typeof value === 'string' && param.options.length > 0 && !param.openOptions) {
      if (!param.options.some((option) => option.value === value)) continue;
    }
    values[id] = param.file?.multiple && typeof value === 'string' ? (value ? [value] : []) : value;
  }
  return values;
}

/** Whether a URL can be sent as a file input: public http(s) only. */
export function isFileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export type BuildResult = {
  params: Record<string, string | string[]>;
  /** Labels of required inputs that have no value. */
  missing: string[];
  /** Values that can't be sent as they are. */
  errors: string[];
};

/**
 * The Run API parameters for these form values. Inputs the model doesn't have
 * are dropped, choices outside a select's options and numbers outside the range
 * are refused, and empty optional inputs are left out so Wiro applies the
 * model's defaults. Required inputs without a value get their catalog value,
 * as Wiro's own clients do, unless it is only a sample.
 */
export function buildParams(params: ModelParam[], values: FormValues): BuildResult {
  const result: BuildResult = { params: {}, missing: [], errors: [] };

  for (const param of params) {
    if (param.hidden) continue;
    const value = values[param.id];

    if (param.file) {
      const urls = (Array.isArray(value) ? value : typeof value === 'string' ? [value] : [])
        .map((url) => url.trim())
        .filter(Boolean);
      if (urls.length === 0) {
        if (param.required) result.missing.push(param.label);
        continue;
      }
      const bad = urls.find((url) => !isFileUrl(url));
      if (bad) {
        result.errors.push(`${param.label} needs a public http(s) URL.`);
        continue;
      }
      if (urls.length > MAX_FILES) {
        result.errors.push(`${param.label} takes at most ${MAX_FILES} files.`);
        continue;
      }
      if (!param.file.multiple && urls.length > 1) {
        result.errors.push(`${param.label} takes one file.`);
        continue;
      }
      if (param.type === 'combinefileinput') {
        result.params[param.id] = urls;
      } else if (param.type === 'fileinput') {
        result.params[param.urlField ?? param.id] = urls[0];
      } else {
        result.params[param.urlField ?? `${param.id.replace(/Multiple$/, '')}UrlMultiple`] = urls.join(',');
      }
      continue;
    }

    if (param.type === 'checkbox') {
      const on = value === undefined ? checkboxOn(param.default) : checkboxOn(value);
      // A flag such as "--face_enhance" is the value that turns it on; an empty value turns it off.
      const flag = param.default && checkboxOn(param.default) && param.default !== 'true' ? param.default : 'true';
      result.params[param.id] = on ? flag : '';
      continue;
    }

    const raw = typeof value === 'string' ? value : Array.isArray(value) || value === undefined ? '' : String(value);
    const trimmed = raw.trim();
    if (trimmed === '') {
      if (param.required) {
        if (!param.sample && param.default !== undefined) result.params[param.id] = param.default;
        else result.missing.push(param.label);
      }
      continue;
    }

    if (param.type === 'select' && param.options.length > 0 && !param.openOptions) {
      if (!param.options.some((option) => option.value === trimmed)) {
        result.errors.push(`${param.label} can't be "${trimmed.slice(0, 40)}".`);
        continue;
      }
      result.params[param.id] = trimmed;
      continue;
    }

    if (RANGE_TYPES.has(param.type)) {
      let number = Number(trimmed);
      if (!Number.isFinite(number)) {
        result.errors.push(`${param.label} must be a number.`);
        continue;
      }
      if (param.min !== undefined) number = Math.max(param.min, number);
      if (param.max !== undefined) number = Math.min(param.max, number);
      result.params[param.id] = String(number);
      continue;
    }

    if (raw.length > MAX_TEXT_LENGTH) {
      result.errors.push(`${param.label} can be at most ${MAX_TEXT_LENGTH.toLocaleString('en-US')} characters.`);
      continue;
    }
    result.params[param.id] = param.type === 'textarea' ? raw : trimmed;
  }
  return result;
}

/** The parameters with the catalog values Wiro fills in, used to pick a price row. */
export function withDefaults(params: ModelParam[], built: Record<string, unknown>): Record<string, unknown> {
  const full: Record<string, unknown> = { ...built };
  for (const param of params) {
    if (param.file) {
      // Price rows count files under the input's own id, also when the URL went to its twin field.
      const twin = param.urlField ? built[param.urlField] : undefined;
      if (full[param.id] === undefined && typeof twin === 'string' && twin) full[param.id] = twin.split(',');
      continue;
    }
    if (full[param.id] !== undefined || param.sample) continue;
    if (param.default !== undefined && param.default !== '') full[param.id] = param.default;
  }
  return full;
}
