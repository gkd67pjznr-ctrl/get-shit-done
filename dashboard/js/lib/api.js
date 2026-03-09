// Base URL is relative so it works on any port
const BASE = '';

export async function fetchProjects() {
  const res = await fetch(`${BASE}/api/projects`);
  if (!res.ok) throw new Error(`fetchProjects: ${res.status}`);
  return res.json();
}

export async function fetchProject(name) {
  const res = await fetch(`${BASE}/api/projects/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`fetchProject(${name}): ${res.status}`);
  return res.json();
}
