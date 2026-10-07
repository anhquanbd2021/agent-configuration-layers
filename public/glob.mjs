// Minimal glob matcher for `appliesTo` patterns — the same idea real agent
// configs use to scope rules to a directory tree (`src/api/**`). Supports:
//   **  any number of path segments (including none)
//   *   any characters within one segment
//   ?   one character within a segment
// Paths are matched as forward-slash strings; no filesystem is touched.

export function globToRegExp(pattern) {
  if (typeof pattern !== 'string' || !pattern) {
    throw new TypeError('glob pattern must be a non-empty string');
  }
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        i += 1;
        if (pattern[i + 1] === '/') {
          // "**/" — zero or more whole segments
          i += 1;
          re += '(?:[^/]+/)*';
        } else {
          // trailing or mid "**" — anything, including slashes
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesGlob(pattern, path) {
  return globToRegExp(pattern).test(path);
}
