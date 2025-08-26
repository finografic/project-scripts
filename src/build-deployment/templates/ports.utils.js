import { execSync } from 'child_process';

// Function to kill processes on specific ports
export function killPortIfOccupied(port) {
  try {
    const result = execSync('lsof -ti:' + port, { stdio: 'pipe' })
      .toString()
      .trim();
    if (result) {
      console.log('⚠️  Port ' + port + ' is occupied, killing process...');
      execSync('lsof -ti:' + port + ' | xargs kill -9', { stdio: 'inherit' });
      console.log('✅ Killed process on port ' + port);
    } else {
      console.log('✅ Port ' + port + ' is available');
    }
  } catch (error) {
    // Port is not in use
    console.log('✅ Port ' + port + ' is available');
  }
}
