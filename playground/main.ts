import { createApp } from 'vue';
import App from './App.vue';
import { initializeEmojix } from '@/data/loader';

// Import styles
import '@/themes/variables.css';
import './style.css';

async function bootstrap() {
  console.log('Initializing Emojix...');
  await initializeEmojix();
  console.log('Emojix initialized!');
  
  const app = createApp(App);
  app.mount('#app');
}

bootstrap().catch(console.error);
