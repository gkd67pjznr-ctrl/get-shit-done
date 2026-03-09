import { signal } from '@preact/signals';
import { projects } from './state.js';

export const sseStatus = signal('connecting');

let es = null;
let backoff = 1000;

function handleEvent(e) {
  try {
    const data = JSON.parse(e.data);
    if (e.type === 'project-update') {
      projects.value = projects.value.map(p =>
        p.name === data.name ? { ...data, _flash: Date.now() } : p
      );
    } else if (e.type === 'project-added') {
      if (!projects.value.find(p => p.name === data.name)) {
        projects.value = [...projects.value, { ...data, _appear: Date.now() }];
      }
    } else if (e.type === 'project-removed') {
      projects.value = projects.value.filter(p => p.name !== data.name);
    } else if (e.type === 'tmux-update') {
      // Merge tmux data into the matching project without triggering full card flash
      projects.value = projects.value.map(p =>
        p.name === data.name ? { ...p, tmux: data.tmux } : p
      );
    }
  } catch { /* ignore malformed events */ }
}

export function connectSSE() {
  es = new EventSource('/api/events');

  es.onopen = () => {
    sseStatus.value = 'connected';
    backoff = 1000;
  };

  es.onerror = () => {
    sseStatus.value = 'disconnected';
    es.close();
    setTimeout(() => {
      sseStatus.value = 'connecting';
      connectSSE();
    }, backoff);
    backoff = Math.min(backoff * 2, 30000);
  };

  es.addEventListener('project-update',  handleEvent);
  es.addEventListener('project-added',   handleEvent);
  es.addEventListener('project-removed', handleEvent);
  es.addEventListener('tmux-update',     handleEvent);
}
