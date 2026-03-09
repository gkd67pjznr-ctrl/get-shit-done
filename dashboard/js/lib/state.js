import { signal } from '@preact/signals';

// Array of project data objects from /api/projects
export const projects = signal([]);

// Loading state for initial fetch
export const loading = signal(true);

// Error message if initial fetch fails
export const fetchError = signal(null);
