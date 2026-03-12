import { execSync } from 'child_process';
import * as path from 'path';

export default async function globalSetup() {
  const root = path.resolve(__dirname, '../../');
  console.log('[global-setup] Building extension…');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
  console.log('[global-setup] Extension built.');
}
