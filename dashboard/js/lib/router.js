import { signal } from '@preact/signals';

export const route = signal(parseHash());

window.addEventListener('hashchange', () => {
  route.value = parseHash();
});

function parseHash() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'project' && parts[1]) {
    return {
      page: 'detail',
      name: decodeURIComponent(parts[1]),
      milestone: parts[2] ? decodeURIComponent(parts[2]) : null,
    };
  }
  return { page: 'overview' };
}

export function navigate(path) {
  location.hash = path;
}
