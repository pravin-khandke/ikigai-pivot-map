import { loadEnv } from 'vite';
import ikigaiApi from './server/plugin.js';

export default ({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [ikigaiApi()],
  };
};
