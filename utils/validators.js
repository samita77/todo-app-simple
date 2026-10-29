'use strict';

const MAX_TITLE_LENGTH = 200;

/**
 * Trim and collapse internal whitespace so titles are stored consistently.
 */
function normalizeTitle(title) {
  return String(title).trim().replace(/\s+/g, ' ');
}

/**
 * Validate a todo title.
 * @returns {{ok: true, value: string} | {ok: false, error: string}}
 */
function validateTitle(title) {
  if (typeof title !== 'string') {
    return { ok: false, error: 'title must be a string' };
  }

  const value = normalizeTitle(title);

  if (value.length === 0) {
    return { ok: false, error: 'title must not be empty' };
  }

  if (value.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `title must be at most ${MAX_TITLE_LENGTH} characters` };
  }

  return { ok: true, value };
}

/**
 * Validate a `completed` flag. Accepts booleans and the strings
 * "true"/"false" so simple HTML forms work without extra parsing.
 * @returns {{ok: true, value: boolean} | {ok: false, error: string}}
 */
function validateCompleted(completed) {
  if (typeof completed === 'boolean') {
    return { ok: true, value: completed };
  }

  if (completed === 'true' || completed === 'false') {
    return { ok: true, value: completed === 'true' };
  }

  return { ok: false, error: 'completed must be a boolean' };
}

/**
 * Parse a positive integer todo id from a route parameter.
 * @returns {number | null} the id, or null when invalid
 */
function parseTodoId(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return null;
  }

  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Validate a partial update body. At least one recognised field is required.
 * @returns {{ok: true, value: {title?: string, completed?: boolean}} | {ok: false, error: string}}
 */
function validatePatch(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }

  const value = {};

  if ('title' in body) {
    const result = validateTitle(body.title);
    if (!result.ok) return result;
    value.title = result.value;
  }

  if ('completed' in body) {
    const result = validateCompleted(body.completed);
    if (!result.ok) return result;
    value.completed = result.value;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: 'at least one of title or completed is required' };
  }

  return { ok: true, value };
}

module.exports = {
  MAX_TITLE_LENGTH,
  normalizeTitle,
  validateTitle,
  validateCompleted,
  parseTodoId,
  validatePatch,
};
