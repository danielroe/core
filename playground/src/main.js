import '@fontsource-variable/dm-sans';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

export default mount(App, { target: document.getElementById('app') });
