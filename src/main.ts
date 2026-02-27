import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { loadToken } from './lib/storage';

mount(App, { target: document.getElementById('app')! });

// Expose the Todoist SDK in the browser console for experimentation (dev only).
// The SDK depends on undici (Node.js HTTP client) and can't run in production browser builds.
// Usage: todoist.getProjects().then(console.log)
if (import.meta.env.DEV) {
  import('@doist/todoist-api-typescript').then(({ TodoistApi }) => {
    const token = loadToken();
    if (token) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).todoist = new TodoistApi(token);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).TodoistApi = TodoistApi;
      console.log(
        'reviewist: No token stored yet. After entering your token, reload to get `window.todoist`.\n' +
        'Or create one manually: window.todoist = new TodoistApi("your-token")',
      );
    }
  });
}
