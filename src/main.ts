// ABOUTME: Application entry point.
// ABOUTME: Mounts the root Svelte component into the DOM.

import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

mount(App, { target: document.getElementById('app')! });
