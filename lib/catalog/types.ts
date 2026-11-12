/** Shapes shared by the route handlers and the browser. */

export type FileKind = 'image' | 'video' | 'audio' | 'file';

export type Choice = { value: string; label: string };

/** One input of a model, normalized from Tool/Detail. */
export type ModelParam = {
  id: string;
  /** Wiro's input type, lowercased: text, textarea, select, number, float, checkbox, fileinput, ... */
  type: string;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  advanced: boolean;
  /** The catalog value, as text. For sample inputs it is an example, not a default. */
  default?: string;
  /**
   * Wiro fills a left-out optional input with its catalog value, except sample
   * inputs: files, ids with "input", the prompt and the LLM fields.
   */
  sample: boolean;
  options: Choice[];
  /** The options come from a list Wiro loads, so `options` may not hold them all. */
  openOptions: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** File inputs: the kind of file and whether it takes several. */
  file?: { kind: FileKind; multiple: boolean };
  /** File inputs: the text input Wiro reads URLs from, such as `inputImageUrl`. */
  urlField?: string;
  /** A URL twin of a file input, or an LLM-only field: never drawn in the form. */
  hidden: boolean;
};

/** One row of a model's price list, as Wiro stores it (`dynamicprice`). */
export type PriceRow = {
  price: number;
  priceMethod: string;
  inputs?: Record<string, unknown>;
  note?: string;
  priceExtra?: number;
  priceInput?: number;
};

export type PriceInfo = {
  rows: PriceRow[];
  /** Average charge of past runs, for models billed by run time. */
  estimate?: number;
  /** Charge per second of run time. */
  rate?: number;
};

/** A row of a model list. */
export type ModelSummary = {
  /** The `owner/model` slug. */
  id: string;
  title: string;
  description: string;
  categories: string[];
  cover?: string;
  /** Short price text for lists: "$0.005 / run", "from $0.045", "about $0.002". */
  price: string;
  /** For sorting by price; Infinity when unknown. */
  priceSort: number;
  /** Seconds a run usually takes, from past runs. */
  averageSeconds?: number;
};

export type ModelDetail = ModelSummary & {
  params: ModelParam[];
  pricing: PriceInfo;
};

/** A model on the LLM gateway, for the chat page. */
export type ChatModel = {
  id: string;
  name: string;
  owner: string;
  /** USD per million input and output tokens, when known. */
  inputPrice?: number;
  outputPrice?: number;
  contextLength?: number;
  reasoning: boolean;
  vision: boolean;
};
