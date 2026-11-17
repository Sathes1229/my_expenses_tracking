import { createElement, Fragment, type ReactNode } from 'react';

/**
 * Like fmt(), for placeholders filled with elements, such as an amount in <Money>: the sentence
 * comes from the catalog and the elements keep their own markup. A placeholder with no value stays
 * as it is, so a gap is visible.
 */
export function fmtNodes(template: string, params: Record<string, ReactNode>): ReactNode[] {
  return template
    .split(/(\{\w+\})/)
    .filter((piece) => piece !== '')
    .map((piece, index) => {
      const name = /^\{(\w+)\}$/.exec(piece)?.[1];
      return createElement(Fragment, { key: index }, name !== undefined && name in params ? params[name] : piece);
    });
}
