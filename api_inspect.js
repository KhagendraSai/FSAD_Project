(async () => {
  const t = await (await fetch('http://localhost:8080/api/assignments')).text();
  const skip = (i) => { while (i < t.length && /\s/.test(t[i])) i++; return i; };
  function readString(i) {
    let s = ''; i++; let esc = false;
    for (; i < t.length; i++) {
      const c = t[i];
      if (esc) { s += c; esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') return [s, i + 1];
      s += c;
    }
    return [s, i];
  }
  function objectKeys(start) {
    let i = skip(start);
    if (t[i] !== '{') return [];
    i++; let depth = 1, inStr = false, esc = false;
    const keys = [];
    while (i < t.length && depth > 0) {
      const c = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        i++; continue;
      }
      if (c === '"' && depth === 1) {
        const [k, j] = readString(i);
        const kx = skip(j);
        if (t[kx] === ':') keys.push(k);
        i = j; continue;
      }
      if (c === '"') { inStr = true; i++; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    return [...new Set(keys)];
  }

  let count = 0;
  let i = skip(t.indexOf('[') + 1);
  while (i < t.length) {
    i = skip(i);
    if (t[i] === '{') {
      count++;
      let d = 1; i++; let inStr = false, esc = false;
      while (i < t.length && d > 0) {
        const c = t[i];
        if (inStr) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inStr = false;
          i++; continue;
        }
        if (c === '"') { inStr = true; i++; continue; }
        if (c === '{') d++;
        else if (c === '}') d--;
        i++;
      }
      i = skip(i);
      if (t[i] === ',') { i++; continue; }
      if (t[i] === ']') break;
      continue;
    }
    break;
  }

  const firstObjStart = t.indexOf('{', t.indexOf('['));
  const firstAssignmentKeys = objectKeys(firstObjStart);
  const subMarker = t.indexOf('"submissions"');
  const firstSubStart = t.indexOf('{', t.indexOf('[', subMarker));
  const firstSubKeys = objectKeys(firstSubStart);
  const hasAssignment = firstSubKeys.includes('assignment');

  console.log('total assignment count: ' + count);
  console.log('first assignment keys: ' + (firstAssignmentKeys.join(', ') || '(none)'));
  console.log('first submission keys: ' + (firstSubKeys.join(', ') || '(none)'));
  console.log("first submission contains 'assignment' property: " + hasAssignment);
})();
