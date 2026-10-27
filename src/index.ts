import { createDeepCompare } from './deep-compare';

export type { DeepCompare, DeepCompareOptions } from './deep-compare';
export { createDeepCompare } from './deep-compare';
export { DeepCompareError } from './deep-compare.error';
export type { TagArgument } from './tag-call';
export type { TagMatcher, TagPattern } from './tag-registry';

export const { Tag, deepCompare } = createDeepCompare();
