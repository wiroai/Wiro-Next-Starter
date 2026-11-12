/**
 * Models this app never lists, the same rule as the Wiro AI browser extensions:
 * uncensored and NSFW models stay out (a model that detects NSFW content is a
 * moderation tool and stays in), and so do live voice models, which need a
 * realtime connection rather than a task.
 */

const UNCENSORED = /uncensored|decensored|abliterated|obliterated|heretic|refusal[- ]reduced/i;
const NSFW = /nsfw/i;
const MODERATION = /detect|classif|moderat|filter|checker/i;
const LIVE_CATEGORIES = /^realtime-/;

export function isHiddenModel(model: {
  id: string;
  title: string;
  description?: string;
  categories?: string[];
}): boolean {
  const words = `${model.id} ${model.title} ${model.description ?? ''}`;
  if (UNCENSORED.test(words)) return true;
  const name = `${model.id} ${model.title}`;
  if (NSFW.test(name) && !MODERATION.test(name)) return true;
  return (model.categories ?? []).some((category) => LIVE_CATEGORIES.test(category));
}
