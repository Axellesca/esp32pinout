/** Tiny DOM helpers. No framework, no virtual DOM: just enough to keep the UI readable. */

export const qs = (selector, root = document) => root.querySelector(selector);

/**
 * el('div', { className: 'x', dataset: { id: 'y' }, onClick: fn }, 'text', childNode)
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') node.innerHTML = value;
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
  return node;
}

export function toggleClass(node, name, on) {
  if (node) node.classList.toggle(name, Boolean(on));
  return node;
}

/** Format a value or render an em dash when it is missing. */
export function orDash(value) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) {
    return '—';
  }
  return Array.isArray(value) ? value.join(', ') : String(value);
}
