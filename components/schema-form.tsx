'use client';

import { checkboxOn, fileParams, promptParam, type FormValue, type FormValues } from '@/lib/catalog/schema';
import type { ModelParam } from '@/lib/catalog/types';
import { FileField } from './file-field';
import { cx, inputClass, Select } from './ui';

const NUMBER_TYPES = new Set(['number', 'float', 'range']);

function asText(value: FormValue | undefined): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

function asList(value: FormValue | undefined): string[] {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' && value ? [value] : [];
}

function rangeHint(param: ModelParam): string | undefined {
  if (param.min !== undefined && param.max !== undefined) return `From ${param.min} to ${param.max}.`;
  if (param.min !== undefined) return `At least ${param.min}.`;
  if (param.max !== undefined) return `At most ${param.max}.`;
  return undefined;
}

function sampleHint(param: ModelParam): string | undefined {
  if (!param.sample || !param.default || param.file) return undefined;
  const sample = param.default.replace(/\s+/g, ' ').trim();
  return sample.length > 160 ? `${sample.slice(0, 157)}...` : sample;
}

function ParamField({
  param,
  value,
  onChange,
  onMediaSeconds,
  idPrefix,
}: {
  param: ModelParam;
  value: FormValue | undefined;
  onChange: (value: FormValue) => void;
  onMediaSeconds?: (seconds: number | undefined) => void;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${param.id}`;
  const hint = [param.description, NUMBER_TYPES.has(param.type) ? rangeHint(param) : undefined]
    .filter(Boolean)
    .join(' ');
  const wide = param.type === 'textarea' || Boolean(param.file) || param.type === 'json';

  const label = (
    <span className="flex items-baseline gap-1">
      {param.label}
      {param.required ? (
        <span aria-hidden="true" className="text-muted">
          *
        </span>
      ) : null}
    </span>
  );

  let control;
  if (param.file) {
    control = (
      <FileField
        param={param}
        value={asList(value)}
        onChange={(urls) => onChange(param.file?.multiple ? urls : (urls[0] ?? ''))}
        onMediaSeconds={onMediaSeconds}
      />
    );
  } else if (param.type === 'checkbox') {
    return (
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 py-1 sm:col-span-2">
        <input
          id={id}
          type="checkbox"
          checked={checkboxOn(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{param.label}</span>
          {hint ? <span className="text-xs text-muted">{hint}</span> : null}
        </span>
      </label>
    );
  } else if (param.type === 'select' && param.options.length > 0) {
    const choices =
      !param.required && !param.options.some((option) => option.value === '')
        ? [{ value: '', label: 'Default' }, ...param.options]
        : param.options;
    control = (
      <Select id={id} value={asText(value)} onChange={(event) => onChange(event.target.value)} choices={choices} />
    );
  } else if (NUMBER_TYPES.has(param.type)) {
    control = (
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={asText(value)}
        min={param.min}
        max={param.max}
        step={param.step ?? (param.type === 'number' ? 1 : 'any')}
        onChange={(event) => onChange(event.target.value)}
        placeholder={param.default}
        className={cx(inputClass, 'h-10 tabular-nums')}
      />
    );
  } else if (wide) {
    control = (
      <textarea
        id={id}
        value={asText(value)}
        onChange={(event) => onChange(event.target.value)}
        rows={param.required ? 4 : 3}
        placeholder={sampleHint(param) ?? param.placeholder}
        aria-required={param.required || undefined}
        className={cx(inputClass, 'min-h-24 resize-y leading-relaxed')}
      />
    );
  } else {
    control = (
      <input
        id={id}
        type="text"
        value={asText(value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={sampleHint(param) ?? param.placeholder}
        aria-required={param.required || undefined}
        className={cx(inputClass, 'h-10')}
      />
    );
  }

  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', wide && 'sm:col-span-2')}>
      {param.file ? (
        <span id={id} className="text-sm font-medium">
          {label}
        </span>
      ) : (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      )}
      {control}
      {hint && !param.file ? (
        <p className="line-clamp-2 text-xs text-muted" title={hint}>
          {hint}
        </p>
      ) : null}
      {hint && param.file ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * A form drawn from a model's inputs: files and the prompt first, then the
 * other settings, with the model's advanced settings folded away.
 */
export function SchemaForm({
  params,
  values,
  onChange,
  onMediaSeconds,
  idPrefix,
}: {
  params: ModelParam[];
  values: FormValues;
  onChange: (id: string, value: FormValue) => void;
  onMediaSeconds?: (seconds: number | undefined) => void;
  idPrefix: string;
}) {
  const files = fileParams(params);
  const prompt = promptParam(params);
  const rest = params.filter((param) => !param.hidden && !param.file && param !== prompt);
  const main = rest.filter((param) => !param.advanced);
  const advanced = rest.filter((param) => param.advanced);

  const field = (param: ModelParam) => (
    <ParamField
      key={param.id}
      param={param}
      value={values[param.id]}
      onChange={(value) => onChange(param.id, value)}
      onMediaSeconds={onMediaSeconds}
      idPrefix={idPrefix}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      {files.length > 0 || prompt ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {files.map(field)}
          {prompt ? field(prompt) : null}
        </div>
      ) : null}
      {main.length > 0 ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{main.map(field)}</div> : null}
      {advanced.length > 0 ? (
        <details className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-sm font-medium select-none hover:bg-foreground/[0.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            More settings
            <span className="text-xs font-normal text-muted">{advanced.length} · the model&apos;s defaults apply</span>
          </summary>
          <div className="grid grid-cols-1 gap-4 border-t border-border p-4 sm:grid-cols-2">{advanced.map(field)}</div>
        </details>
      ) : null}
    </div>
  );
}
